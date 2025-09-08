const { ethers } = require("hardhat");

async function main() {
  console.log("✅ Pre-approving tokens for user account...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  const userAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64";
  
  console.log("User account:", userAccount);
  console.log("Pool address:", addresses.default.CORE_POOL);

  try {
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    const dai = await ethers.getContractAt("ERC20Mintable", addresses.default.DAI);
    const usdc = await ethers.getContractAt("ERC20Mintable", addresses.default.USDC);
    
    // Check balances first
    console.log("\n📊 Current balances:");
    const wethBal = await weth.balanceOf(userAccount);
    const daiBal = await dai.balanceOf(userAccount);
    const usdcBal = await usdc.balanceOf(userAccount);
    
    console.log(`WETH: ${ethers.utils.formatEther(wethBal)}`);
    console.log(`DAI: ${ethers.utils.formatEther(daiBal)}`);
    console.log(`USDC: ${ethers.utils.formatUnits(usdcBal, 6)}`);
    
    // For demo, let's transfer some tokens from deployer to user
    // This simulates user having tokens
    console.log("\n💰 Transferring tokens to user (simulate having tokens)...");
    
    const transferAmount = ethers.utils.parseEther("100");
    
    // Transfer WETH
    const deployerWethBalance = await weth.balanceOf(deployer.address);
    if (deployerWethBalance.gte(transferAmount)) {
      await weth.transfer(userAccount, transferAmount);
      console.log("✅ 100 WETH transferred to user");
    }
    
    // Transfer DAI
    const deployerDaiBalance = await dai.balanceOf(deployer.address);
    if (deployerDaiBalance.gte(transferAmount)) {
      await dai.transfer(userAccount, transferAmount);
      console.log("✅ 100 DAI transferred to user");
    }
    
    // Check new balances
    console.log("\n📊 New balances:");
    const newWethBal = await weth.balanceOf(userAccount);
    const newDaiBal = await dai.balanceOf(userAccount);
    const newUsdcBal = await usdc.balanceOf(userAccount);
    
    console.log(`WETH: ${ethers.utils.formatEther(newWethBal)}`);
    console.log(`DAI: ${ethers.utils.formatEther(newDaiBal)}`);
    console.log(`USDC: ${ethers.utils.formatUnits(newUsdcBal, 6)}`);
    
    console.log("\n🎉 Tokens ready for user!");
    console.log("💡 User can now supply ETH (which converts to WETH)");
    console.log("🔄 Refresh frontend to see updated balances");
    
  } catch (error) {
    console.error("❌ Token setup failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

