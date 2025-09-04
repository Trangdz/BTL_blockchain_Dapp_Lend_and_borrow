const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  CHECK_INTERVAL: 30000, // 30 seconds
  MAX_LIQUIDATIONS_PER_RUN: 5,
  MIN_HEALTH_FACTOR: ethers.utils.parseEther("1.0"), // 1.0
  GAS_LIMIT: 500000,
  MAX_FEE_PER_GAS: ethers.utils.parseUnits("20", "gwei"),
  MAX_PRIORITY_FEE_PER_GAS: ethers.utils.parseUnits("2", "gwei")
};

// Global state
let isRunning = false;
let contracts = {};
let signer;

/**
 * Load deployed contract addresses and initialize contracts
 */
async function loadContracts() {
  try {
    const configPath = path.join(__dirname, "..", "artifacts", "config", "ganache.json");
    
    if (!fs.existsSync(configPath)) {
      console.error("❌ Config file not found. Please deploy contracts first.");
      process.exit(1);
    }

    const deployedContracts = JSON.parse(fs.readFileSync(configPath, "utf8"));
    
    // Get signer (liquidator account)
    const accounts = await ethers.getSigners();
    signer = accounts[1]; // Use second account as liquidator
    
    console.log("🤖 Liquidator account:", signer.address);
    console.log("💰 Liquidator balance:", ethers.utils.formatEther(await signer.getBalance()), "ETH");

    // Initialize contract instances
    contracts.addressToTokenMap = await ethers.getContractAt(
      "AddressToTokenMapV2", 
      deployedContracts.core.AddressToTokenMapV2,
      signer
    );

    contracts.lendingConfig = await ethers.getContractAt(
      "LendingConfigV2", 
      deployedContracts.core.LendingConfigV2,
      signer
    );

    contracts.liquidationManager = await ethers.getContractAt(
      "LiquidationManager", 
      deployedContracts.core.LiquidationManager,
      signer
    );

    contracts.keeperAdapter = await ethers.getContractAt(
      "KeeperAdapter", 
      deployedContracts.core.KeeperAdapter,
      signer
    );

    contracts.pool = await ethers.getContractAt(
      "IsolatedLendingPool", 
      deployedContracts.pools.CORE,
      signer
    );

    // Initialize token contracts
    contracts.tokens = {};
    contracts.tokens.WETH = await ethers.getContractAt(
      "ERC20Mintable", 
      deployedContracts.mockTokens.WETH,
      signer
    );
    contracts.tokens.USDC = await ethers.getContractAt(
      "ERC20Mintable", 
      deployedContracts.mockTokens.USDC,
      signer
    );
    contracts.tokens.DAI = await ethers.getContractAt(
      "ERC20Mintable", 
      deployedContracts.mockTokens.DAI,
      signer
    );

    console.log("✅ Contracts loaded successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to load contracts:", error.message);
    return false;
  }
}

/**
 * Check for liquidatable users in the pool
 */
async function checkLiquidatableUsers() {
  try {
    const poolAddress = contracts.pool.address;
    const trackedUsers = await contracts.keeperAdapter.getTrackedUsers(poolAddress);
    
    if (trackedUsers.length === 0) {
      console.log("📊 No users being tracked");
      return [];
    }

    console.log(`📊 Checking ${trackedUsers.length} tracked users...`);

    const liquidatableUsers = [];
    
    for (const user of trackedUsers) {
      try {
        const isLiquidatable = await contracts.liquidationManager.isLiquidatable(user, poolAddress);
        
        if (isLiquidatable) {
          const result = await contracts.liquidationManager.calcHealthFactor(user, poolAddress);
          const healthFactor = result.hf;
          const collateralUSD = result.collateralUSD;
          const borrowUSD = result.borrowUSD;
          
          liquidatableUsers.push({
            user,
            healthFactor: ethers.utils.formatEther(healthFactor),
            collateralUSD: ethers.utils.formatEther(collateralUSD),
            borrowUSD: ethers.utils.formatEther(borrowUSD)
          });
          
          console.log(`🚨 User ${user} is liquidatable:`);
          console.log(`   Health Factor: ${ethers.utils.formatEther(healthFactor)}`);
          console.log(`   Collateral: $${ethers.utils.formatEther(collateralUSD)}`);
          console.log(`   Debt: $${ethers.utils.formatEther(borrowUSD)}`);
        }
      } catch (error) {
        console.error(`❌ Error checking user ${user}:`, error.message);
      }
    }
    
    return liquidatableUsers;
  } catch (error) {
    console.error("❌ Error checking liquidatable users:", error.message);
    return [];
  }
}

/**
 * Execute liquidation for a user
 */
