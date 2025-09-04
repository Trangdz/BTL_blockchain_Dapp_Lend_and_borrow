const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🎯 Setting up LendHub v2 demo positions...");
  
  // Load deployed addresses from addresses-ganache.js
  const addresses = require("../addresses-ganache.js");
  const config = {
    mockTokens: {
      WETH: addresses.default.WETH,
      USDC: addresses.default.USDC,
      DAI: addresses.default.DAI
    },
    pools: {
      CORE: addresses.default.CORE_POOL
    },
    core: {
      LiquidationManager: addresses.default.LiquidationManager
    }
  };
  
  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("Demo accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  User1:", user1.address);
  console.log("  User2:", user2.address);

  // Get contract instances
  const weth = await ethers.getContractAt("ERC20Mintable", config.mockTokens.WETH);
  const usdc = await ethers.getContractAt("ERC20Mintable", config.mockTokens.USDC);
  const dai = await ethers.getContractAt("ERC20Mintable", config.mockTokens.DAI);
  const pool = await ethers.getContractAt("IsolatedLendingPool", config.pools.CORE);
  const liquidationManager = await ethers.getContractAt("LiquidationManager", config.core.LiquidationManager);

  console.log("\n💰 Minting demo tokens...");
  
  // Mint tokens for demo
  await weth.mint(user1.address, ethers.utils.parseEther("20"));
  await weth.mint(user2.address, ethers.utils.parseEther("10"));
  await dai.mint(deployer.address, ethers.utils.parseEther("100000"));
  await usdc.mint(deployer.address, ethers.utils.parseUnits("50000", 6));
  
  console.log("✅ Tokens minted");

  console.log("\n🏊 Setting up liquidity positions...");
  
  // Deployer provides liquidity
  await dai.connect(deployer).approve(pool.address, ethers.utils.parseEther("50000"));
  await pool.connect(deployer).lend(dai.address, ethers.utils.parseEther("50000"));
  
  await usdc.connect(deployer).approve(pool.address, ethers.utils.parseUnits("20000", 6));
  await pool.connect(deployer).lend(usdc.address, ethers.utils.parseUnits("20000", 6));
  
  console.log("✅ Liquidity provided by deployer");

  console.log("\n👤 Setting up user positions...");
  
  // User1: Provide WETH collateral and borrow DAI
  await weth.connect(user1).approve(pool.address, ethers.utils.parseEther("10"));
  await pool.connect(user1).lend(weth.address, ethers.utils.parseEther("10"));
  console.log("User1 supplied 10 WETH as collateral");
  
  // Borrow DAI against WETH
  await pool.connect(user1).borrow(dai.address, ethers.utils.parseEther("15000"));
  console.log("User1 borrowed 15,000 DAI");
  
  // User2: Provide WETH and borrow USDC
  await weth.connect(user2).approve(pool.address, ethers.utils.parseEther("5"));
  await pool.connect(user2).lend(weth.address, ethers.utils.parseEther("5"));
  console.log("User2 supplied 5 WETH as collateral");
  
  await pool.connect(user2).borrow(usdc.address, ethers.utils.parseUnits("8000", 6));
  console.log("User2 borrowed 8,000 USDC");

  console.log("\n📊 Checking health factors...");
  
  const user1HF = await liquidationManager.calcHealthFactor(user1.address, pool.address);
  const user2HF = await liquidationManager.calcHealthFactor(user2.address, pool.address);
  
  console.log(`User1 Health Factor: ${ethers.utils.formatEther(user1HF.hf)}`);
  console.log(`User1 Collateral: $${ethers.utils.formatEther(user1HF.collateralUSD)}`);
  console.log(`User1 Debt: $${ethers.utils.formatEther(user1HF.borrowUSD)}`);
  
  console.log(`User2 Health Factor: ${ethers.utils.formatEther(user2HF.hf)}`);
  console.log(`User2 Collateral: $${ethers.utils.formatEther(user2HF.collateralUSD)}`);
  console.log(`User2 Debt: $${ethers.utils.formatEther(user2HF.borrowUSD)}`);

  console.log("\n🎯 Demo setup complete!");
  console.log("\nNext steps for testing:");
  console.log("1. Frontend is running at http://localhost:3000");
  console.log("2. Connect MetaMask to Ganache (localhost:7545)");
  console.log("3. Import these accounts:");
  console.log(`   - User1: ${user1.address}`);
  console.log(`   - User2: ${user2.address}`);
  console.log("4. You should see Health Factor cards and market data!");
  console.log("\n💡 To test liquidation, modify WETH price in Ganache using:");
  console.log("   scripts/test-liquidation.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
