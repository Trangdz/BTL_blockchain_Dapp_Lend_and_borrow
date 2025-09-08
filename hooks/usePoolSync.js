import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

/**
 * Hook for pool state synchronization with event listening
 * Implements stale-while-revalidate pattern with exponential backoff
 */
export const usePoolSync = (poolAddress, provider, account) => {
  const [poolState, setPoolState] = useState({
    supplies: {},
    borrows: {},
    healthFactor: "0",
    borrowPower: "0",
    isLoading: false,
    lastSync: null,
    error: null
  });

  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, error
  const [retryCount, setRetryCount] = useState(0);

  // Pool ABI for state management
  const POOL_ABI = [
    "function getSupportedTokens() external view returns (address[])",
    "function supplied(address user, address token) external view returns (uint256)",
    "function debts(address user, address token) external view returns (uint256)",
    "function getHealthFactor(address user) external view returns (uint256)",
    "function tokenStates(address) external view returns (uint128 cash, uint128 borrows, uint64 lastAccrue, uint64 indexSupply, uint64 indexBorrow)",
    
    // Events
    "event Lend(address indexed user, address indexed token, uint256 amount, uint256 newBalance)",
    "event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 newBalance)",
    "event Borrow(address indexed user, address indexed token, uint256 amount, uint256 newDebt)",
    "event Repay(address indexed user, address indexed token, uint256 amount, uint256 newDebt)"
  ];

  /**
   * Calculate borrow power with BigNumber precision
   */
  const calculateBorrowPower = useCallback(async (poolContract, userAccount, supportedTokens) => {
    let totalCollateralUSD = ethers.BigNumber.from(0);
    let totalBorrowedUSD = ethers.BigNumber.from(0);

    // Token prices (in 1e18 precision)
    const TOKEN_PRICES = {
      'WETH': ethers.utils.parseEther("3000"),
      'DAI': ethers.utils.parseEther("1"),
      'USDC': ethers.utils.parseEther("1")
    };

    for (const tokenAddress of supportedTokens) {
      try {
        // Get user positions
        const supplied = await poolContract.supplied(userAccount, tokenAddress);
        const borrowed = await poolContract.debts(userAccount, tokenAddress);

        if (supplied.gt(0) || borrowed.gt(0)) {
          // Determine token and price
          let symbol = 'UNKNOWN';
          let price = ethers.utils.parseEther("1");

          // This should be improved with proper token mapping
          if (tokenAddress.toLowerCase().includes('weth') || tokenAddress === process.env.WETH_ADDRESS) {
            symbol = 'WETH';
            price = TOKEN_PRICES.WETH;
          } else if (tokenAddress.toLowerCase().includes('dai')) {
            symbol = 'DAI';
            price = TOKEN_PRICES.DAI;
          } else if (tokenAddress.toLowerCase().includes('usdc')) {
            symbol = 'USDC';
            price = TOKEN_PRICES.USDC;
          }

          // Calculate values in USD (with 1e18 precision)
          if (supplied.gt(0)) {
            const collateralValue = supplied.mul(price).div(ethers.utils.parseEther("1"));
            const ltv = ethers.utils.parseEther("0.8"); // 80% LTV
            const borrowableValue = collateralValue.mul(ltv).div(ethers.utils.parseEther("1"));
            totalCollateralUSD = totalCollateralUSD.add(borrowableValue);
          }

          if (borrowed.gt(0)) {
            const borrowValue = borrowed.mul(price).div(ethers.utils.parseEther("1"));
            totalBorrowedUSD = totalBorrowedUSD.add(borrowValue);
          }
        }
      } catch (error) {
        console.error(`Error calculating borrow power for ${tokenAddress}:`, error);
      }
    }

    // Calculate available borrow power
    const availableBorrowPower = totalCollateralUSD.gt(totalBorrowedUSD) 
      ? totalCollateralUSD.sub(totalBorrowedUSD) 
      : ethers.BigNumber.from(0);

    // Calculate health factor
    let healthFactor = ethers.constants.MaxUint256; // Infinity if no debt
    if (totalBorrowedUSD.gt(0)) {
      healthFactor = totalCollateralUSD.mul(ethers.utils.parseEther("1")).div(totalBorrowedUSD);
    }

    return {
      borrowPowerUSD: ethers.utils.formatEther(availableBorrowPower),
      healthFactor: ethers.utils.formatEther(healthFactor),
      totalCollateralUSD: ethers.utils.formatEther(totalCollateralUSD),
      totalBorrowedUSD: ethers.utils.formatEther(totalBorrowedUSD)
    };
  }, []);

  /**
   * Fetch complete pool state
   */
  const syncPoolState = useCallback(async () => {
    if (!poolAddress || !provider || !account) {
      console.log("⏭️ Skipping pool sync - missing dependencies");
      return;
    }

    setSyncStatus('syncing');
    
    const startTime = Date.now();
    console.log(`🔄 [${new Date().toISOString()}] Syncing pool state...`);

    try {
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
      const supportedTokens = await poolContract.getSupportedTokens();

      // Fetch user positions
      const supplies = {};
      const borrows = {};

      for (const tokenAddress of supportedTokens) {
        try {
          const supplied = await poolContract.supplied(account, tokenAddress);
          const borrowed = await poolContract.debts(account, tokenAddress);

          if (supplied.gt(0)) {
            supplies[tokenAddress] = {
              raw: supplied,
              formatted: ethers.utils.formatEther(supplied),
              address: tokenAddress
            };
          }

          if (borrowed.gt(0)) {
            borrows[tokenAddress] = {
              raw: borrowed,
              formatted: ethers.utils.formatEther(borrowed),
              address: tokenAddress
            };
          }
        } catch (error) {
          console.error(`Error fetching position for ${tokenAddress}:`, error);
        }
      }

      // Calculate borrow power and health factor
      const powerMetrics = await calculateBorrowPower(poolContract, account, supportedTokens);

      setPoolState({
        supplies,
        borrows,
        healthFactor: powerMetrics.healthFactor,
        borrowPower: powerMetrics.borrowPowerUSD,
        supportedTokens,
        isLoading: false,
        lastSync: new Date(),
        error: null
      });

      setSyncStatus('idle');
      setRetryCount(0); // Reset retry count on success
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${new Date().toISOString()}] Pool sync completed in ${duration}ms`);
      console.log(`📊 Health Factor: ${powerMetrics.healthFactor}`);
      console.log(`💰 Borrow Power: $${powerMetrics.borrowPowerUSD}`);

    } catch (error) {
      console.error("❌ Pool sync failed:", error);
      setSyncStatus('error');
      
      setPoolState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));

      // Exponential backoff retry
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s
      console.log(`🔄 Retrying in ${backoffDelay}ms (attempt ${retryCount + 1})`);
      
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        syncPoolState();
      }, backoffDelay);
    }
  }, [poolAddress, provider, account, calculateBorrowPower, retryCount]);

  /**
   * Listen to pool events for real-time updates
   */
  useEffect(() => {
    if (!poolAddress || !provider) return;

    console.log("👂 Setting up pool event listeners...");

    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

    // Event handlers
    const handleLend = (user, token, amount, newBalance) => {
      console.log(`📥 Lend event: ${user} lent ${ethers.utils.formatEther(amount)} tokens`);
      if (user.toLowerCase() === account?.toLowerCase()) {
        console.log("🔄 User lend detected, syncing...");
        setTimeout(syncPoolState, 1000); // Sync after 1s
      } else {
        console.log("🔄 Other user lend detected, updating rates...");
        // Update rates for borrowable amounts
        setTimeout(syncPoolState, 2000);
      }
    };

    const handleWithdraw = (user, token, amount, newBalance) => {
      console.log(`📤 Withdraw event: ${user} withdrew ${ethers.utils.formatEther(amount)} tokens`);
      if (user.toLowerCase() === account?.toLowerCase()) {
        setTimeout(syncPoolState, 1000);
      }
    };

    const handleBorrow = (user, token, amount, newDebt) => {
      console.log(`💰 Borrow event: ${user} borrowed ${ethers.utils.formatEther(amount)} tokens`);
      setTimeout(syncPoolState, 1000);
    };

    const handleRepay = (user, token, amount, newDebt) => {
      console.log(`💳 Repay event: ${user} repaid ${ethers.utils.formatEther(amount)} tokens`);
      setTimeout(syncPoolState, 1000);
    };

    // Attach event listeners
    poolContract.on("Lend", handleLend);
    poolContract.on("Withdraw", handleWithdraw);
    poolContract.on("Borrow", handleBorrow);
    poolContract.on("Repay", handleRepay);

    // Initial sync
    syncPoolState();

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up pool event listeners...");
      poolContract.removeAllListeners();
    };
  }, [poolAddress, provider, account, syncPoolState]);

  return {
    poolState,
    syncStatus,
    retryCount,
    refetch: syncPoolState
  };
};

