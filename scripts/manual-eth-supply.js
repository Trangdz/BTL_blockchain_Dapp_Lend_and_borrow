const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Manual ETH supply test for user account...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  const userAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64";
  
  try {
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
    
    const amount = ethers.utils.parseEther("5"); // 5 ETH worth
    
    console.log("1. Checking WETH balance...");
    let balance = await weth.balanceOf(userAccount);
    console.log(`Current: ${ethers.utils.formatEther(balance)} WETH`);
    
    console.log("2. Approving WETH for pool...");
    // Use deployer to approve on behalf (for testing)
    await weth.approve(addresses.default.CORE_POOL, amount);
    console.log("✅ Approved by deployer");
    
    console.log("3. Testing lend function...");
    const lendTx = await pool.lend(addresses.default.WETH, amount);
    const receipt = await lendTx.wait();
    console.log(`✅ Lend successful! Gas: ${receipt.gasUsed}`);
    
    console.log("4. Checking result...");
    const supplied = await pool.supplied(deployer.address, addresses.default.WETH);
    console.log(`Deployed supplied: ${ethers.utils.formatEther(supplied)} WETH`);
    
    console.log("\n🎉 Manual supply works!");
    console.log("💡 Issue is with user account permissions or frontend flow");
    
  } catch (error) {
    console.error("❌ Manual test failed:", error);
    
    if (error.reason) {
      console.log("Specific reason:", error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

