const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing withdraw functionality...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  
  const CORE_POOL = addresses.default.CORE_POOL;
  const WETH = addresses.default.WETH;
  
  console.log("Pool:", CORE_POOL);
  console.log("WETH:", WETH);
  console.log("Deployer:", deployer.address);

  try {
    const pool = await ethers.getContractAt("IsolatedLendingPool", CORE_POOL);
    const weth = await ethers.getContractAt("ERC20Mintable", WETH);
    
    // Check current supplied amount
    console.log("📊 Checking current supplies...");
    const suppliedAmount = await pool.supplied(deployer.address, WETH);
    console.log(`Deployer supplied: ${ethers.utils.formatEther(suppliedAmount)} WETH`);
    
    if (suppliedAmount.eq(0)) {
      console.log("💰 No supplies found, creating test supply...");
      
      // Supply some WETH first
      const supplyAmount = ethers.utils.parseEther("2");
      await weth.approve(CORE_POOL, supplyAmount);
      await pool.lend(WETH, supplyAmount);
      
      const newSupplied = await pool.supplied(deployer.address, WETH);
      console.log(`✅ Supplied: ${ethers.utils.formatEther(newSupplied)} WETH`);
    }
    
    // Test withdraw
    console.log("\n💸 Testing withdraw...");
    const withdrawAmount = ethers.utils.parseEther("1"); // Withdraw 1 WETH
    
    console.log("1. Checking pool balance...");
    const poolBalance = await pool.poolBalance(WETH);
    console.log(`Pool balance: ${ethers.utils.formatEther(poolBalance)} WETH`);
    
    console.log("2. Withdrawing...");
    const withdrawTx = await pool.withdraw(WETH, withdrawAmount);
    const receipt = await withdrawTx.wait();
    console.log(`✅ Withdraw successful! Gas: ${receipt.gasUsed}`);
    
    console.log("3. Checking results...");
    const newSupplied = await pool.supplied(deployer.address, WETH);
    const newPoolBalance = await pool.poolBalance(WETH);
    
    console.log(`New supplied: ${ethers.utils.formatEther(newSupplied)} WETH`);
    console.log(`New pool balance: ${ethers.utils.formatEther(newPoolBalance)} WETH`);
    
    console.log("\n🎉 Withdraw test successful!");
    console.log("💡 Frontend withdraw should now work");
    
  } catch (error) {
    console.error("❌ Withdraw test failed:", error);
    
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

