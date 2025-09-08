const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 [DEBUG] Borrow Power Calculation");
  console.log("=" + "=".repeat(50));

  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("👤 User1:", user1.address);
  console.log("👤 User2:", user2.address);

  // Load addresses
  const addresses = require("../addresses-ganache.js");
  
  // Get contracts
  const pool = await ethers.getContractAt("IsolatedLendingPool", addresses.default.CORE_POOL);
  const weth = await ethers.getContractAt("WETH9", addresses.default.WETH);
  const dai = await ethers.getContractAt("ERC20Mintable", addresses.default.DAI);

  // Check User1's supplies
  console.log("\n📊 [USER1 SUPPLIES]");
  const user1SuppliedWeth = await pool.supplied(user1.address, weth.address);
  const user1SuppliedDai = await pool.supplied(user1.address, dai.address);
  
  console.log(`WETH Supplied: ${ethers.utils.formatEther(user1SuppliedWeth)}`);
  console.log(`DAI Supplied: ${ethers.utils.formatEther(user1SuppliedDai)}`);

  // Check User2's supplies
  console.log("\n📊 [USER2 SUPPLIES]");
  const user2SuppliedWeth = await pool.supplied(user2.address, weth.address);
  const user2SuppliedDai = await pool.supplied(user2.address, dai.address);
  
  console.log(`WETH Supplied: ${ethers.utils.formatEther(user2SuppliedWeth)}`);
  console.log(`DAI Supplied: ${ethers.utils.formatEther(user2SuppliedDai)}`);

  // Check pool liquidity
  console.log("\n📊 [POOL LIQUIDITY]");
  const wethState = await pool.tokenStates(weth.address);
  const daiState = await pool.tokenStates(dai.address);
  
  console.log(`WETH Cash: ${ethers.utils.formatEther(wethState.cash)}`);
  console.log(`WETH Borrows: ${ethers.utils.formatEther(wethState.borrows)}`);
  console.log(`DAI Cash: ${ethers.utils.formatEther(daiState.cash)}`);
  console.log(`DAI Borrows: ${ethers.utils.formatEther(daiState.borrows)}`);

  // Calculate borrow power manually
  console.log("\n💰 [BORROW POWER CALCULATION]");
  
  // Token prices (in 1e18 precision)
  const WETH_PRICE = ethers.utils.parseEther("3000"); // $3000
  const DAI_PRICE = ethers.utils.parseEther("1"); // $1
  const LTV = ethers.utils.parseEther("0.8"); // 80% LTV

  // User1's borrow power
  let user1CollateralUSD = ethers.BigNumber.from(0);
  let user1BorrowedUSD = ethers.BigNumber.from(0);

  if (user1SuppliedWeth.gt(0)) {
    const wethValue = user1SuppliedWeth.mul(WETH_PRICE).div(ethers.utils.parseEther("1"));
    const wethBorrowable = wethValue.mul(LTV).div(ethers.utils.parseEther("1"));
    user1CollateralUSD = user1CollateralUSD.add(wethBorrowable);
    console.log(`WETH Collateral: $${ethers.utils.formatEther(wethValue)} → Borrowable: $${ethers.utils.formatEther(wethBorrowable)}`);
  }

  if (user1SuppliedDai.gt(0)) {
    const daiValue = user1SuppliedDai.mul(DAI_PRICE).div(ethers.utils.parseEther("1"));
    const daiBorrowable = daiValue.mul(LTV).div(ethers.utils.parseEther("1"));
    user1CollateralUSD = user1CollateralUSD.add(daiBorrowable);
    console.log(`DAI Collateral: $${ethers.utils.formatEther(daiValue)} → Borrowable: $${ethers.utils.formatEther(daiBorrowable)}`);
  }

  // Check if User1 has any existing borrows
  const user1BorrowedWeth = await pool.debts(user1.address, weth.address);
  const user1BorrowedDai = await pool.debts(user1.address, dai.address);

  if (user1BorrowedWeth.gt(0)) {
    const wethDebtValue = user1BorrowedWeth.mul(WETH_PRICE).div(ethers.utils.parseEther("1"));
    user1BorrowedUSD = user1BorrowedUSD.add(wethDebtValue);
    console.log(`WETH Debt: $${ethers.utils.formatEther(wethDebtValue)}`);
  }

  if (user1BorrowedDai.gt(0)) {
    const daiDebtValue = user1BorrowedDai.mul(DAI_PRICE).div(ethers.utils.parseEther("1"));
    user1BorrowedUSD = user1BorrowedUSD.add(daiDebtValue);
    console.log(`DAI Debt: $${ethers.utils.formatEther(daiDebtValue)}`);
  }

  const user1AvailableBorrow = user1CollateralUSD.gt(user1BorrowedUSD) 
    ? user1CollateralUSD.sub(user1BorrowedUSD) 
    : ethers.BigNumber.from(0);

  console.log(`\n📊 [USER1 BORROW POWER]`);
  console.log(`Total Collateral: $${ethers.utils.formatEther(user1CollateralUSD)}`);
  console.log(`Total Borrowed: $${ethers.utils.formatEther(user1BorrowedUSD)}`);
  console.log(`Available Borrow: $${ethers.utils.formatEther(user1AvailableBorrow)}`);

  // Calculate DAI borrowable amount
  const daiBorrowableAmount = user1AvailableBorrow.div(DAI_PRICE);
  console.log(`DAI Borrowable: ${ethers.utils.formatEther(daiBorrowableAmount)} DAI`);

  // Check what the frontend is showing
  console.log("\n🔍 [FRONTEND DEBUG]");
  console.log("Expected: ~$685 DAI borrowable (856 * 0.8)");
  console.log("Actual: 39955.20 DAI - This is WRONG!");
  console.log("Possible causes:");
  console.log("1. Wrong price calculation");
  console.log("2. Wrong LTV calculation");
  console.log("3. Wrong collateral calculation");
  console.log("4. Frontend using wrong data source");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

