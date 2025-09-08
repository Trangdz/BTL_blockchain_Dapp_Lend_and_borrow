const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 [DEBUG] ETH Withdraw Debug Script");
  console.log("=" + "=".repeat(50));

  const [deployer, user1] = await ethers.getSigners();
  console.log("👤 User1:", user1.address);

  // Load addresses
  const addresses = require("../addresses-ganache.js");
  console.log("📋 Pool Address:", addresses.default.CORE_POOL);

  // Get contracts
  const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
  const weth = await ethers.getContractAt("WETH9", addresses.default.WETH);

  // Check initial state
  console.log("\n📊 [INITIAL STATE]");
  const initialEthBalance = await ethers.provider.getBalance(user1.address);
  const initialWethBalance = await weth.balanceOf(user1.address);
  const suppliedWeth = await pool.supplied(user1.address, weth.address);
  
  console.log(`ETH Balance: ${ethers.utils.formatEther(initialEthBalance)}`);
  console.log(`WETH Balance: ${ethers.utils.formatEther(initialWethBalance)}`);
  console.log(`Supplied WETH: ${ethers.utils.formatEther(suppliedWeth)}`);

  if (suppliedWeth.eq(0)) {
    console.log("❌ No WETH supplied! Setting up test...");
    
    // Supply some WETH first
    const supplyAmount = ethers.utils.parseEther("5");
    console.log("💰 Supplying 5 WETH...");
    
    // Convert ETH to WETH
    const depositTx = await weth.connect(user1).deposit({ value: supplyAmount });
    await depositTx.wait();
    console.log("✅ ETH converted to WETH");
    
    // Approve and lend
    await weth.connect(user1).approve(pool.address, supplyAmount);
    const lendTx = await pool.connect(user1).lend(weth.address, supplyAmount);
    await lendTx.wait();
    console.log("✅ WETH supplied to pool");
    
    // Check new state
    const newSupplied = await pool.supplied(user1.address, weth.address);
    console.log(`New supplied WETH: ${ethers.utils.formatEther(newSupplied)}`);
  }

  // Now test withdrawal
  console.log("\n💸 [WITHDRAW TEST]");
  const withdrawAmount = ethers.utils.parseEther("2");
  
  try {
    console.log(`Attempting to withdraw ${ethers.utils.formatEther(withdrawAmount)} WETH...`);
    
    // Check if we have enough supplied
    const currentSupplied = await pool.supplied(user1.address, weth.address);
    console.log(`Current supplied: ${ethers.utils.formatEther(currentSupplied)}`);
    
    if (currentSupplied.lt(withdrawAmount)) {
      console.log("❌ Not enough supplied amount");
      return;
    }

    // Step 1: Withdraw from pool
    console.log("📝 Step 1: Withdrawing from pool...");
    const withdrawTx = await pool.connect(user1).withdraw(weth.address, withdrawAmount);
    const withdrawReceipt = await withdrawTx.wait();
    console.log(`✅ Pool withdrawal successful! Gas: ${withdrawReceipt.gasUsed}`);
    
    // Check WETH balance after pool withdrawal
    const wethAfterPool = await weth.balanceOf(user1.address);
    console.log(`WETH after pool withdrawal: ${ethers.utils.formatEther(wethAfterPool)}`);

    // Step 2: Convert WETH back to ETH
    console.log("🔄 Step 2: Converting WETH back to ETH...");
    const convertTx = await weth.connect(user1).withdraw(withdrawAmount);
    const convertReceipt = await convertTx.wait();
    console.log(`✅ WETH conversion successful! Gas: ${convertReceipt.gasUsed}`);

    // Check final balances
    console.log("\n📊 [FINAL STATE]");
    const finalEthBalance = await ethers.provider.getBalance(user1.address);
    const finalWethBalance = await weth.balanceOf(user1.address);
    const finalSupplied = await pool.supplied(user1.address, weth.address);
    
    console.log(`ETH Balance: ${ethers.utils.formatEther(finalEthBalance)}`);
    console.log(`WETH Balance: ${ethers.utils.formatEther(finalWethBalance)}`);
    console.log(`Supplied WETH: ${ethers.utils.formatEther(finalSupplied)}`);
    
    const ethChange = finalEthBalance.sub(initialEthBalance);
    console.log(`ETH Change: ${ethers.utils.formatEther(ethChange)}`);
    
    if (ethChange.gt(0)) {
      console.log("✅ SUCCESS: ETH balance increased!");
    } else {
      console.log("❌ ISSUE: ETH balance did not increase");
    }

  } catch (error) {
    console.error("❌ Withdraw failed:", error);
    
    // Try to get more details
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.data) {
      console.error("Data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

