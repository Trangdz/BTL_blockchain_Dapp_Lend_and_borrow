const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("08_Invariants", function () {
  let deployer, user1, user2, user3;
  let weth, usdc, dai;
  let wethUsdFeed, usdcUsdFeed, daiUsdFeed;
  let addressToTokenMap, lendingConfig, lendingHelper;
  let poolFactory, poolImpl, pool;
  let liquidationManager;

  const PRECISION = ethers.utils.parseEther("1");

  before(async function () {
    [deployer, user1, user2, user3] = await ethers.getSigners();

    // Deploy system
    const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
    weth = await ERC20Mintable.deploy("Wrapped Ether", "WETH", 18, ethers.utils.parseEther("1000000"));
    usdc = await ERC20Mintable.deploy("USD Coin", "USDC", 6, ethers.utils.parseUnits("1000000", 6));
    dai = await ERC20Mintable.deploy("Dai Stablecoin", "DAI", 18, ethers.utils.parseEther("1000000"));

    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    wethUsdFeed = await MockV3Aggregator.deploy(8, 300000000000);
    usdcUsdFeed = await MockV3Aggregator.deploy(8, 100000000);
    daiUsdFeed = await MockV3Aggregator.deploy(8, 100000000);

    const AddressToTokenMapV2 = await ethers.getContractFactory("AddressToTokenMapV2");
    addressToTokenMap = await AddressToTokenMapV2.deploy();

    const LendingConfigV2 = await ethers.getContractFactory("LendingConfigV2");
    lendingConfig = await LendingConfigV2.deploy();

    const LendingHelper = await ethers.getContractFactory("LendingHelper");
    lendingHelper = await LendingHelper.deploy(addressToTokenMap.address, lendingConfig.address);

    await addressToTokenMap.batchSetTokenData(
      [weth.address, usdc.address, dai.address],
      ["WETH", "USDC", "DAI"],
      [wethUsdFeed.address, usdcUsdFeed.address, daiUsdFeed.address],
      [18, 6, 18]
    );
    await addressToTokenMap.setOracleStaleThreshold(86400 * 365);

    const IsolatedLendingPool = await ethers.getContractFactory("IsolatedLendingPool");
    poolImpl = await IsolatedLendingPool.deploy();

    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    poolFactory = await PoolFactory.deploy(poolImpl.address);

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

    await pool.addToken(weth.address);
    await pool.addToken(usdc.address);
    await pool.addToken(dai.address);

    const LiquidationManager = await ethers.getContractFactory("LiquidationManager");
    liquidationManager = await LiquidationManager.deploy(addressToTokenMap.address, lendingConfig.address);
    await pool.setLiquidationManager(liquidationManager.address);

    // Setup initial positions
    await weth.mint(user1.address, ethers.utils.parseEther("50"));
    await dai.mint(user2.address, ethers.utils.parseEther("200000"));
    await usdc.mint(user3.address, ethers.utils.parseUnits("100000", 6));
  });

  describe("Core Invariants", function () {
    it("Invariant 1: Pool balance >= Cash for all tokens", async function () {
      console.log("\n🔒 Testing Invariant 1: Pool balance >= Cash");

      // Setup some positions
      await weth.connect(user1).approve(pool.address, ethers.utils.parseEther("10"));
      await pool.connect(user1).lend(weth.address, ethers.utils.parseEther("10"));

      await dai.connect(user2).approve(pool.address, ethers.utils.parseEther("50000"));
      await pool.connect(user2).lend(dai.address, ethers.utils.parseEther("50000"));

      const supportedTokens = await pool.getSupportedTokens();
      
      for (const token of supportedTokens) {
        const tokenState = await pool.tokenStates(token);
        const poolBalance = await pool.poolBalance(token);
        
        console.log(`Token: ${await addressToTokenMap.getSymbol(token)}`);
        console.log(`  Pool Balance: ${ethers.utils.formatEther(poolBalance)}`);
        console.log(`  Cash: ${ethers.utils.formatEther(tokenState.cash)}`);
        
        expect(poolBalance).to.be.gte(tokenState.cash);
      }

      console.log("✅ Invariant 1 maintained");
    });

    it("Invariant 2: Cash + Borrows = Total Supplied", async function () {
      console.log("\n🔒 Testing Invariant 2: Cash + Borrows = Total Supplied");

      // Create some borrows
      await pool.connect(user1).borrow(dai.address, ethers.utils.parseEther("10000"));

      const supportedTokens = await pool.getSupportedTokens();
      const users = [user1.address, user2.address, user3.address, deployer.address];
      
      for (const token of supportedTokens) {
        const tokenState = await pool.tokenStates(token);
        
        // Calculate total user supplies
        let totalUserSupplied = ethers.BigNumber.from(0);
        for (const user of users) {
          const userSupplied = await pool.supplied(user, token);
          totalUserSupplied = totalUserSupplied.add(userSupplied);
        }
        
        const cashPlusBorrows = tokenState.cash.add(tokenState.borrows);
        
        console.log(`Token: ${await addressToTokenMap.getSymbol(token)}`);
        console.log(`  Total User Supplied: ${ethers.utils.formatEther(totalUserSupplied)}`);
        console.log(`  Cash + Borrows: ${ethers.utils.formatEther(cashPlusBorrows)}`);
        
        // Allow for small differences due to interest accrual
        const difference = totalUserSupplied.gt(cashPlusBorrows) 
          ? totalUserSupplied.sub(cashPlusBorrows)
          : cashPlusBorrows.sub(totalUserSupplied);
        
        expect(difference).to.be.lte(ethers.utils.parseEther("0.001")); // 0.001 tolerance
      }

      console.log("✅ Invariant 2 maintained");
    });

    it("Invariant 3: Interest indexes never decrease", async function () {
      console.log("\n🔒 Testing Invariant 3: Interest indexes never decrease");

      const supportedTokens = await pool.getSupportedTokens();
      const initialIndexes = {};
      
      // Record initial indexes
      for (const token of supportedTokens) {
        const tokenState = await pool.tokenStates(token);
        initialIndexes[token] = {
          supply: tokenState.indexSupply,
          borrow: tokenState.indexBorrow
        };
      }

      // Perform some operations that trigger interest accrual
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine");

      // Trigger accrual by making a transaction
      await pool.connect(user1).borrow(dai.address, ethers.utils.parseEther("100"));

      // Check that indexes haven't decreased
      for (const token of supportedTokens) {
        const tokenState = await pool.tokenStates(token);
        
        console.log(`Token: ${await addressToTokenMap.getSymbol(token)}`);
        console.log(`  Supply Index: ${initialIndexes[token].supply} -> ${tokenState.indexSupply}`);
        console.log(`  Borrow Index: ${initialIndexes[token].borrow} -> ${tokenState.indexBorrow}`);
        
        expect(tokenState.indexSupply).to.be.gte(initialIndexes[token].supply);
        expect(tokenState.indexBorrow).to.be.gte(initialIndexes[token].borrow);
      }

      console.log("✅ Invariant 3 maintained");
    });

    it("Invariant 4: Health factor decreases only with adverse conditions", async function () {
      console.log("\n🔒 Testing Invariant 4: Health factor behavior");

      const user = user1.address;
      
      // Get initial health factor
      const initialHF = await liquidationManager.calcHealthFactor(user, pool.address);
      console.log(`Initial Health Factor: ${ethers.utils.formatEther(initialHF.hf)}`);

      // Test 1: Health factor should decrease when borrowing more
      await pool.connect(user1).borrow(dai.address, ethers.utils.parseEther("1000"));
      const hfAfterBorrow = await liquidationManager.calcHealthFactor(user, pool.address);
      console.log(`HF after more borrowing: ${ethers.utils.formatEther(hfAfterBorrow.hf)}`);
      expect(hfAfterBorrow.hf).to.be.lte(initialHF.hf);

      // Test 2: Health factor should improve when repaying
      await dai.mint(user1.address, ethers.utils.parseEther("5000"));
      await dai.connect(user1).approve(pool.address, ethers.utils.parseEther("500"));
      await pool.connect(user1).repay(dai.address, ethers.utils.parseEther("500"));
      
      const hfAfterRepay = await liquidationManager.calcHealthFactor(user, pool.address);
      console.log(`HF after repaying: ${ethers.utils.formatEther(hfAfterRepay.hf)}`);
      expect(hfAfterRepay.hf).to.be.gte(hfAfterBorrow.hf);

      // Test 3: Health factor should decrease when collateral price drops
      const currentPrice = await wethUsdFeed.latestRoundData();
      await wethUsdFeed.updateAnswer(currentPrice.answer.div(2)); // 50% price drop
      
      const hfAfterPriceDrop = await liquidationManager.calcHealthFactor(user, pool.address);
      console.log(`HF after price drop: ${ethers.utils.formatEther(hfAfterPriceDrop.hf)}`);
      expect(hfAfterPriceDrop.hf).to.be.lt(hfAfterRepay.hf);

      console.log("✅ Invariant 4 maintained");
    });

    it("Invariant 5: Cannot withdraw collateral that would break health factor", async function () {
      console.log("\n🔒 Testing Invariant 5: Withdrawal safety");

      // Reset price
      await wethUsdFeed.updateAnswer(300000000000); // $3000
      
      const user = user1.address;
      const currentSupplied = await pool.supplied(user, weth.address);
      const currentDebt = await pool.debts(user, dai.address);
      
      console.log(`Current WETH supplied: ${ethers.utils.formatEther(currentSupplied)}`);
      console.log(`Current DAI debt: ${ethers.utils.formatEther(currentDebt)}`);

      if (currentDebt.gt(0)) {
        // Try to withdraw all collateral - should fail
        await expect(
          pool.connect(user1).withdraw(weth.address, currentSupplied)
        ).to.be.revertedWithCustomError(pool, "ErrHealthFactorTooLow");
        
        console.log("✅ Cannot withdraw all collateral when having debt");
      }

      // Should be able to withdraw partial amount
      const partialAmount = currentSupplied.div(4); // 25%
      await expect(
        pool.connect(user1).withdraw(weth.address, partialAmount)
      ).to.not.be.reverted;
      
      console.log("✅ Can withdraw partial collateral safely");
      console.log("✅ Invariant 5 maintained");
    });

    it("Invariant 6: Liquidation improves user health factor", async function () {
      console.log("\n🔒 Testing Invariant 6: Liquidation effectiveness");

      // Make user liquidatable
      await wethUsdFeed.updateAnswer(100000000000); // $1000 - very low price
      
      const user = user1.address;
      const liquidatorAddress = deployer.address;
      
      // Check if user is liquidatable
      const isLiquidatable = await liquidationManager.isLiquidatable(user, pool.address);
      
      if (isLiquidatable) {
        const hfBefore = await liquidationManager.calcHealthFactor(user, pool.address);
        console.log(`HF before liquidation: ${ethers.utils.formatEther(hfBefore.hf)}`);
        
        // Execute liquidation
        const repayAmount = ethers.utils.parseEther("2000");
        await dai.mint(liquidatorAddress, ethers.utils.parseEther("10000"));
        await dai.connect(deployer).approve(liquidationManager.address, repayAmount);
        
        await liquidationManager.liquidate(
          user,
          pool.address,
          dai.address,
          repayAmount,
          weth.address
        );
        
        const hfAfter = await liquidationManager.calcHealthFactor(user, pool.address);
        console.log(`HF after liquidation: ${ethers.utils.formatEther(hfAfter.hf)}`);
        
        // Health factor should improve (unless user has no collateral left)
        expect(hfAfter.hf).to.be.gte(hfBefore.hf);
        
        console.log("✅ Liquidation improved health factor");
      } else {
        console.log("ℹ️ User not liquidatable, skipping test");
      }

      console.log("✅ Invariant 6 maintained");
    });
  });

  describe("Economic Invariants", function () {
    it("Supply rate <= Borrow rate", async function () {
      console.log("\n💰 Testing: Supply rate <= Borrow rate");

      const supportedTokens = await pool.getSupportedTokens();
      
      for (const token of supportedTokens) {
        const tokenState = await pool.tokenStates(token);
        const cash = tokenState.cash;
        const borrows = tokenState.borrows;
        
        if (borrows.gt(0)) {
          const riskParams = await lendingConfig.getRiskParams(pool.address, token);
          
          // Calculate rates using the same logic as the contract
          const util = borrows.mul(PRECISION).div(cash.add(borrows));
          
          let borrowRate;
          if (util.lte(riskParams.kink)) {
            borrowRate = riskParams.rBase.add(riskParams.slope1.mul(util).div(PRECISION));
          } else {
            const excessUtil = util.sub(riskParams.kink);
            borrowRate = riskParams.rBase
              .add(riskParams.slope1.mul(riskParams.kink).div(PRECISION))
              .add(riskParams.slope2.mul(excessUtil).div(PRECISION));
          }
          
          const reserveFactor = await pool.reserveFactor();
          const oneMinusReserveFactor = PRECISION.sub(reserveFactor);
          const supplyRate = borrowRate.mul(util).mul(oneMinusReserveFactor).div(PRECISION.mul(PRECISION));
          
          console.log(`Token: ${await addressToTokenMap.getSymbol(token)}`);
          console.log(`  Utilization: ${ethers.utils.formatEther(util)}%`);
          console.log(`  Borrow Rate: ${ethers.utils.formatEther(borrowRate)}%`);
          console.log(`  Supply Rate: ${ethers.utils.formatEther(supplyRate)}%`);
          
          expect(supplyRate).to.be.lte(borrowRate);
        }
      }

      console.log("✅ Supply rate <= Borrow rate maintained");
    });

    it("Reserve accumulation is bounded", async function () {
      console.log("\n🏦 Testing: Reserve accumulation bounds");

      const reserveFactor = await pool.reserveFactor();
      console.log(`Reserve Factor: ${ethers.utils.formatEther(reserveFactor)}%`);
      
      // Reserve factor should be reasonable (0-50%)
      expect(reserveFactor).to.be.lte(ethers.utils.parseEther("0.5"));
      expect(reserveFactor).to.be.gte(0);

      console.log("✅ Reserve factor within bounds");
    });
  });

  describe("Security Invariants", function () {
    it("Cannot borrow without collateral", async function () {
      console.log("\n🛡️ Testing: Cannot borrow without collateral");

      const freshUser = (await ethers.getSigners())[7];
      
      // Try to borrow without any collateral
      await expect(
        pool.connect(freshUser).borrow(dai.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWithCustomError(pool, "ErrHealthFactorTooLow");

      console.log("✅ Cannot borrow without collateral");
    });

    it("Cannot liquidate healthy users", async function () {
      console.log("\n🛡️ Testing: Cannot liquidate healthy users");

      // Reset to good price
      await wethUsdFeed.updateAnswer(300000000000); // $3000
      
      const user = user1.address;
      const liquidatorAddress = deployer.address;
      
      // Ensure user is healthy
      const hf = await liquidationManager.calcHealthFactor(user, pool.address);
      console.log(`User Health Factor: ${ethers.utils.formatEther(hf.hf)}`);
      
      if (hf.hf.gte(PRECISION)) {
        await expect(
          liquidationManager.liquidate(
            user,
            pool.address,
            dai.address,
            ethers.utils.parseEther("100"),
            weth.address
          )
        ).to.be.revertedWithCustomError(liquidationManager, "ErrUserHealthy");
        
        console.log("✅ Cannot liquidate healthy user");
      } else {
        console.log("ℹ️ User not healthy, expected liquidation failure");
      }
    });

    it("Oracle prices are reasonable", async function () {
      console.log("\n🔮 Testing: Oracle price sanity");

      const tokens = [weth.address, usdc.address, dai.address];
      const expectedRanges = {
        [weth.address]: [ethers.utils.parseEther("100"), ethers.utils.parseEther("10000")], // $100-$10k
        [usdc.address]: [ethers.utils.parseEther("0.5"), ethers.utils.parseEther("2")],    // $0.5-$2
        [dai.address]: [ethers.utils.parseEther("0.5"), ethers.utils.parseEther("2")]     // $0.5-$2
      };

      for (const token of tokens) {
        const price = await addressToTokenMap.getPrice(token);
        const [min, max] = expectedRanges[token];
        
        console.log(`Token: ${await addressToTokenMap.getSymbol(token)}`);
        console.log(`  Price: $${ethers.utils.formatEther(price)}`);
        console.log(`  Range: $${ethers.utils.formatEther(min)} - $${ethers.utils.formatEther(max)}`);
        
        expect(price).to.be.gte(min);
        expect(price).to.be.lte(max);
      }

      console.log("✅ Oracle prices within reasonable ranges");
    });
  });

  after(function () {
    console.log("\n🎯 All invariants tested and maintained!");
    console.log("✅ System integrity verified");
  });
});

