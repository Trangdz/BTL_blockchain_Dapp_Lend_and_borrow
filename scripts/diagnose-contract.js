const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Diagnosing contract issues...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  
  try {
    const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
    
    console.log("📊 Contract State Analysis:");
    
    // Check if contract is paused
    try {
      const isPaused = await pool.paused();
      console.log(`Contract paused: ${isPaused}`);
    } catch (error) {
      console.log("Could not check paused state");
    }
    
    // Check supported tokens
    const supportedTokens = await pool.getSupportedTokens();
    console.log("Supported tokens:", supportedTokens.length);
    
    for (const token of supportedTokens) {
      console.log(`\nToken: ${token}`);
      
      // Check token state
      const tokenState = await pool.tokenStates(token);
      console.log(`  Cash: ${ethers.utils.formatEther(tokenState.cash)}`);
      console.log(`  Borrows: ${ethers.utils.formatEther(tokenState.borrows)}`);
      console.log(`  Last Accrue: ${tokenState.lastAccrue}`);
      
      // Check deployer's position
      const supplied = await pool.supplied(deployer.address, token);
      console.log(`  Deployer supplied: ${ethers.utils.formatEther(supplied)}`);
    }
    
    // Check if ETH (0x0) is supported
    const ethAddress = "0x0000000000000000000000000000000000000000";
    const isEthSupported = supportedTokens.includes(ethAddress);
    console.log(`\nETH (0x0) supported: ${isEthSupported}`);
    
    // Check contract roles
    console.log("\n🔐 Checking roles...");
    try {
      const adminRole = await pool.ADMIN_ROLE();
      const hasAdminRole = await pool.hasRole(adminRole, deployer.address);
      console.log(`Deployer has admin role: ${hasAdminRole}`);
    } catch (error) {
      console.log("Could not check roles");
    }
    
    // Try simple function calls
    console.log("\n🧪 Testing basic functions...");
    
    try {
      const healthFactor = await pool.getHealthFactor(deployer.address);
      console.log(`Health factor: ${ethers.utils.formatEther(healthFactor)}`);
    } catch (error) {
      console.log("❌ Health factor failed:", error.message);
    }
    
  } catch (error) {
    console.error("❌ Diagnosis failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

