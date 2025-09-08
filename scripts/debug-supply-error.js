const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debugging exact supply error...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  const userAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64";
  
  console.log("User account:", userAccount);
  console.log("Pool address:", addresses.default.CORE_POOL);
  console.log("WETH address:", addresses.default.WETH);

  try {
    // Test the exact same flow as frontend
    const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    
    // Check current state
    console.log("\n📋 Current state:");
    const wethBalance = await weth.balanceOf(userAccount);
    console.log(`WETH balance: ${ethers.utils.formatEther(wethBalance)}`);
    
    const supportedTokens = await pool.getSupportedTokens();
    console.log("Supported tokens:", supportedTokens);
    
    const isWethSupported = supportedTokens.includes(addresses.default.WETH);
    console.log("WETH supported:", isWethSupported);
    
    // Check if we can call basic functions
    console.log("\n🧪 Testing contract functions:");
    
    try {
      const poolBalance = await pool.poolBalance(addresses.default.WETH);
      console.log(`Pool WETH balance: ${ethers.utils.formatEther(poolBalance)}`);
    } catch (error) {
      console.log("❌ poolBalance() failed:", error.message);
    }
    
    try {
      const suppliedAmount = await pool.supplied(userAccount, addresses.default.WETH);
      console.log(`User supplied: ${ethers.utils.formatEther(suppliedAmount)}`);
    } catch (error) {
      console.log("❌ supplied() failed:", error.message);
    }
    
    // Test approve (this might be the issue)
    console.log("\n💰 Testing approve...");
    try {
      const amount = ethers.utils.parseEther("1");
      
      // Estimate gas for approve
      const approveGas = await weth.estimateGas.approve(addresses.default.CORE_POOL, amount);
      console.log(`Approve gas estimate: ${approveGas}`);
      
      // Estimate gas for lend
      const lendGas = await pool.estimateGas.lend(addresses.default.WETH, amount);
      console.log(`Lend gas estimate: ${lendGas}`);
      
      console.log("✅ Gas estimates successful - transactions should work");
      
    } catch (error) {
      console.log("❌ Gas estimation failed:", error.message);
      
      // Check if it's a revert reason
      if (error.data) {
        console.log("Error data:", error.data);
      }
      if (error.reason) {
        console.log("Revert reason:", error.reason);
      }
    }
    
  } catch (error) {
    console.error("❌ Debug failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

