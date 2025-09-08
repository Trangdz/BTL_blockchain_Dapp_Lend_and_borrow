const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 Enabling ETH lending for account: 0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  const userAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64";
  
  try {
    // Give user enough WETH to test lending
    console.log("💰 Ensuring user has enough WETH...");
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    
    // Mint 200 WETH (enough for testing)
    await weth.mint(userAccount, ethers.utils.parseEther("200"));
    console.log("✅ 200 WETH minted for user");
    
    // Check final balance
    const balance = await weth.balanceOf(userAccount);
    console.log(`Final WETH balance: ${ethers.utils.formatEther(balance)}`);
    
    console.log("\n🎉 ETH lending enabled!");
    console.log("💡 User can now:");
    console.log("   - Click 'Lend' for ETH");
    console.log("   - System will auto-convert ETH to WETH");
    console.log("   - Lending will work seamlessly");
    console.log("   - Refresh frontend to see updated balance");
    
  } catch (error) {
    console.error("❌ Enable failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

