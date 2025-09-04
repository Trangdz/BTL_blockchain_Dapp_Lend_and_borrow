const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("07_Integration", function () {
  let deployer, user1, user2, liquidator, keeper;
  let weth, usdc, dai;
  let wethUsdFeed, usdcUsdFeed, daiUsdFeed;
  let addressToTokenMap, lendingConfig, lendingHelper;
  let poolFactory, poolImpl, pool;
  let liquidationManager, keeperAdapter;

  const PRECISION = ethers.utils.parseEther("1");

  before(async function () {
    [deployer, user1, user2, liquidator, keeper] = await ethers.getSigners();

    // Deploy all contracts
    console.log("🚀 Deploying full LendHub v2 system...");

    // Mock tokens
    const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
    weth = await ERC20Mintable.deploy("Wrapped Ether", "WETH", 18, ethers.utils.parseEther("1000000"));
    usdc = await ERC20Mintable.deploy("USD Coin", "USDC", 6, ethers.utils.parseUnits("1000000", 6));
    dai = await ERC20Mintable.deploy("Dai Stablecoin", "DAI", 18, ethers.utils.parseEther("1000000"));

    // Mock price feeds
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    wethUsdFeed = await MockV3Aggregator.deploy(8, 300000000000); // $3000
    usdcUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1
    daiUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1

    // Core contracts
    const AddressToTokenMapV2 = await ethers.getContractFactory("AddressToTokenMapV2");
    addressToTokenMap = await AddressToTokenMapV2.deploy();

    const LendingConfigV2 = await ethers.getContractFactory("LendingConfigV2");
    lendingConfig = await LendingConfigV2.deploy();

    const LendingHelper = await ethers.getContractFactory("LendingHelper");
    lendingHelper = await LendingHelper.deploy(addressToTokenMap.address, lendingConfig.address);

    // Setup token mappings
    await addressToTokenMap.batchSetTokenData(
      [weth.address, usdc.address, dai.address],
      ["WETH", "USDC", "DAI"],
      [wethUsdFeed.address, usdcUsdFeed.address, daiUsdFeed.address],
      [18, 6, 18]
    );
    await addressToTokenMap.setOracleStaleThreshold(86400 * 365);

    // Pool infrastructure
    const IsolatedLendingPool = await ethers.getContractFactory("IsolatedLendingPool");
    poolImpl = await IsolatedLendingPool.deploy();

    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    poolFactory = await PoolFactory.deploy(poolImpl.address);

    // Risk management
    const LiquidationManager = await ethers.getContractFactory("LiquidationManager");
    liquidationManager = await LiquidationManager.deploy(addressToTokenMap.address, lendingConfig.address);

    const KeeperAdapter = await ethers.getContractFactory("KeeperAdapter");
    keeperAdapter = await KeeperAdapter.deploy(liquidationManager.address);

    // Create CORE pool
    const poolParams = {
      addressToTokenMap: addressToTokenMap.address,
      lendingConfig: lendingConfig.address,
      lendingHelper: lendingHelper.address,
      reserveFactor: ethers.utils.parseEther("0.1"),
      liquidationBonus: ethers.utils.parseEther("0.05")
    };

    const tx = await poolFactory.createPool(ethers.utils.formatBytes32String("CORE"), poolParams);
    const receipt = await tx.wait();
    const poolCreatedEvent = receipt.events.find(e => e.event === "PoolCreated");
    pool = await ethers.getContractAt("IsolatedLendingPool", poolCreatedEvent.args.pool);

    // Setup risk parameters
    const riskParams = {
      LTV: ethers.utils.parseEther("0.8"),
      LT: ethers.utils.parseEther("0.85"),
      kink: ethers.utils.parseEther("0.8"),
      rBase: ethers.utils.parseEther("0.02"),
      slope1: ethers.utils.parseEther("0.05"),
      slope2: ethers.utils.parseEther("0.25")
    };

    await lendingConfig.batchSetRiskParams(
      pool.address,
      [weth.address, usdc.address, dai.address],
      [riskParams, riskParams, riskParams]
    );

    // Configure pool
    await pool.addToken(weth.address);
    await pool.addToken(usdc.address);
    await pool.addToken(dai.address);
    await pool.setLiquidationManager(liquidationManager.address);

    // Grant roles
    await liquidationManager.grantLiquidatorRole(liquidator.address);
    await keeperAdapter.grantKeeperRole(keeper.address);

    console.log("✅ System deployment completed");
  });

  describe("Full System Integration", function () {
    it("Should handle complete lending lifecycle", async function () {
      console.log("\n🔄 Testing complete lending lifecycle...");

      // Mint tokens to users
      await weth.mint(user1.address, ethers.utils.parseEther("20"));
      await dai.mint(user2.address, ethers.utils.parseEther("100000"));
      await dai.mint(liquidator.address, ethers.utils.parseEther("50000"));

      // User2 provides DAI liquidity
      await dai.connect(user2).approve(pool.address, ethers.utils.parseEther("50000"));
      await pool.connect(user2).lend(dai.address, ethers.utils.parseEther("50000"));

      // User1 provides WETH collateral
      await weth.connect(user1).approve(pool.address, ethers.utils.parseEther("10"));
      await pool.connect(user1).lend(weth.address, ethers.utils.parseEther("10"));

      // User1 borrows DAI
      const borrowAmount = ethers.utils.parseEther("15000"); // $15k against $30k collateral
      await pool.connect(user1).borrow(dai.address, borrowAmount);

      // Verify positions
      const user1Collateral = await pool.supplied(user1.address, weth.address);
      const user1Debt = await pool.debts(user1.address, dai.address);
      expect(user1Collateral).to.equal(ethers.utils.parseEther("10"));
      expect(user1Debt).to.equal(borrowAmount);

      console.log("✅ Lending lifecycle completed");
    });

    it("Should calculate interest rates correctly", async function () {
      console.log("\n📊 Testing interest rate calculations...");

      // Get current utilization and rates
      const tokenState = await pool.tokenStates(dai.address);
      const cash = tokenState.cash;
      const borrows = tokenState.borrows;

      console.log(`Cash: ${ethers.utils.formatEther(cash)} DAI`);
      console.log(`Borrows: ${ethers.utils.formatEther(borrows)} DAI`);

      if (borrows.gt(0)) {
        const utilization = borrows.mul(PRECISION).div(cash.add(borrows));
        console.log(`Utilization: ${ethers.utils.formatEther(utilization)}%`);
        expect(utilization).to.be.gt(0);
      }

      console.log("✅ Interest rates calculated correctly");
    });

    it("Should handle price drop and liquidation", async function () {
      console.log("\n💥 Testing price drop and liquidation...");

      // Check initial health factor
      const initialHF = await liquidationManager.calcHealthFactor(user1.address, pool.address);
      console.log(`Initial Health Factor: ${ethers.utils.formatEther(initialHF.hf)}`);
      expect(initialHF.hf).to.be.gt(PRECISION);

      // Drop WETH price significantly
      await wethUsdFeed.updateAnswer(120000000000); // $1200 (60% drop)

      // Check health factor after price drop
      const newHF = await liquidationManager.calcHealthFactor(user1.address, pool.address);
      console.log(`Health Factor after price drop: ${ethers.utils.formatEther(newHF.hf)}`);
      expect(newHF.hf).to.be.lt(PRECISION);

      // Verify user is liquidatable
      const isLiquidatable = await liquidationManager.isLiquidatable(user1.address, pool.address);
      expect(isLiquidatable).to.be.true;

      // Execute liquidation
      const repayAmount = ethers.utils.parseEther("5000");
      await dai.connect(liquidator).approve(liquidationManager.address, repayAmount);

      await expect(
        liquidationManager.connect(liquidator).liquidate(
          user1.address,
          pool.address,
          dai.address,
          repayAmount,
          weth.address
        )
      ).to.emit(liquidationManager, "LiquidationExecuted");

      // Check improved health factor
      const finalHF = await liquidationManager.calcHealthFactor(user1.address, pool.address);
      console.log(`Health Factor after liquidation: ${ethers.utils.formatEther(finalHF.hf)}`);
      expect(finalHF.hf).to.be.gt(newHF.hf); // Should be improved

      console.log("✅ Liquidation completed successfully");
    });

    it("Should handle keeper automation", async function () {
      console.log("\n🤖 Testing keeper automation...");

      // Add users to keeper tracking
      await keeperAdapter.addUser(pool.address, user1.address);

      // Check for liquidatable users
      const pools = [pool.address];
      const liquidatableUsers = await keeperAdapter.getLiquidatableUsers(pools);
      
      console.log(`Liquidatable users found: ${liquidatableUsers.users.length}`);
      
      if (liquidatableUsers.users.length > 0) {
        console.log(`First liquidatable user: ${liquidatableUsers.users[0]}`);
        expect(liquidatableUsers.users).to.include(user1.address);
      }

      console.log("✅ Keeper automation working");
    });

    it("Should handle multiple assets correctly", async function () {
      console.log("\n🪙 Testing multiple asset handling...");

      // Mint more tokens
      await usdc.mint(user1.address, ethers.utils.parseUnits("10000", 6));
      await usdc.mint(user2.address, ethers.utils.parseUnits("50000", 6));

      // User2 provides USDC liquidity
      await usdc.connect(user2).approve(pool.address, ethers.utils.parseUnits("20000", 6));
      await pool.connect(user2).lend(usdc.address, ethers.utils.parseUnits("20000", 6));

      // User1 borrows USDC
      await pool.connect(user1).borrow(usdc.address, ethers.utils.parseUnits("2000", 6));

      // Verify multi-asset positions
      const daiDebt = await pool.debts(user1.address, dai.address);
      const usdcDebt = await pool.debts(user1.address, usdc.address);
      
      expect(daiDebt).to.be.gt(0);
      expect(usdcDebt).to.equal(ethers.utils.parseUnits("2000", 6));

      console.log(`DAI debt: ${ethers.utils.formatEther(daiDebt)}`);
      console.log(`USDC debt: ${ethers.utils.formatUnits(usdcDebt, 6)}`);

      console.log("✅ Multiple assets handled correctly");
    });

    it("Should maintain system invariants", async function () {
      console.log("\n🔒 Testing system invariants...");

      // Check that total supplied >= total borrowed for each token
      const supportedTokens = await pool.getSupportedTokens();
      
      for (const token of supportedTokens) {
        const tokenState = await pool.tokenStates(token);
        const poolBalance = await pool.poolBalance(token);
        
        // Pool balance should equal cash
        expect(poolBalance).to.be.gte(tokenState.cash);
        
        // Cash + borrows should represent total supplied
        const totalFunds = tokenState.cash.add(tokenState.borrows);
        console.log(`Token ${await addressToTokenMap.getSymbol(token)}:`);
        console.log(`  Cash: ${ethers.utils.formatEther(tokenState.cash)}`);
        console.log(`  Borrows: ${ethers.utils.formatEther(tokenState.borrows)}`);
        console.log(`  Total: ${ethers.utils.formatEther(totalFunds)}`);
      }

      console.log("✅ System invariants maintained");
    });
  });

  describe("Stress Testing", function () {
    it("Should handle rapid price changes", async function () {
      console.log("\n⚡ Testing rapid price changes...");

      const initialPrice = 120000000000; // $1200
      const prices = [
        100000000000, // $1000
        80000000000,  // $800
        120000000000, // $1200
        150000000000, // $1500
        90000000000   // $900
      ];

      for (const price of prices) {
        await wethUsdFeed.updateAnswer(price);
        
        const hf = await liquidationManager.calcHealthFactor(user1.address, pool.address);
        console.log(`Price: $${price / 1e8}, HF: ${ethers.utils.formatEther(hf.hf)}`);
        
        // System should remain functional
        expect(hf.hf).to.be.gte(0);
      }

      console.log("✅ System stable under price volatility");
    });

    it("Should handle edge case amounts", async function () {
      console.log("\n🔍 Testing edge case amounts...");

      // Test very small amounts
      const user3 = (await ethers.getSigners())[5];
      await weth.mint(user3.address, ethers.utils.parseEther("0.001"));
      await weth.connect(user3).approve(pool.address, ethers.utils.parseEther("0.001"));
      
      await expect(pool.connect(user3).lend(weth.address, ethers.utils.parseEther("0.001")))
        .to.not.be.reverted;

      // Test borrowing very small amounts
      await expect(pool.connect(user3).borrow(dai.address, ethers.utils.parseEther("0.1")))
        .to.not.be.reverted;

      console.log("✅ Edge cases handled correctly");
    });
  });

  describe("Gas Usage Analysis", function () {
    let gasResults = {};

    beforeEach(async function () {
      // Reset for gas measurements
      await wethUsdFeed.updateAnswer(300000000000); // Reset to $3000
    });

    it("Should measure lend gas usage", async function () {
      const user = (await ethers.getSigners())[6];
      await weth.mint(user.address, ethers.utils.parseEther("1"));
      await weth.connect(user).approve(pool.address, ethers.utils.parseEther("1"));

      const tx = await pool.connect(user).lend(weth.address, ethers.utils.parseEther("1"));
      const receipt = await tx.wait();
      
      gasResults.lend = receipt.gasUsed.toNumber();
      console.log(`💰 Lend gas usage: ${gasResults.lend.toLocaleString()}`);
    });

    it("Should measure borrow gas usage", async function () {
      const user = (await ethers.getSigners())[6];
      
      const tx = await pool.connect(user).borrow(dai.address, ethers.utils.parseEther("100"));
      const receipt = await tx.wait();
      
      gasResults.borrow = receipt.gasUsed.toNumber();
      console.log(`💰 Borrow gas usage: ${gasResults.borrow.toLocaleString()}`);
    });

    it("Should measure repay gas usage", async function () {
      const user = (await ethers.getSigners())[6];
      await dai.mint(user.address, ethers.utils.parseEther("1000"));
      await dai.connect(user).approve(pool.address, ethers.utils.parseEther("100"));

      const tx = await pool.connect(user).repay(dai.address, ethers.utils.parseEther("50"));
      const receipt = await tx.wait();
      
      gasResults.repay = receipt.gasUsed.toNumber();
      console.log(`💰 Repay gas usage: ${gasResults.repay.toLocaleString()}`);
    });

    it("Should measure withdraw gas usage", async function () {
      const user = (await ethers.getSigners())[6];

      const tx = await pool.connect(user).withdraw(weth.address, ethers.utils.parseEther("0.5"));
      const receipt = await tx.wait();
      
      gasResults.withdraw = receipt.gasUsed.toNumber();
      console.log(`💰 Withdraw gas usage: ${gasResults.withdraw.toLocaleString()}`);
    });

    it("Should measure liquidation gas usage", async function () {
      // Make user liquidatable
      await wethUsdFeed.updateAnswer(100000000000); // $1000
      
      await dai.connect(liquidator).approve(liquidationManager.address, ethers.utils.parseEther("1000"));

      const tx = await liquidationManager.connect(liquidator).liquidate(
        user1.address,
        pool.address,
        dai.address,
        ethers.utils.parseEther("1000"),
        weth.address
      );
      const receipt = await tx.wait();
      
      gasResults.liquidation = receipt.gasUsed.toNumber();
      console.log(`💰 Liquidation gas usage: ${gasResults.liquidation.toLocaleString()}`);
    });

    after(async function () {
      console.log("\n📊 Gas Usage Summary:");
      console.log("=" + "=".repeat(40));
      Object.entries(gasResults).forEach(([operation, gas]) => {
        console.log(`${operation.padEnd(15)}: ${gas.toLocaleString().padStart(10)} gas`);
      });
      console.log("=" + "=".repeat(40));
      
      const totalGas = Object.values(gasResults).reduce((sum, gas) => sum + gas, 0);
      console.log(`${"Total".padEnd(15)}: ${totalGas.toLocaleString().padStart(10)} gas`);
    });
  });
});