async function executeLiquidation(userInfo) {
  try {
    const { user } = userInfo;
    const poolAddress = contracts.pool.address;
    
    console.log(`🔧 Attempting to liquidate user ${user}...`);
    
    // Get user's positions
    const supportedTokens = await contracts.pool.getSupportedTokens();
    let debtToken = null;
    let collateralToken = null;
    let maxDebt = ethers.constants.Zero;
    let maxCollateral = ethers.constants.Zero;
    
    // Find token with highest debt and highest collateral
    for (const token of supportedTokens) {
      const debt = await contracts.pool.debts(user, token);
      const collateral = await contracts.pool.supplied(user, token);
      
      if (debt.gt(maxDebt)) {
        maxDebt = debt;
        debtToken = token;
      }
      
      if (collateral.gt(maxCollateral)) {
        maxCollateral = collateral;
        collateralToken = token;
      }
    }
    
    if (!debtToken || !collateralToken || maxDebt.eq(0) || maxCollateral.eq(0)) {
      console.log("⚠️ No suitable debt/collateral found for liquidation");
      return false;
    }
    
    // Calculate liquidation amount (50% of debt)
    const liquidationPercentage = 50;
    const repayAmount = maxDebt.mul(liquidationPercentage).div(100);
    
    // Check liquidator has enough tokens
    const debtTokenContract = await ethers.getContractAt("ERC20Mintable", debtToken, signer);
    const liquidatorBalance = await debtTokenContract.balanceOf(signer.address);
    
    if (liquidatorBalance.lt(repayAmount)) {
      console.log(`⚠️ Liquidator has insufficient ${await getTokenSymbol(debtToken)} balance`);
      console.log(`   Required: ${ethers.utils.formatEther(repayAmount)}`);
      console.log(`   Available: ${ethers.utils.formatEther(liquidatorBalance)}`);
      return false;
    }
    
    // Approve tokens for liquidation
    console.log(`💸 Approving ${ethers.utils.formatEther(repayAmount)} tokens for liquidation...`);
    const approveTx = await debtTokenContract.approve(
      contracts.liquidationManager.address, 
      repayAmount,
      {
        gasLimit: CONFIG.GAS_LIMIT,
        maxFeePerGas: CONFIG.MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: CONFIG.MAX_PRIORITY_FEE_PER_GAS
      }
    );
    await approveTx.wait();
    
    // Execute liquidation
    console.log(`⚡ Executing liquidation...`);
    const liquidateTx = await contracts.liquidationManager.liquidate(
      user,
      poolAddress,
      debtToken,
      repayAmount,
      collateralToken,
      {
        gasLimit: CONFIG.GAS_LIMIT,
        maxFeePerGas: CONFIG.MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: CONFIG.MAX_PRIORITY_FEE_PER_GAS
      }
    );
    
    const receipt = await liquidateTx.wait();
    console.log(`✅ Liquidation successful! Gas used: ${receipt.gasUsed.toString()}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Liquidation failed for user ${userInfo.user}:`, error.message);
    return false;
  }
}

/**
 * Get token symbol for logging
 */
async function getTokenSymbol(tokenAddress) {
  try {
    return await contracts.addressToTokenMap.getSymbol(tokenAddress);
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Add users to tracking (for demo purposes)
 */
async function addDemoUsers() {
  try {
    // Get some accounts to track
    const accounts = await ethers.getSigners();
    const demoUsers = accounts.slice(2, 5).map(account => account.address); // Use accounts 2, 3, 4
    
    console.log("👥 Adding demo users to tracking...");
    
    for (const user of demoUsers) {
      try {
        await contracts.keeperAdapter.addUser(contracts.pool.address, user);
        console.log(`✅ Added user ${user} to tracking`);
      } catch (error) {
        // User might already be tracked
        console.log(`⚠️ User ${user} already tracked or error:`, error.message);
      }
    }
  } catch (error) {
    console.error("❌ Error adding demo users:", error.message);
  }
}

/**
 * Main keeper loop
 */
async function keeperLoop() {
  if (isRunning) {
    console.log("⚠️ Keeper loop already running, skipping...");
    return;
  }
  
  isRunning = true;
  
  try {
    console.log("\n🔍 Starting liquidation check...");
    console.log("⏰ Time:", new Date().toISOString());
    
    // Check for liquidatable users
    const liquidatableUsers = await checkLiquidatableUsers();
    
    if (liquidatableUsers.length === 0) {
      console.log("✅ No liquidations needed");
      return;
    }
    
    console.log(`🎯 Found ${liquidatableUsers.length} users that need liquidation`);
    
    // Execute liquidations (up to max per run)
    const maxLiquidations = Math.min(liquidatableUsers.length, CONFIG.MAX_LIQUIDATIONS_PER_RUN);
    let successfulLiquidations = 0;
    
    for (let i = 0; i < maxLiquidations; i++) {
      const success = await executeLiquidation(liquidatableUsers[i]);
      if (success) {
        successfulLiquidations++;
      }
      
      // Small delay between liquidations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 Liquidation summary: ${successfulLiquidations}/${maxLiquidations} successful`);
    
  } catch (error) {
    console.error("❌ Error in keeper loop:", error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the keeper bot
 */
async function startKeeper() {
  console.log("🤖 Starting LendHub Liquidation Keeper Bot");
  console.log("⚙️ Configuration:");
  console.log(`   Check Interval: ${CONFIG.CHECK_INTERVAL / 1000}s`);
  console.log(`   Max Liquidations per Run: ${CONFIG.MAX_LIQUIDATIONS_PER_RUN}`);
  console.log(`   Min Health Factor: ${ethers.utils.formatEther(CONFIG.MIN_HEALTH_FACTOR)}`);
  
  // Load contracts
  const success = await loadContracts();
  if (!success) {
    process.exit(1);
  }
  
  // Add demo users for testing
  await addDemoUsers();
  
  // Start the main loop
  console.log("\n🚀 Keeper bot started. Press Ctrl+C to stop.\n");
  
  const interval = setInterval(keeperLoop, CONFIG.CHECK_INTERVAL);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log("\n🛑 Shutting down keeper bot...");
    clearInterval(interval);
    process.exit(0);
  });
  
  // Run first check immediately
  await keeperLoop();
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Start the keeper if run directly
if (require.main === module) {
  startKeeper().catch(console.error);
}

module.exports = { startKeeper, keeperLoop, loadContracts };

