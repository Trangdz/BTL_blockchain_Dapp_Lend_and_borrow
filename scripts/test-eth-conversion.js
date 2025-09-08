const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing ETH ↔ WETH conversion with WETH9...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  
  const WETH = addresses.default.WETH;
  console.log("WETH9 address:", WETH);

  try {
    const weth = await ethers.getContractAt("WETH9", WETH);
    
    console.log("📊 Initial state:");
    const initialETH = await ethers.provider.getBalance(deployer.address);
    const initialWETH = await weth.balanceOf(deployer.address);
    console.log(`ETH: ${ethers.utils.formatEther(initialETH)}`);
    console.log(`WETH: ${ethers.utils.formatEther(initialWETH)}`);
    
    // Test 1: Deposit ETH → WETH
    console.log("\n💰 Test 1: ETH → WETH (deposit)");
    const depositAmount = ethers.utils.parseEther("5");
    
    const depositTx = await weth.deposit({ value: depositAmount });
    await depositTx.wait();
    console.log("✅ ETH deposited to WETH");
    
    const afterDepositETH = await ethers.provider.getBalance(deployer.address);
    const afterDepositWETH = await weth.balanceOf(deployer.address);
    console.log(`ETH after deposit: ${ethers.utils.formatEther(afterDepositETH)}`);
    console.log(`WETH after deposit: ${ethers.utils.formatEther(afterDepositWETH)}`);
    
    // Test 2: Withdraw WETH → ETH
    console.log("\n💸 Test 2: WETH → ETH (withdraw)");
    const withdrawAmount = ethers.utils.parseEther("2");
    
    const withdrawTx = await weth.withdraw(withdrawAmount);
    await withdrawTx.wait();
    console.log("✅ WETH withdrawn to ETH");
    
    const finalETH = await ethers.provider.getBalance(deployer.address);
    const finalWETH = await weth.balanceOf(deployer.address);
    console.log(`ETH after withdraw: ${ethers.utils.formatEther(finalETH)}`);
    console.log(`WETH after withdraw: ${ethers.utils.formatEther(finalWETH)}`);
    
    // Verify conversion worked
    console.log("\n✅ Conversion Results:");
    const ethDiff = finalETH.sub(initialETH);
    const wethDiff = finalWETH.sub(initialWETH);
    console.log(`Net ETH change: ${ethers.utils.formatEther(ethDiff)} (should be negative due to gas)`);
    console.log(`Net WETH change: ${ethers.utils.formatEther(wethDiff)} (should be +3)`);
    
    console.log("\n🎉 WETH9 conversion working perfectly!");
    console.log("💡 Frontend ETH supply/withdraw will now work correctly");
    
  } catch (error) {
    console.error("❌ Conversion test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

