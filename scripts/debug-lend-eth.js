const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 [DEBUG] ETH Lend Debug Script");
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

  // Test ETH lending (simulating frontend)
  console.log("\n💰 [LEND TEST]");
  const lendAmount = ethers.utils.parseEther("2");
  
  try {
    console.log(`Attempting to lend ${ethers.utils.formatEther(lendAmount)} ETH...`);
    
    // Check ETH balance
    const ethBalance = await ethers.provider.getBalance(user1.address);
    console.log(`Current ETH balance: ${ethers.utils.formatEther(ethBalance)}`);
    
    if (ethBalance.lt(lendAmount)) {
      console.log("❌ Not enough ETH balance");
      return;
    }

    // Method 1: Try direct ETH lending (like v1)
    console.log("\n📝 Method 1: Direct ETH lending...");
    try {
      const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
      const directTx = await pool.connect(user1).lend(ETH_ADDRESS, lendAmount, {
        value: lendAmount,
        gasLimit: 500000
      });
      await directTx.wait();
      console.log("✅ Direct ETH lending successful!");
      
      // Check final state
      const finalEthBalance = await ethers.provider.getBalance(user1.address);
      const finalSupplied = await pool.supplied(user1.address, weth.address);
      console.log(`Final ETH balance: ${ethers.utils.formatEther(finalEthBalance)}`);
      console.log(`Final supplied WETH: ${ethers.utils.formatEther(finalSupplied)}`);
      
    } catch (error) {
      console.log("❌ Direct ETH lending failed:", error.message);
      
      // Method 2: ETH → WETH → Lend (like v2)
      console.log("\n📝 Method 2: ETH → WETH → Lend...");
      
      // Step 1: Convert ETH to WETH
      console.log("🔄 Step 1: Converting ETH to WETH...");
      const depositTx = await weth.connect(user1).deposit({ value: lendAmount });
      await depositTx.wait();
      console.log("✅ ETH converted to WETH");
      
      // Step 2: Approve WETH
      console.log("📝 Step 2: Approving WETH...");
      await weth.connect(user1).approve(pool.address, lendAmount);
      console.log("✅ WETH approved");
      
      // Step 3: Lend WETH
      console.log("📝 Step 3: Lending WETH...");
      const lendTx = await pool.connect(user1).lend(weth.address, lendAmount);
      await lendTx.wait();
      console.log("✅ WETH lent successfully");
      
      // Check final state
      const finalEthBalance = await ethers.provider.getBalance(user1.address);
      const finalWethBalance = await weth.balanceOf(user1.address);
      const finalSupplied = await pool.supplied(user1.address, weth.address);
      
      console.log("\n📊 [FINAL STATE]");
      console.log(`ETH Balance: ${ethers.utils.formatEther(finalEthBalance)}`);
      console.log(`WETH Balance: ${ethers.utils.formatEther(finalWethBalance)}`);
      console.log(`Supplied WETH: ${ethers.utils.formatEther(finalSupplied)}`);
      
      const ethChange = finalEthBalance.sub(initialEthBalance);
      console.log(`ETH Change: ${ethers.utils.formatEther(ethChange)}`);
      
      if (ethChange.lt(0)) {
        console.log("✅ SUCCESS: ETH balance decreased (spent on lending)!");
      } else {
        console.log("❌ ISSUE: ETH balance did not decrease");
      }
    }

  } catch (error) {
    console.error("❌ Lend failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

