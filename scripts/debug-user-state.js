const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 DEBUGGING USER STATE - TRIỆT ĐỂ");

  const addresses = require("../addresses-ganache.js");
  const userAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64"; // From MetaMask
  
  console.log("🎯 Target User:", userAccount);
  console.log("🎯 Pool Address:", addresses.default.CORE_POOL);
  console.log("🎯 WETH Address:", addresses.default.WETH);

  try {
    const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    
    console.log("\n📊 COMPLETE STATE ANALYSIS:");
    
    // 1. Check all accounts that have supplies
    console.log("\n1. WHO HAS SUPPLIES?");
    const [deployer, account1, account2, account3] = await ethers.getSigners();
    const accounts = [deployer.address, account1.address, account2.address, account3.address, userAccount];
    
    for (const account of accounts) {
      const supplied = await pool.supplied(account, addresses.default.WETH);
      if (supplied.gt(0)) {
        console.log(`✅ ${account}: ${ethers.utils.formatEther(supplied)} WETH supplied`);
      } else {
        console.log(`❌ ${account}: 0 WETH supplied`);
      }
    }
    
    // 2. Check WETH token balances
    console.log("\n2. WETH TOKEN BALANCES:");
    for (const account of accounts) {
      const balance = await weth.balanceOf(account);
      if (balance.gt(0)) {
        console.log(`💰 ${account}: ${ethers.utils.formatEther(balance)} WETH tokens`);
      }
    }
    
    // 3. Check pool total state
    console.log("\n3. POOL STATE:");
    const tokenState = await pool.tokenStates(addresses.default.WETH);
    console.log(`Cash: ${ethers.utils.formatEther(tokenState.cash)}`);
    console.log(`Borrows: ${ethers.utils.formatEther(tokenState.borrows)}`);
    
    const poolBalance = await pool.poolBalance(addresses.default.WETH);
    console.log(`Pool Balance: ${ethers.utils.formatEther(poolBalance)}`);
    
    // 4. Check if user account is the one with supplies
    const userSupplied = await pool.supplied(userAccount, addresses.default.WETH);
    console.log(`\n4. USER SPECIFIC CHECK:`);
    console.log(`${userAccount} supplied: ${ethers.utils.formatEther(userSupplied)} WETH`);
    
    if (userSupplied.eq(0)) {
      console.log("\n❌ USER HAS NO SUPPLIES!");
      console.log("💡 SOLUTIONS:");
      console.log("A. Import account that has supplies into MetaMask");
      console.log("B. Supply some WETH first before trying to withdraw");
      console.log("C. Use correct account that made the deposits");
      
      // Find which account has supplies
      for (const account of accounts.slice(0, 4)) { // Check first 4 Ganache accounts
        const supplied = await pool.supplied(account, addresses.default.WETH);
        if (supplied.gt(0)) {
          console.log(`\n🎯 ACCOUNT WITH SUPPLIES: ${account}`);
          console.log(`   Supplied: ${ethers.utils.formatEther(supplied)} WETH`);
          console.log(`   💡 Import this account into MetaMask to withdraw`);
        }
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

