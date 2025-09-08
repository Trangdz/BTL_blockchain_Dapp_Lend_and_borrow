const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Minting tokens for specific account...");
  
  // Account bạn đang sử dụng trong MetaMask
  const targetAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64";
  
  console.log("Target account:", targetAccount);
  
  const [deployer] = await ethers.getSigners();
  console.log("Minting with deployer:", deployer.address);

  // Get deployed addresses
  const addresses = require("../addresses-ganache.js");
  
  try {
    // Check current balances first
    console.log("\n📊 Current balances:");
    
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    const dai = await ethers.getContractAt("ERC20Mintable", addresses.default.DAI);
    const usdc = await ethers.getContractAt("ERC20Mintable", addresses.default.USDC);
    
    let wethBal = await weth.balanceOf(targetAccount);
    let daiBal = await dai.balanceOf(targetAccount);
    let usdcBal = await usdc.balanceOf(targetAccount);
    
    console.log(`WETH: ${ethers.utils.formatEther(wethBal)}`);
    console.log(`DAI: ${ethers.utils.formatEther(daiBal)}`);
    console.log(`USDC: ${ethers.utils.formatUnits(usdcBal, 6)}`);

    // Mint tokens
    console.log("\n💰 Minting new tokens...");
    
    console.log("🪙 Minting 100 WETH...");
    await weth.mint(targetAccount, ethers.utils.parseEther("100"));
    
    console.log("🪙 Minting 50,000 DAI...");
    await dai.mint(targetAccount, ethers.utils.parseEther("50000"));
    
    console.log("🪙 Minting 25,000 USDC...");
    await usdc.mint(targetAccount, ethers.utils.parseUnits("25000", 6));

    // Check new balances
    console.log("\n📊 New balances:");
    wethBal = await weth.balanceOf(targetAccount);
    daiBal = await dai.balanceOf(targetAccount);
    usdcBal = await usdc.balanceOf(targetAccount);
    
    console.log(`WETH: ${ethers.utils.formatEther(wethBal)}`);
    console.log(`DAI: ${ethers.utils.formatEther(daiBal)}`);
    console.log(`USDC: ${ethers.utils.formatUnits(usdcBal, 6)}`);
    
    console.log("\n🎉 Tokens minted successfully!");
    console.log("💡 Refresh frontend to see updated balances");
    console.log(`📱 Make sure MetaMask is connected to: ${targetAccount}`);
    
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

