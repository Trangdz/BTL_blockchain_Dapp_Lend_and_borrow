const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing LendHub v2 Contracts...");

  const [deployer, user1] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);

  // Get deployed addresses
  const addresses = require("../addresses-ganache.js");
  
  const CORE_POOL = addresses.default.CORE_POOL;
  const WETH = addresses.default.WETH;
  const DAI = addresses.default.DAI;
  
  console.log("\n📋 Contract Addresses:");
  console.log("CORE Pool:", CORE_POOL);
  console.log("WETH:", WETH);
  console.log("DAI:", DAI);

  try {
    // Get contract instances
    const pool = await ethers.getContractAt("IsolatedLendingPool", CORE_POOL);
    const weth = await ethers.getContractAt("ERC20Mintable", WETH);
    const dai = await ethers.getContractAt("ERC20Mintable", DAI);

    console.log("\n🔍 Testing Contract Connections...");
    
    // Test 1: Check supported tokens
    console.log("1. Getting supported tokens...");
    const supportedTokens = await pool.getSupportedTokens();
    console.log("✅ Supported tokens:", supportedTokens);

    // Test 2: Check balances
    console.log("\n2. Checking balances...");
    const user1WethBalance = await weth.balanceOf(user1.address);
    console.log(`User1 WETH balance: ${ethers.utils.formatEther(user1WethBalance)}`);

    // Test 3: Mint WETH to user1 if needed
    if (user1WethBalance.eq(0)) {
      console.log("3. Minting WETH to user1...");
      const mintTx = await weth.mint(user1.address, ethers.utils.parseEther("10"));
      await mintTx.wait();
      console.log("✅ WETH minted");
    }

    // Test 4: Test supply function
    console.log("\n4. Testing supply...");
    const supplyAmount = ethers.utils.parseEther("1");
    
    // Approve WETH
    console.log("4a. Approving WETH...");
    const approveTx = await weth.connect(user1).approve(CORE_POOL, supplyAmount);
    await approveTx.wait();
    console.log("✅ WETH approved");

    // Supply WETH
    console.log("4b. Supplying WETH...");
    const lendTx = await pool.connect(user1).lend(WETH, supplyAmount);
    const receipt = await lendTx.wait();
    console.log(`✅ Supply successful! Gas used: ${receipt.gasUsed}`);

    // Test 5: Check supplied amount
    console.log("\n5. Checking supplied amount...");
    const suppliedAmount = await pool.supplied(user1.address, WETH);
    console.log(`User1 supplied: ${ethers.utils.formatEther(suppliedAmount)} WETH`);

    // Test 6: Test borrow
    console.log("\n6. Testing borrow...");
    const borrowAmount = ethers.utils.parseEther("500"); // $500 worth
    
    try {
      const borrowTx = await pool.connect(user1).borrow(DAI, borrowAmount);
      await borrowTx.wait();
      console.log("✅ Borrow successful");
      
      const borrowedAmount = await pool.debts(user1.address, DAI);
      console.log(`User1 borrowed: ${ethers.utils.formatEther(borrowedAmount)} DAI`);
    } catch (error) {
      console.log("❌ Borrow failed:", error.message);
    }

    // Test 7: Health factor
    console.log("\n7. Testing health factor...");
    try {
      const hf = await pool.getHealthFactor(user1.address);
      console.log(`Health Factor: ${ethers.utils.formatEther(hf)}`);
    } catch (error) {
      console.log("❌ Health factor failed:", error.message);
    }

    console.log("\n🎉 Contract testing completed!");

  } catch (error) {
    console.error("❌ Contract test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
