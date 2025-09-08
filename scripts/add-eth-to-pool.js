const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 Adding ETH support to LendHub v2 pool...");
  
  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  
  const CORE_POOL = addresses.default.CORE_POOL;
  const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  console.log("Pool address:", CORE_POOL);
  console.log("ETH address:", ETH_ADDRESS);

  try {
    const pool = await ethers.getContractAt("IsolatedLendingPool", CORE_POOL);
    
    // Check if ETH is already supported
    console.log("\n📋 Checking current supported tokens...");
    const supportedTokens = await pool.getSupportedTokens();
    console.log("Current tokens:", supportedTokens);
    
    const ethSupported = supportedTokens.includes(ETH_ADDRESS);
    console.log("ETH supported:", ethSupported);
    
    if (!ethSupported) {
      console.log("\n➕ Adding ETH to pool...");
      const addTx = await pool.addToken(ETH_ADDRESS);
      await addTx.wait();
      console.log("✅ ETH added to pool");
      
      // Check again
      const newSupportedTokens = await pool.getSupportedTokens();
      console.log("New supported tokens:", newSupportedTokens);
    } else {
      console.log("✅ ETH already supported");
    }
    
    // Setup ETH in AddressToTokenMap if needed
    console.log("\n🔗 Setting up ETH in token map...");
    const tokenMap = await ethers.getContractAt("AddressToTokenMapV2", addresses.default.AddressToTokenMapV2);
    
    try {
      const currentSymbol = await tokenMap.getSymbol(ETH_ADDRESS);
      console.log("Current ETH symbol:", currentSymbol);
      
      if (!currentSymbol || currentSymbol === "") {
        console.log("Setting ETH symbol...");
        await tokenMap.setSymbol(ETH_ADDRESS, "ETH");
        console.log("✅ ETH symbol set");
      }
    } catch (error) {
      console.log("Setting ETH symbol...");
      await tokenMap.setSymbol(ETH_ADDRESS, "ETH");
      console.log("✅ ETH symbol set");
    }
    
    console.log("\n🎉 ETH support configured!");
    console.log("💡 You can now supply ETH directly like the original LendHub");
    
  } catch (error) {
    console.error("❌ Failed to add ETH support:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

