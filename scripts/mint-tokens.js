const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Minting tokens for current account...");
  
  // Get account to mint to (first argument or deployer)
  const accounts = await ethers.getSigners();
  const targetAccount = process.argv[2] || accounts[0].address;
  
  console.log("Target account:", targetAccount);
  console.log("Minting with deployer:", accounts[0].address);

  // Get deployed addresses
  const addresses = require("../addresses-ganache.js");
  
  try {
    // Mint WETH
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    console.log("🪙 Minting 100 WETH...");
    await weth.mint(targetAccount, ethers.utils.parseEther("100"));
    console.log("✅ WETH minted");

    // Mint DAI
    const dai = await ethers.getContractAt("ERC20Mintable", addresses.default.DAI);
    console.log("🪙 Minting 50,000 DAI...");
    await dai.mint(targetAccount, ethers.utils.parseEther("50000"));
    console.log("✅ DAI minted");

    // Mint USDC
    const usdc = await ethers.getContractAt("ERC20Mintable", addresses.default.USDC);
    console.log("🪙 Minting 25,000 USDC...");
    await usdc.mint(targetAccount, ethers.utils.parseUnits("25000", 6));
    console.log("✅ USDC minted");

    // Check balances
    console.log("\n📊 Final balances:");
    const wethBalance = await weth.balanceOf(targetAccount);
    const daiBalance = await dai.balanceOf(targetAccount);
    const usdcBalance = await usdc.balanceOf(targetAccount);
    
    console.log(`WETH: ${ethers.utils.formatEther(wethBalance)}`);
    console.log(`DAI: ${ethers.utils.formatEther(daiBalance)}`);
    console.log(`USDC: ${ethers.utils.formatUnits(usdcBalance, 6)}`);
    
    console.log("\n🎉 Tokens minted successfully!");
    console.log("💡 Refresh frontend to see updated balances");
    
  } catch (error) {
    console.error("❌ Minting failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

