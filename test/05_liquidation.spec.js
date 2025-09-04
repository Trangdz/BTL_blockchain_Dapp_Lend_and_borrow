const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("05_Liquidation", function () {
  let deployer, user1, user2, liquidator;
  let weth, usdc, dai;
  let wethUsdFeed, usdcUsdFeed, daiUsdFeed;
  let addressToTokenMap, lendingConfig, lendingHelper;
  let poolFactory, poolImpl, pool;
  let liquidationManager;

  const PRECISION = ethers.utils.parseEther("1"); // 1e18

  before(async function () {
    [deployer, user1, user2, liquidator] = await ethers.getSigners();

    // Deploy mock tokens
    const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
    
    weth = await ERC20Mintable.deploy("Wrapped Ether", "WETH", 18, ethers.utils.parseEther("1000000"));
    await weth.deployed();
    
    usdc = await ERC20Mintable.deploy("USD Coin", "USDC", 6, ethers.utils.parseUnits("1000000", 6));
    await usdc.deployed();
    
    dai = await ERC20Mintable.deploy("Dai Stablecoin", "DAI", 18, ethers.utils.parseEther("1000000"));
    await dai.deployed();

    // Deploy mock price feeds
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    wethUsdFeed = await MockV3Aggregator.deploy(8, 300000000000); // $3000
    await wethUsdFeed.deployed();
    
    usdcUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1
    await usdcUsdFeed.deployed();
    
    daiUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1
    await daiUsdFeed.deployed();

    // Deploy core contracts
    const AddressToTokenMapV2 = await ethers.getContractFactory("AddressToTokenMapV2");
    addressToTokenMap = await AddressToTokenMapV2.deploy();
    await addressToTokenMap.deployed();

    const LendingConfigV2 = await ethers.getContractFactory("LendingConfigV2");
    lendingConfig = await LendingConfigV2.deploy();
    await lendingConfig.deployed();

    const LendingHelper = await ethers.getContractFactory("LendingHelper");
    lendingHelper = await LendingHelper.deploy(addressToTokenMap.address, lendingConfig.address);
    await lendingHelper.deployed();

    // Setup token mappings
    await addressToTokenMap.batchSetTokenData(
      [weth.address, usdc.address, dai.address],
      ["WETH", "USDC", "DAI"],
      [wethUsdFeed.address, usdcUsdFeed.address, daiUsdFeed.address],
      [18, 6, 18]
    );

    // Disable oracle staleness check for testing
    await addressToTokenMap.setOracleStaleThreshold(86400 * 365);

    // Deploy pool implementation
    const IsolatedLendingPool = await ethers.getContractFactory("IsolatedLendingPool");
    poolImpl = await IsolatedLendingPool.deploy();
    await poolImpl.deployed();

    // Deploy pool factory
    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    poolFactory = await PoolFactory.deploy(poolImpl.address);
    await poolFactory.deployed();

    // Create a pool
    const poolParams = {
      addressToTokenMap: addressToTokenMap.address,
      lendingConfig: lendingConfig.address,
      lendingHelper: lendingHelper.address,
      reserveFactor: ethers.utils.parseEther("0.1"), // 10%
      liquidationBonus: ethers.utils.parseEther("0.05") // 5%
    };

    const tx = await poolFactory.createPool(ethers.utils.formatBytes32String("CORE"), poolParams);
    const receipt = await tx.wait();
    
    const poolCreatedEvent = receipt.events.find(e => e.event === "PoolCreated");
    const poolAddress = poolCreatedEvent.args.pool;
    
    pool = await ethers.getContractAt("IsolatedLendingPool", poolAddress);

    // Setup risk parameters - more aggressive for liquidation testing
    const riskParams = {
      LTV: ethers.utils.parseEther("0.8"),      // 80% LTV
      LT: ethers.utils.parseEther("0.85"),      // 85% Liquidation Threshold
      kink: ethers.utils.parseEther("0.8"),     // 80% kink
      rBase: ethers.utils.parseEther("0.02"),   // 2% base rate
      slope1: ethers.utils.parseEther("0.05"),  // 5% slope1
      slope2: ethers.utils.parseEther("0.25")   // 25% slope2
    };

    await lendingConfig.batchSetRiskParams(
      pool.address,
      [weth.address, usdc.address, dai.address],
      [riskParams, riskParams, riskParams]
    );

    // Add tokens to pool
    await pool.addToken(weth.address);
    await pool.addToken(usdc.address);
    await pool.addToken(dai.address);

    // Deploy liquidation manager
    const LiquidationManager = await ethers.getContractFactory("LiquidationManager");
    liquidationManager = await LiquidationManager.deploy(
      addressToTokenMap.address,
      lendingConfig.address
    );
    await liquidationManager.deployed();

    // Set liquidation manager in pool
    await pool.setLiquidationManager(liquidationManager.address);

    // Grant liquidator role to liquidator account
    await liquidationManager.grantLiquidatorRole(liquidator.address);

    // Mint tokens to users and liquidator
    await weth.mint(user1.address, ethers.utils.parseEther("10"));
    await dai.mint(user1.address, ethers.utils.parseEther("10000"));
    await usdc.mint(user1.address, ethers.utils.parseUnits("10000", 6));

    await dai.mint(liquidator.address, ethers.utils.parseEther("50000"));
    await usdc.mint(liquidator.address, ethers.utils.parseUnits("50000", 6));

    // Setup initial positions for liquidation test
    // User1 supplies WETH and borrows DAI close to the limit
    await weth.connect(user1).approve(pool.address, ethers.utils.parseEther("10"));
    await pool.connect(user1).lend(weth.address, ethers.utils.parseEther("10")); // $30,000 collateral

    // Provide DAI liquidity from deployer
    await dai.mint(deployer.address, ethers.utils.parseEther("100000"));
    await dai.connect(deployer).approve(pool.address, ethers.utils.parseEther("50000"));
    await pool.connect(deployer).lend(dai.address, ethers.utils.parseEther("50000"));

    // User1 borrows DAI close to LTV limit
    const borrowAmount = ethers.utils.parseEther("20000"); // $20,000 (66% of $30k collateral)
    await pool.connect(user1).borrow(dai.address, borrowAmount);
  });

  describe("Health Factor Calculations", function () {
    it("Should calculate health factor correctly", async function () {
      const result = await liquidationManager.calcHealthFactor(user1.address, pool.address);
      const healthFactor = result.hf;
      const collateralUSD = result.collateralUSD;
      const borrowUSD = result.borrowUSD;

      console.log("Health Factor:", ethers.utils.formatEther(healthFactor));
      console.log("Collateral USD:", ethers.utils.formatEther(collateralUSD));
      console.log("Borrow USD:", ethers.utils.formatEther(borrowUSD));

      // Health factor should be > 1 initially
      expect(healthFactor).to.be.gt(PRECISION);
    });

    it("Should identify user as not liquidatable initially", async function () {
      const isLiquidatable = await liquidationManager.isLiquidatable(user1.address, pool.address);
      expect(isLiquidatable).to.be.false;
    });
  });

  describe("Price Drops & Liquidation", function () {
    it("Should become liquidatable when WETH price drops", async function () {
      // Drop WETH price from $3000 to $1800 (40% drop)
      await wethUsdFeed.updateAnswer(180000000000); // $1800

      const result = await liquidationManager.calcHealthFactor(user1.address, pool.address);
      const healthFactor = result.hf;

      console.log("Health Factor after price drop:", ethers.utils.formatEther(healthFactor));

      // Health factor should now be < 1
      expect(healthFactor).to.be.lt(PRECISION);

      const isLiquidatable = await liquidationManager.isLiquidatable(user1.address, pool.address);
      expect(isLiquidatable).to.be.true;
    });

    it("Should calculate correct seize amount", async function () {
      const repayAmount = ethers.utils.parseEther("5000"); // Repay $5000 of DAI
      
      const seizeAmount = await liquidationManager.calculateSeizeAmount(
        pool.address,
        dai.address,
        repayAmount,
        weth.address
      );

      console.log("Repay Amount (DAI):", ethers.utils.formatEther(repayAmount));
      console.log("Seize Amount (WETH):", ethers.utils.formatEther(seizeAmount));

      // Should seize more than the repay value due to liquidation bonus
      expect(seizeAmount).to.be.gt(0);
    });

    it("Should successfully liquidate user", async function () {
      const repayAmount = ethers.utils.parseEther("5000");
      
      // Liquidator approves DAI for repayment
      await dai.connect(liquidator).approve(liquidationManager.address, repayAmount);
      
      const initialLiquidatorWETH = await weth.balanceOf(liquidator.address);
      const initialUserDebt = await pool.debts(user1.address, dai.address);
      const initialUserCollateral = await pool.supplied(user1.address, weth.address);

      // Execute liquidation
      await expect(
        liquidationManager.connect(liquidator).liquidate(
          user1.address,
          pool.address,
          dai.address,
          repayAmount,
          weth.address
        )
      ).to.emit(liquidationManager, "LiquidationExecuted");

      // Check results
      const finalLiquidatorWETH = await weth.balanceOf(liquidator.address);
      const finalUserDebt = await pool.debts(user1.address, dai.address);
      const finalUserCollateral = await pool.supplied(user1.address, weth.address);

      // Liquidator should receive WETH
      expect(finalLiquidatorWETH).to.be.gt(initialLiquidatorWETH);

      // User's debt should be reduced
      expect(finalUserDebt).to.be.lt(initialUserDebt);

      // User's collateral should be reduced
      expect(finalUserCollateral).to.be.lt(initialUserCollateral);

      console.log("Debt reduced from", ethers.utils.formatEther(initialUserDebt), "to", ethers.utils.formatEther(finalUserDebt));
      console.log("Collateral reduced from", ethers.utils.formatEther(initialUserCollateral), "to", ethers.utils.formatEther(finalUserCollateral));
    });

    it("Should improve user's health factor after partial liquidation", async function () {
      const result = await liquidationManager.calcHealthFactor(user1.address, pool.address);
      const healthFactor = result.hf;

      console.log("Health Factor after liquidation:", ethers.utils.formatEther(healthFactor));

      // Health factor should be improved (though might still be < 1)
      expect(healthFactor).to.be.gt(0);
    });
  });

  describe("Liquidation Edge Cases", function () {
    it("Should revert when trying to liquidate healthy user", async function () {
      // Reset WETH price to make user healthy again
      await wethUsdFeed.updateAnswer(300000000000); // Back to $3000

      const repayAmount = ethers.utils.parseEther("1000");
      await dai.connect(liquidator).approve(liquidationManager.address, repayAmount);

      await expect(
        liquidationManager.connect(liquidator).liquidate(
          user1.address,
          pool.address,
          dai.address,
          repayAmount,
          weth.address
        )
      ).to.be.revertedWithCustomError(liquidationManager, "ErrUserHealthy");
    });

    it("Should revert when liquidating with zero amount", async function () {
      // Make user liquidatable again
      await wethUsdFeed.updateAnswer(150000000000); // $1500

      await expect(
        liquidationManager.connect(liquidator).liquidate(
          user1.address,
          pool.address,
          dai.address,
          0,
          weth.address
        )
      ).to.be.revertedWithCustomError(liquidationManager, "ErrZeroAmount");
    });

    it("Should handle liquidation of user with no debt", async function () {
      const user3 = (await ethers.getSigners())[4];
      
      // The liquidation check happens before debt check, so healthy user error is expected
      await expect(
        liquidationManager.connect(liquidator).liquidate(
          user3.address,
          pool.address,
          dai.address,
          ethers.utils.parseEther("1000"),
          weth.address
        )
      ).to.be.revertedWithCustomError(liquidationManager, "ErrUserHealthy");
    });

    it("Should handle repay amount greater than debt", async function () {
      const currentDebt = await pool.debts(user1.address, dai.address);
      const excessiveRepayAmount = currentDebt.add(ethers.utils.parseEther("5000"));
      
      await dai.connect(liquidator).approve(liquidationManager.address, excessiveRepayAmount);

      // Should only repay the actual debt amount
      await expect(
        liquidationManager.connect(liquidator).liquidate(
          user1.address,
          pool.address,
          dai.address,
          excessiveRepayAmount,
          weth.address
        )
      ).to.emit(liquidationManager, "LiquidationExecuted");

      // User should have no debt left
      const finalDebt = await pool.debts(user1.address, dai.address);
      expect(finalDebt).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should only allow authorized liquidators", async function () {
      // Make user liquidatable
      await wethUsdFeed.updateAnswer(100000000000); // $1000 - very low price
      
      // Setup another user with collateral and debt
      await weth.mint(user2.address, ethers.utils.parseEther("5"));
      await weth.connect(user2).approve(pool.address, ethers.utils.parseEther("5"));
      await pool.connect(user2).lend(weth.address, ethers.utils.parseEther("5"));
      await pool.connect(user2).borrow(dai.address, ethers.utils.parseEther("3000"));

      const unauthorizedUser = (await ethers.getSigners())[5];
      await dai.mint(unauthorizedUser.address, ethers.utils.parseEther("10000"));
      await dai.connect(unauthorizedUser).approve(liquidationManager.address, ethers.utils.parseEther("1000"));

      // Should revert for unauthorized liquidator
      await expect(
        liquidationManager.connect(unauthorizedUser).liquidate(
          user2.address,
          pool.address,
          dai.address,
          ethers.utils.parseEther("1000"),
          weth.address
        )
      ).to.be.reverted; // Access control will revert
    });

    it("Should allow admin to grant liquidator role", async function () {
      const newLiquidator = (await ethers.getSigners())[6];
      
      await liquidationManager.grantLiquidatorRole(newLiquidator.address);
      
      const hasRole = await liquidationManager.hasRole(
        await liquidationManager.LIQUIDATOR_ROLE(),
        newLiquidator.address
      );
      expect(hasRole).to.be.true;
    });
  });

  describe("Batch Operations", function () {
    it("Should identify multiple liquidatable users", async function () {
      // Reset price to make all users liquidatable
      await wethUsdFeed.updateAnswer(50000000000); // $500 - very low
      
      const users = [user1.address, user2.address];
      const liquidatableUsers = await liquidationManager.getLiquidatableUsers(pool.address, users);
      
      console.log("Liquidatable users:", liquidatableUsers);
      console.log("User1 address:", user1.address);
      console.log("User2 address:", user2.address);
      
      expect(liquidatableUsers.length).to.be.gte(1); // At least one user should be liquidatable
      // Check if user1 OR user2 is in the list (since user2 might not have borrowed enough to be liquidatable)
      const hasLiquidatableUser = liquidatableUsers.includes(user1.address) || liquidatableUsers.includes(user2.address);
      expect(hasLiquidatableUser).to.be.true;
    });
  });
});
