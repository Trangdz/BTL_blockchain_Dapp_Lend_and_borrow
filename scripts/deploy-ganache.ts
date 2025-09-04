import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

interface DeployedContracts {
  mockTokens: {
    WETH: string;
    USDC: string;
    DAI: string;
  };
  oracles: {
    WETH_USD: string;
    USDC_USD: string;
    DAI_USD: string;
  };
  core: {
    AddressToTokenMapV2: string;
    LendingConfigV2: string;
    LendingHelper: string;
    PoolFactory: string;
    IsolatedLendingPoolImpl: string;
    LiquidationManager: string;
    KeeperAdapter: string;
  };
  pools: {
    CORE: string;
  };
}

async function main() {
  console.log("🚀 Deploying LendHub v2 to Ganache...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

  const deployed: DeployedContracts = {
    mockTokens: { WETH: "", USDC: "", DAI: "" },
    oracles: { WETH_USD: "", USDC_USD: "", DAI_USD: "" },
    core: {
      AddressToTokenMapV2: "",
      LendingConfigV2: "",
      LendingHelper: "",
      PoolFactory: "",
      IsolatedLendingPoolImpl: "",
      LiquidationManager: "",
      KeeperAdapter: ""
    },
    pools: { CORE: "" }
  };

  // 1. Deploy Mock Tokens
  console.log("\n📄 Deploying Mock Tokens...");
  
  const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
  
  // WETH (18 decimals)
  const weth = await ERC20Mintable.deploy(
    "Wrapped Ether",
    "WETH",
    18,
    ethers.utils.parseEther("1000000") // 1M WETH
  );
  await weth.deployed();
  deployed.mockTokens.WETH = weth.address;
  console.log("WETH deployed to:", weth.address);

  // USDC (6 decimals)
  const usdc = await ERC20Mintable.deploy(
    "USD Coin",
    "USDC",
    6,
    ethers.utils.parseUnits("1000000", 6) // 1M USDC
  );
  await usdc.deployed();
  deployed.mockTokens.USDC = usdc.address;
  console.log("USDC deployed to:", usdc.address);

  // DAI (18 decimals)
  const dai = await ERC20Mintable.deploy(
    "Dai Stablecoin",
    "DAI",
    18,
    ethers.utils.parseEther("1000000") // 1M DAI
  );
  await dai.deployed();
  deployed.mockTokens.DAI = dai.address;
  console.log("DAI deployed to:", dai.address);

  // 2. Deploy Mock Price Feeds
  console.log("\n🔮 Deploying Mock Price Feeds...");
  
  const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
  
  // WETH/USD: $3000 (8 decimals)
  const wethUsdFeed = await MockV3Aggregator.deploy(8, 300000000000); // $3000
  await wethUsdFeed.deployed();
  deployed.oracles.WETH_USD = wethUsdFeed.address;
  console.log("WETH/USD feed deployed to:", wethUsdFeed.address);

  // USDC/USD: $1 (8 decimals)
  const usdcUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1
  await usdcUsdFeed.deployed();
  deployed.oracles.USDC_USD = usdcUsdFeed.address;
  console.log("USDC/USD feed deployed to:", usdcUsdFeed.address);

  // DAI/USD: $1 (8 decimals)
  const daiUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1
  await daiUsdFeed.deployed();
  deployed.oracles.DAI_USD = daiUsdFeed.address;
  console.log("DAI/USD feed deployed to:", daiUsdFeed.address);

  // 3. Deploy Core Contracts
  console.log("\n🏗️ Deploying Core Contracts...");

  // AddressToTokenMapV2
  const AddressToTokenMapV2 = await ethers.getContractFactory("AddressToTokenMapV2");
  const addressToTokenMap = await AddressToTokenMapV2.deploy();
  await addressToTokenMap.deployed();
  deployed.core.AddressToTokenMapV2 = addressToTokenMap.address;
  console.log("AddressToTokenMapV2 deployed to:", addressToTokenMap.address);

  // LendingConfigV2
  const LendingConfigV2 = await ethers.getContractFactory("LendingConfigV2");
  const lendingConfig = await LendingConfigV2.deploy();
  await lendingConfig.deployed();
  deployed.core.LendingConfigV2 = lendingConfig.address;
  console.log("LendingConfigV2 deployed to:", lendingConfig.address);

  // LendingHelper (reuse existing)
  const LendingHelper = await ethers.getContractFactory("LendingHelper");
  const lendingHelper = await LendingHelper.deploy(
    addressToTokenMap.address,
    lendingConfig.address
  );
  await lendingHelper.deployed();
  deployed.core.LendingHelper = lendingHelper.address;
  console.log("LendingHelper deployed to:", lendingHelper.address);

  // 4. Setup Token Mappings
  console.log("\n🔗 Setting up Token Mappings...");
  
  await addressToTokenMap.batchSetTokenData(
    [deployed.mockTokens.WETH, deployed.mockTokens.USDC, deployed.mockTokens.DAI],
    ["WETH", "USDC", "DAI"],
    [deployed.oracles.WETH_USD, deployed.oracles.USDC_USD, deployed.oracles.DAI_USD],
    [18, 6, 18]
  );
  console.log("Token mappings configured");

  // 5. Deploy Pool Infrastructure
  console.log("\n🏊 Deploying Pool Infrastructure...");
  
  // Deploy IsolatedLendingPool implementation
  const IsolatedLendingPool = await ethers.getContractFactory("IsolatedLendingPool");
  const poolImpl = await IsolatedLendingPool.deploy();
  await poolImpl.deployed();
  deployed.core.IsolatedLendingPoolImpl = poolImpl.address;
  console.log("IsolatedLendingPool implementation deployed to:", poolImpl.address);

  // Deploy PoolFactory
  const PoolFactory = await ethers.getContractFactory("PoolFactory");
  const poolFactory = await PoolFactory.deploy(poolImpl.address);
  await poolFactory.deployed();
  deployed.core.PoolFactory = poolFactory.address;
  console.log("PoolFactory deployed to:", poolFactory.address);

  // Deploy LiquidationManager
  const LiquidationManager = await ethers.getContractFactory("LiquidationManager");
  const liquidationManager = await LiquidationManager.deploy(
    addressToTokenMap.address,
    lendingConfig.address
  );
  await liquidationManager.deployed();
  deployed.core.LiquidationManager = liquidationManager.address;
  console.log("LiquidationManager deployed to:", liquidationManager.address);

  // Deploy KeeperAdapter
  const KeeperAdapter = await ethers.getContractFactory("KeeperAdapter");
  const keeperAdapter = await KeeperAdapter.deploy(liquidationManager.address);
  await keeperAdapter.deployed();
  deployed.core.KeeperAdapter = keeperAdapter.address;
  console.log("KeeperAdapter deployed to:", keeperAdapter.address);

  // 6. Create CORE Pool
  console.log("\n🏊 Creating CORE Pool...");
  
  const poolParams = {
    addressToTokenMap: addressToTokenMap.address,
    lendingConfig: lendingConfig.address,
    lendingHelper: lendingHelper.address,
    reserveFactor: ethers.utils.parseEther("0.1"), // 10%
    liquidationBonus: ethers.utils.parseEther("0.05") // 5%
  };

  const createPoolTx = await poolFactory.createPool(
    ethers.utils.formatBytes32String("CORE"),
    poolParams
  );
  const receipt = await createPoolTx.wait();
  
  const poolCreatedEvent = receipt.events?.find(e => e.event === "PoolCreated");
  const corePoolAddress = poolCreatedEvent?.args?.pool;
  deployed.pools.CORE = corePoolAddress;
  console.log("CORE Pool created at:", corePoolAddress);

  // 7. Setup Risk Parameters
  console.log("\n⚠️ Setting up Risk Parameters...");
  
  const riskParams = {
    LTV: ethers.utils.parseEther("0.8"),      // 80% LTV
    LT: ethers.utils.parseEther("0.85"),      // 85% Liquidation Threshold
    kink: ethers.utils.parseEther("0.8"),     // 80% kink
    rBase: ethers.utils.parseEther("0.02"),   // 2% base rate
    slope1: ethers.utils.parseEther("0.05"),  // 5% slope1
    slope2: ethers.utils.parseEther("0.25")   // 25% slope2
  };

  await lendingConfig.batchSetRiskParams(
    corePoolAddress,
    [deployed.mockTokens.WETH, deployed.mockTokens.USDC, deployed.mockTokens.DAI],
    [riskParams, riskParams, riskParams]
  );
  console.log("Risk parameters configured");

  // 8. Add tokens to pool and configure
  console.log("\n🪙 Adding tokens to pool...");
  
  const corePool = await ethers.getContractAt("IsolatedLendingPool", corePoolAddress);
  await corePool.addToken(deployed.mockTokens.WETH);
  await corePool.addToken(deployed.mockTokens.USDC);
  await corePool.addToken(deployed.mockTokens.DAI);
  console.log("Tokens added to pool");

  // Set liquidation manager
  await corePool.setLiquidationManager(liquidationManager.address);
  console.log("Liquidation manager configured");
  
  // Save deployment info
  const artifactsDir = path.join(__dirname, "..", "artifacts", "config");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const configPath = path.join(artifactsDir, "ganache.json");
  fs.writeFileSync(configPath, JSON.stringify(deployed, null, 2));

  // Update addresses-ganache.js for frontend
  const addressesContent = `// LendHub v2 - Ganache Deployment Addresses
// Auto-generated by deploy-ganache.ts

const addresses = {
  // Mock Tokens
  WETH: "${deployed.mockTokens.WETH}",
  USDC: "${deployed.mockTokens.USDC}",
  DAI: "${deployed.mockTokens.DAI}",
  
  // Oracles
  WETH_USD_FEED: "${deployed.oracles.WETH_USD}",
  USDC_USD_FEED: "${deployed.oracles.USDC_USD}",
  DAI_USD_FEED: "${deployed.oracles.DAI_USD}",
  
  // Core Contracts
  AddressToTokenMapV2: "${deployed.core.AddressToTokenMapV2}",
  LendingConfigV2: "${deployed.core.LendingConfigV2}",
  LendingHelper: "${deployed.core.LendingHelper}",
  
  // Pool Infrastructure
  PoolFactory: "${deployed.core.PoolFactory}",
  IsolatedLendingPoolImpl: "${deployed.core.IsolatedLendingPoolImpl}",
  
  // Risk Management
  LiquidationManager: "${deployed.core.LiquidationManager}",
  KeeperAdapter: "${deployed.core.KeeperAdapter}",
  
  // Pools
  CORE_POOL: "${deployed.pools.CORE}",
};

// Legacy addresses for backward compatibility
export const ETHAddress = "0x0000000000000000000000000000000000000000";
export const LendingPoolAddress = addresses.CORE_POOL;
export const LendingHelperAddress = addresses.LendingHelper;

export default addresses;`;

  const addressesPath = path.join(__dirname, "..", "addresses-ganache.js");
  fs.writeFileSync(addressesPath, addressesContent);
  
  console.log("\n✅ Deployment completed!");
  console.log("📁 Configuration saved to:", configPath);
  console.log("📁 Frontend addresses updated:", addressesPath);
  
  // Print summary
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("Mock Tokens:");
  console.log(`  WETH: ${deployed.mockTokens.WETH}`);
  console.log(`  USDC: ${deployed.mockTokens.USDC}`);
  console.log(`  DAI:  ${deployed.mockTokens.DAI}`);
  console.log("\nPrice Feeds:");
  console.log(`  WETH/USD: ${deployed.oracles.WETH_USD}`);
  console.log(`  USDC/USD: ${deployed.oracles.USDC_USD}`);
  console.log(`  DAI/USD:  ${deployed.oracles.DAI_USD}`);
  console.log("\nCore Contracts:");
  console.log(`  AddressToTokenMapV2: ${deployed.core.AddressToTokenMapV2}`);
  console.log(`  LendingConfigV2:     ${deployed.core.LendingConfigV2}`);
  console.log(`  LendingHelper:       ${deployed.core.LendingHelper}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
