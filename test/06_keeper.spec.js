const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("06_Keeper", function () {
  let deployer, user1, user2, keeper;
  let weth, usdc, dai;
  let wethUsdFeed, usdcUsdFeed, daiUsdFeed;
  let addressToTokenMap, lendingConfig, lendingHelper;
  let poolFactory, poolImpl, pool;
  let liquidationManager, keeperAdapter;

  const PRECISION = ethers.utils.parseEther("1"); // 1e18

  before(async function () {
    [deployer, user1, user2, keeper] = await ethers.getSigners();

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

    // Setup risk parameters
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

    // Deploy keeper adapter
    const KeeperAdapter = await ethers.getContractFactory("KeeperAdapter");
    keeperAdapter = await KeeperAdapter.deploy(liquidationManager.address);
    await keeperAdapter.deployed();

    // Set liquidation manager in pool
    await pool.setLiquidationManager(liquidationManager.address);

    // Grant keeper role
    await keeperAdapter.grantKeeperRole(keeper.address);

    // Mint tokens for testing
    await weth.mint(user1.address, ethers.utils.parseEther("10"));
    await dai.mint(user1.address, ethers.utils.parseEther("50000"));
    await dai.mint(deployer.address, ethers.utils.parseEther("100000"));

    // Setup positions
    await weth.connect(user1).approve(pool.address, ethers.utils.parseEther("10"));
    await pool.connect(user1).lend(weth.address, ethers.utils.parseEther("10"));

    await dai.connect(deployer).approve(pool.address, ethers.utils.parseEther("50000"));
    await pool.connect(deployer).lend(dai.address, ethers.utils.parseEther("50000"));

    await pool.connect(user1).borrow(dai.address, ethers.utils.parseEther("20000"));
  });

  describe("Keeper Configuration", function () {
    it("Should have correct initial configuration", async function () {
      expect(await keeperAdapter.checkInterval()).to.equal(300); // 5 minutes
      expect(await keeperAdapter.maxLiquidationsPerUpkeep()).to.equal(5);
      expect(await keeperAdapter.minHealthFactorForLiquidation()).to.equal(PRECISION);
    });

    it("Should allow admin to update configuration", async function () {
      await expect(
        keeperAdapter.updateConfig(
          600, // 10 minutes
          3,   // 3 liquidations max
          ethers.utils.parseEther("0.95") // 0.95 threshold
        )
      ).to.emit(keeperAdapter, "ConfigUpdated");

      expect(await keeperAdapter.checkInterval()).to.equal(600);
      expect(await keeperAdapter.maxLiquidationsPerUpkeep()).to.equal(3);
      expect(await keeperAdapter.minHealthFactorForLiquidation()).to.equal(ethers.utils.parseEther("0.95"));
    });
  });

  describe("User Tracking", function () {
    it("Should add users for tracking", async function () {
      await expect(keeperAdapter.addUser(pool.address, user1.address))
        .to.emit(keeperAdapter, "UserAdded")
        .withArgs(pool.address, user1.address);

      const trackedUsers = await keeperAdapter.getTrackedUsers(pool.address);
      expect(trackedUsers).to.include(user1.address);

      const isTracked = await keeperAdapter.isUserTracked(pool.address, user1.address);
      expect(isTracked).to.be.true;
    });

    it("Should batch add users", async function () {
      const users = [user2.address, keeper.address];
      
      await keeperAdapter.batchAddUsers(pool.address, users);
      
      const trackedUsers = await keeperAdapter.getTrackedUsers(pool.address);
      expect(trackedUsers).to.include(user2.address);
      expect(trackedUsers).to.include(keeper.address);
    });

    it("Should remove users from tracking", async function () {
      await expect(keeperAdapter.removeUser(pool.address, keeper.address))
        .to.emit(keeperAdapter, "UserRemoved")
        .withArgs(pool.address, keeper.address);

      const trackedUsers = await keeperAdapter.getTrackedUsers(pool.address);
      expect(trackedUsers).to.not.include(keeper.address);

      const isTracked = await keeperAdapter.isUserTracked(pool.address, keeper.address);
      expect(isTracked).to.be.false;
    });

    it("Should not add duplicate users", async function () {
      const initialCount = (await keeperAdapter.getTrackedUsers(pool.address)).length;
      
      // Try to add user1 again
      await keeperAdapter.addUser(pool.address, user1.address);
      
      const finalCount = (await keeperAdapter.getTrackedUsers(pool.address)).length;
      expect(finalCount).to.equal(initialCount); // Should remain the same
    });
  });

  describe("Upkeep Functions", function () {
    beforeEach(async function () {
      // Reset configuration for consistent testing
      await keeperAdapter.updateConfig(0, 5, PRECISION); // No time delay for testing
    });

    it("Should return false when no users need liquidation", async function () {
      const pools = [pool.address];
      const checkData = ethers.utils.defaultAbiCoder.encode(["address[]"], [pools]);
      
      const result = await keeperAdapter.checkUpkeep(checkData);
      expect(result.upkeepNeeded).to.be.false;
    });

    it("Should detect liquidatable users", async function () {
      // Drop WETH price to make user1 liquidatable
      await wethUsdFeed.updateAnswer(150000000000); // $1500
      
      const pools = [pool.address];
      const checkData = ethers.utils.defaultAbiCoder.encode(["address[]"], [pools]);
      
      const result = await keeperAdapter.checkUpkeep(checkData);
      expect(result.upkeepNeeded).to.be.true;
      expect(result.performData).to.not.equal("0x");
    });

    it("Should get liquidatable users correctly", async function () {
      // Ensure WETH price is low
      await wethUsdFeed.updateAnswer(100000000000); // $1000
      
      const pools = [pool.address];
      const result = await keeperAdapter.getLiquidatableUsers(pools);
      
      expect(result.users.length).to.be.gte(1);
      expect(result.correspondingPools.length).to.equal(result.users.length);
    });

    it("Should perform upkeep when needed", async function () {
      // Make user liquidatable
      await wethUsdFeed.updateAnswer(100000000000); // $1000
      
      const pools = [pool.address];
      const checkData = ethers.utils.defaultAbiCoder.encode(["address[]"], [pools]);
      
      const checkResult = await keeperAdapter.checkUpkeep(checkData);
      expect(checkResult.upkeepNeeded).to.be.true;
      
      // Perform upkeep
      await expect(keeperAdapter.performUpkeep(checkResult.performData))
        .to.emit(keeperAdapter, "UpkeepPerformed");
      
      // Check that lastUpkeepTime was updated
      const lastUpkeepTime = await keeperAdapter.lastUpkeepTime();
      expect(lastUpkeepTime).to.be.gt(0);
    });

    it("Should respect time interval", async function () {
      // Set check interval to 1 hour
      await keeperAdapter.updateConfig(3600, 5, PRECISION);
      
      const pools = [pool.address];
      const checkData = ethers.utils.defaultAbiCoder.encode(["address[]"], [pools]);
      
      // Should not need upkeep due to time constraint
      const result = await keeperAdapter.checkUpkeep(checkData);
      expect(result.upkeepNeeded).to.be.false;
    });

    it("Should limit liquidations per upkeep", async function () {
      // Set max liquidations to 1
      await keeperAdapter.updateConfig(0, 1, PRECISION);
      
      // Add multiple users that would be liquidatable
      const moreUsers = (await ethers.getSigners()).slice(4, 7).map(s => s.address);
      await keeperAdapter.batchAddUsers(pool.address, moreUsers);
      
      // Make users liquidatable
      await wethUsdFeed.updateAnswer(50000000000); // $500
      
      const pools = [pool.address];
      const checkData = ethers.utils.defaultAbiCoder.encode(["address[]"], [pools]);
      
      const result = await keeperAdapter.checkUpkeep(checkData);
      if (result.upkeepNeeded) {
        const [users] = ethers.utils.defaultAbiCoder.decode(["address[]", "address[]"], result.performData);
        expect(users.length).to.be.lte(1); // Should be limited to 1
      }
    });
  });

  describe("Access Control", function () {
    it("Should only allow admin to add users", async function () {
      await expect(
        keeperAdapter.connect(user1).addUser(pool.address, user2.address)
      ).to.be.reverted; // Access control will revert
    });

    it("Should only allow admin to update config", async function () {
      await expect(
        keeperAdapter.connect(user1).updateConfig(600, 3, PRECISION)
      ).to.be.reverted; // Access control will revert
    });

    it("Should allow admin to grant keeper role", async function () {
      const newKeeper = (await ethers.getSigners())[5];
      
      await keeperAdapter.grantKeeperRole(newKeeper.address);
      
      const hasRole = await keeperAdapter.hasRole(
        await keeperAdapter.KEEPER_ROLE(),
        newKeeper.address
      );
      expect(hasRole).to.be.true;
    });

    it("Should allow admin to revoke keeper role", async function () {
      await keeperAdapter.revokeKeeperRole(keeper.address);
      
      const hasRole = await keeperAdapter.hasRole(
        await keeperAdapter.KEEPER_ROLE(),
        keeper.address
      );
      expect(hasRole).to.be.false;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty pool array", async function () {
      const pools = [];
      const checkData = ethers.utils.defaultAbiCoder.encode(["address[]"], [pools]);
      
      const result = await keeperAdapter.checkUpkeep(checkData);
      expect(result.upkeepNeeded).to.be.false;
    });

    it("Should handle pool with no tracked users", async function () {
      // Deploy another pool
      const poolParams = {
        addressToTokenMap: addressToTokenMap.address,
        lendingConfig: lendingConfig.address,
        lendingHelper: lendingHelper.address,
        reserveFactor: ethers.utils.parseEther("0.1"),
        liquidationBonus: ethers.utils.parseEther("0.05")
      };

      const tx = await poolFactory.createPool(ethers.utils.formatBytes32String("TEST"), poolParams);
      const receipt = await tx.wait();
      const poolCreatedEvent = receipt.events.find(e => e.event === "PoolCreated");
      const emptyPoolAddress = poolCreatedEvent.args.pool;
      
      const pools = [emptyPoolAddress];
      const checkData = ethers.utils.defaultAbiCoder.encode(["address[]"], [pools]);
      
      const result = await keeperAdapter.checkUpkeep(checkData);
      expect(result.upkeepNeeded).to.be.false;
    });

    it("Should handle invalid performData", async function () {
      const invalidData = "0x1234";
      
      // Invalid data should cause a revert due to ABI decoding failure
      await expect(keeperAdapter.performUpkeep(invalidData))
        .to.be.reverted;
    });
  });
});
