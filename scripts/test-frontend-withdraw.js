const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 [TEST] Frontend Withdraw Simulation");
  console.log("=" + "=".repeat(50));

  const [deployer, user1] = await ethers.getSigners();
  console.log("👤 User1:", user1.address);

  // Load addresses
  const addresses = require("../addresses-ganache.js");
  
  // Get contracts
  const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
  const weth = await ethers.getContractAt("WETH9", addresses.default.WETH);

  // Check current state
  console.log("\n📊 [CURRENT STATE]");
  const ethBalance = await ethers.provider.getBalance(user1.address);
  const wethBalance = await weth.balanceOf(user1.address);
  const suppliedWeth = await pool.supplied(user1.address, weth.address);
  
  console.log(`ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);
  console.log(`WETH Balance: ${ethers.utils.formatEther(wethBalance)}`);
  console.log(`Supplied WETH: ${ethers.utils.formatEther(suppliedWeth)}`);

  if (suppliedWeth.eq(0)) {
    console.log("❌ No WETH supplied! Setting up...");
    
    // Supply some WETH
    const supplyAmount = ethers.utils.parseEther("3");
    await weth.connect(user1).deposit({ value: supplyAmount });
    await weth.connect(user1).approve(pool.address, supplyAmount);
    await pool.connect(user1).lend(weth.address, supplyAmount);
    console.log("✅ WETH supplied");
  }

  // Test withdrawal (simulating frontend call)
  console.log("\n💸 [WITHDRAW TEST]");
  const withdrawAmount = ethers.utils.parseEther("1");
  
  try {
    // This simulates what the frontend does
    const tokenAddress = addresses.default.WETH; // WETH address passed from frontend
    const amount = withdrawAmount;
    
    console.log(`Withdrawing ${ethers.utils.formatEther(amount)} from ${tokenAddress}`);
    
    // Check supplied amount
    const supplied = await pool.supplied(user1.address, tokenAddress);
    console.log(`Current supplied: ${ethers.utils.formatEther(supplied)}`);
    
    if (supplied.lt(amount)) {
      console.log("❌ Not enough supplied amount");
      return;
    }

    // Step 1: Withdraw from pool
    console.log("📝 Step 1: Withdrawing from pool...");
    const withdrawTx = await pool.connect(user1).withdraw(tokenAddress, amount);
    await withdrawTx.wait();
    console.log("✅ Pool withdrawal successful");
    
    // Step 2: Convert WETH back to ETH
    console.log("🔄 Step 2: Converting WETH back to ETH...");
    const convertTx = await weth.connect(user1).withdraw(amount);
    await convertTx.wait();
    console.log("✅ WETH conversion successful");

    // Check final balances
    console.log("\n📊 [FINAL STATE]");
    const finalEthBalance = await ethers.provider.getBalance(user1.address);
    const finalWethBalance = await weth.balanceOf(user1.address);
    const finalSupplied = await pool.supplied(user1.address, weth.address);
    
    console.log(`ETH Balance: ${ethers.utils.formatEther(finalEthBalance)}`);
    console.log(`WETH Balance: ${ethers.utils.formatEther(finalWethBalance)}`);
    console.log(`Supplied WETH: ${ethers.utils.formatEther(finalSupplied)}`);
    
    const ethChange = finalEthBalance.sub(ethBalance);
    console.log(`ETH Change: ${ethers.utils.formatEther(ethChange)}`);
    
    if (ethChange.gt(0)) {
      console.log("✅ SUCCESS: ETH balance increased!");
    } else {
      console.log("❌ ISSUE: ETH balance did not increase");
    }

  } catch (error) {
    console.error("❌ Withdraw failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

