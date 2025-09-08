const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Creating fresh supply for current user...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  const userAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64";
  
  console.log("User account:", userAccount);

  try {
    const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    
    console.log("📊 Before supply:");
    const beforeSupplied = await pool.supplied(userAccount, addresses.default.WETH);
    const beforeBalance = await weth.balanceOf(userAccount);
    console.log(`User supplied: ${ethers.utils.formatEther(beforeSupplied)} WETH`);
    console.log(`User balance: ${ethers.utils.formatEther(beforeBalance)} WETH`);
    
    // Supply WETH on behalf of user (using deployer permissions)
    console.log("\n💸 Creating supply for user...");
    const supplyAmount = ethers.utils.parseEther("5"); // 5 WETH
    
    // Transfer WETH to user first if needed
    if (beforeBalance.lt(supplyAmount)) {
      console.log("Transferring WETH to user...");
      await weth.transfer(userAccount, supplyAmount);
    }
    
    // Now we need to simulate user supplying
    // Since we can't use user's private key, we'll create the supply record manually
    console.log("Creating supply record...");
    
    // Alternative: Use deployer to supply then transfer the position
    console.log("Deployer supplying on behalf...");
    await weth.approve(addresses.default.CORE_POOL, supplyAmount);
    const lendTx = await pool.lend(addresses.default.WETH, supplyAmount);
    await lendTx.wait();
    
    console.log("📊 After supply:");
    const afterSupplied = await pool.supplied(deployer.address, addresses.default.WETH);
    const poolBalance = await pool.poolBalance(addresses.default.WETH);
    console.log(`Deployer supplied: ${ethers.utils.formatEther(afterSupplied)} WETH`);
    console.log(`Pool balance: ${ethers.utils.formatEther(poolBalance)} WETH`);
    
    console.log("\n🎯 SOLUTION FOR USER:");
    console.log("1. User needs to supply WETH first");
    console.log("2. Then can withdraw from their own supply");
    console.log("3. Frontend should check actual supplied amount before allowing withdraw");
    
    console.log("\n💡 TO FIX FRONTEND:");
    console.log("1. Clear browser cache completely");
    console.log("2. Reconnect wallet");
    console.log("3. Supply some WETH first");
    console.log("4. Then withdraw will work");
    
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

