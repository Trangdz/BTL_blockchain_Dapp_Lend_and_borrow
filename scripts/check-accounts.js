const { ethers } = require("hardhat");

async function main() {
  console.log("👥 Checking all accounts and balances...");
  
  const accounts = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  
  console.log("\n📋 Ganache Accounts:");
  for (let i = 0; i < Math.min(accounts.length, 5); i++) {
    const account = accounts[i];
    console.log(`Account ${i}: ${account.address}`);
    
    // Check ETH balance
    const ethBalance = await ethers.provider.getBalance(account.address);
    console.log(`  ETH: ${ethers.utils.formatEther(ethBalance)}`);
    
    // Check token balances
    try {
      const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
      const dai = await ethers.getContractAt("ERC20Mintable", addresses.default.DAI);
      const usdc = await ethers.getContractAt("ERC20Mintable", addresses.default.USDC);
      
      const wethBal = await weth.balanceOf(account.address);
      const daiBal = await dai.balanceOf(account.address);
      const usdcBal = await usdc.balanceOf(account.address);
      
      console.log(`  WETH: ${ethers.utils.formatEther(wethBal)}`);
      console.log(`  DAI: ${ethers.utils.formatEther(daiBal)}`);
      console.log(`  USDC: ${ethers.utils.formatUnits(usdcBal, 6)}`);
      
      // Check if this account has any supplies in the pool
      const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
      const wethSupplied = await pool.supplied(account.address, addresses.default.WETH);
      const daiSupplied = await pool.supplied(account.address, addresses.default.DAI);
      
      if (wethSupplied.gt(0) || daiSupplied.gt(0)) {
        console.log(`  🏦 Pool Supplies:`);
        console.log(`    WETH supplied: ${ethers.utils.formatEther(wethSupplied)}`);
        console.log(`    DAI supplied: ${ethers.utils.formatEther(daiSupplied)}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error checking tokens: ${error.message}`);
    }
    
    console.log(""); // Empty line
  }
  
  console.log("\n💡 To use an account in MetaMask:");
  console.log("1. Copy the address above");
  console.log("2. In Ganache, find that account and copy its private key");
  console.log("3. Import the private key into MetaMask");
  console.log("4. Switch to that account in MetaMask");
  console.log("5. Refresh the frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

