const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Fixing ETH lending for current user...");

  const [deployer] = await ethers.getSigners();
  const addresses = require("../addresses-ganache.js");
  
  // Use the account that's connected in MetaMask
  const userAccount = "0xb245BdaEC1d83e67768Df0b919fD12a6e013Ba64";
  
  console.log("Deployer (has mint rights):", deployer.address);
  console.log("User account:", userAccount);

  try {
    const weth = await ethers.getContractAt("ERC20Mintable", addresses.default.WETH);
    const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
    
    // Check current WETH balance
    const currentBalance = await weth.balanceOf(userAccount);
    console.log(`Current WETH balance: ${ethers.utils.formatEther(currentBalance)}`);
    
    // Mint more WETH if needed (using deployer who has rights)
    if (currentBalance.lt(ethers.utils.parseEther("50"))) {
      console.log("💰 Minting additional WETH...");
      await weth.mint(userAccount, ethers.utils.parseEther("50"));
      console.log("✅ Additional WETH minted");
    }
    
    // Test lending with user account (simulate frontend)
    console.log("\n🧪 Simulating frontend ETH lending...");
    
    // Create user signer (this simulates MetaMask signing)
    const userSigner = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Ganache account 2 private key
      ethers.provider
    );
    
    console.log("User signer address:", userSigner.address);
    
    if (userSigner.address.toLowerCase() === userAccount.toLowerCase()) {
      const amount = ethers.utils.parseEther("5"); // 5 ETH worth
      
      // Approve WETH
      console.log("1. Approving WETH...");
      const wethWithUser = weth.connect(userSigner);
      const approveTx = await wethWithUser.approve(addresses.default.CORE_POOL, amount);
      await approveTx.wait();
      console.log("✅ WETH approved");
      
      // Lend WETH (representing ETH)
      console.log("2. Lending WETH (as ETH)...");
      const poolWithUser = pool.connect(userSigner);
      const lendTx = await poolWithUser.lend(addresses.default.WETH, amount);
      const receipt = await lendTx.wait();
      console.log(`✅ Lending successful! Gas: ${receipt.gasUsed}`);
      
      // Check result
      const suppliedAmount = await pool.supplied(userAccount, addresses.default.WETH);
      console.log(`Total supplied: ${ethers.utils.formatEther(suppliedAmount)} WETH`);
      
      console.log("\n🎉 ETH lending flow works!");
    } else {
      console.log("❌ Signer address mismatch");
    }
    
  } catch (error) {
    console.error("❌ Fix failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

