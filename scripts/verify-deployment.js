const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verifying LendHub v2 deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);

  // Contract addresses from latest deployment
  const CORE_POOL = "0x6739F8bf3b2315272BBC8B85Ef1EF9C0E300C3A7";
  const WETH_TOKEN = "0x5E55961B93EEecF9f1852A2d0208Be95b434ad8c";

  try {
    // Test 1: Check if contract exists
    console.log("\n📋 Test 1: Check contract exists...");
    const code = await ethers.provider.getCode(CORE_POOL);
    console.log("Contract code length:", code.length);
    
    if (code === "0x") {
      console.log("❌ No contract deployed at address!");
      return;
    }
    console.log("✅ Contract exists");

    // Test 2: Try to connect with correct ABI
    console.log("\n📋 Test 2: Connect with contract...");
    const pool = await ethers.getContractAt("IsolatedLendingPool", CORE_POOL);
    console.log("✅ Contract connected");

    // Test 3: Call view functions
    console.log("\n📋 Test 3: Test view functions...");
    
    try {
      const supportedTokens = await pool.getSupportedTokens();
      console.log("✅ getSupportedTokens():", supportedTokens);
    } catch (error) {
      console.log("❌ getSupportedTokens() failed:", error.message);
    }

    try {
      const poolBalance = await pool.poolBalance(WETH_TOKEN);
      console.log("✅ poolBalance():", ethers.utils.formatEther(poolBalance));
    } catch (error) {
      console.log("❌ poolBalance() failed:", error.message);
    }

    try {
      const suppliedAmount = await pool.supplied(deployer.address, WETH_TOKEN);
      console.log("✅ supplied():", ethers.utils.formatEther(suppliedAmount));
    } catch (error) {
      console.log("❌ supplied() failed:", error.message);
    }

    // Test 4: Test ETH supply (small amount)
    console.log("\n📋 Test 4: Test ETH supply...");
    
    const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
    const amount = ethers.utils.parseEther("0.01"); // 0.01 ETH
    
    try {
      const tx = await pool.lend(ETH_ADDRESS, amount, {
        value: amount,
        gasLimit: 500000
      });
      
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Supply successful! Gas used:", receipt.gasUsed.toString());
      
      // Check balance after
      const newSupplied = await pool.supplied(deployer.address, ETH_ADDRESS);
      console.log("New supplied amount:", ethers.utils.formatEther(newSupplied));
      
    } catch (error) {
      console.log("❌ Supply failed:", error.message);
      console.log("Error reason:", error.reason);
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

