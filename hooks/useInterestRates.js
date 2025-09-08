import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

/**
 * Hook for dynamic interest rate calculations with kink model
 * Implements 2-slope model: base + slope1*U (U≤kink); base + slope1*kink + slope2*(U−kink) (U>kink)
 */
export const useInterestRates = (poolAddress, provider, tokens) => {
  const [rates, setRates] = useState({});
  const [utilization, setUtilization] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Pool ABI for interest rate calculations
  const POOL_ABI = [
    "function tokenStates(address) external view returns (uint128 cash, uint128 borrows, uint64 lastAccrue, uint64 indexSupply, uint64 indexBorrow)",
    "function reserveFactor() external view returns (uint256)",
    "function getSupportedTokens() external view returns (address[])"
  ];

  // Interest rate model parameters (configurable)
  const RATE_CONFIG = {
    base: 0.02,      // 2% base rate
    slope1: 0.05,    // 5% slope before kink
    slope2: 0.25,    // 25% slope after kink  
    kink: 0.8,       // 80% kink point
    reserveFactor: 0.1, // 10% reserve factor
    blocksPerYear: 2102400 // ~15s block time
  };

  /**
   * Calculate utilization rate
   * U = totalBorrow / (totalSupply - reserves)
   */
  const calculateUtilization = (cash, borrows) => {
    const totalSupply = cash + borrows;
    if (totalSupply === 0) return 0;
    
    const utilization = borrows / totalSupply;
    return Math.min(Math.max(utilization, 0), 1); // Clamp 0-1
  };

  /**
   * Calculate borrow APR using kink model
   */
  const calculateBorrowAPR = (utilization) => {
    const { base, slope1, slope2, kink } = RATE_CONFIG;
    
    if (utilization <= kink) {
      // Before kink: base + slope1 * U
      return base + (slope1 * utilization);
    } else {
      // After kink: base + slope1 * kink + slope2 * (U - kink)
      return base + (slope1 * kink) + (slope2 * (utilization - kink));
    }
  };

  /**
   * Calculate supply APR
   * supplyAPR = borrowAPR * U * (1 - reserveFactor)
   */
  const calculateSupplyAPR = (borrowAPR, utilization) => {
    const { reserveFactor } = RATE_CONFIG;
    return borrowAPR * utilization * (1 - reserveFactor);
  };

  /**
   * Convert APR to APY with compounding
   * APY = (1 + APR/blocksPerYear)^blocksPerYear - 1
   */
  const aprToApy = (apr) => {
    const { blocksPerYear } = RATE_CONFIG;
    return Math.pow(1 + apr / blocksPerYear, blocksPerYear) - 1;
  };

  /**
   * Fetch and calculate interest rates for all tokens
   */
  const fetchRates = useCallback(async () => {
    if (!poolAddress || !provider || !tokens) {
      console.log("⏭️ Skipping rates fetch - missing dependencies");
      return;
    }

    setIsLoading(true);
    
    const startTime = Date.now();
    console.log(`📈 [${new Date().toISOString()}] Calculating interest rates...`);

    try {
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
      const supportedTokens = await poolContract.getSupportedTokens();
      
      const newRates = {};
      const newUtilization = {};

      for (const tokenAddress of supportedTokens) {
        try {
          // Get token state from contract
          const tokenState = await poolContract.tokenStates(tokenAddress);
          
          // Convert to JavaScript numbers for calculation
          const cash = parseFloat(ethers.utils.formatEther(tokenState.cash));
          const borrows = parseFloat(ethers.utils.formatEther(tokenState.borrows));
          
          // Calculate utilization
          const util = calculateUtilization(cash, borrows);
          
          // Calculate rates
          const borrowAPR = calculateBorrowAPR(util);
          const supplyAPR = calculateSupplyAPR(borrowAPR, util);
          
          // Convert to APY
          const borrowAPY = aprToApy(borrowAPR);
          const supplyAPY = aprToApy(supplyAPR);
          
          // Get token symbol for logging
          const token = tokens.find(t => t.address === tokenAddress);
          const symbol = token?.symbol || "UNKNOWN";
          
          newRates[tokenAddress] = {
            symbol,
            utilization: util,
            borrowAPR,
            supplyAPR,
            borrowAPY,
            supplyAPY,
            cash,
            borrows,
            totalSupply: cash + borrows,
            timestamp: Date.now()
          };
          
          newUtilization[tokenAddress] = util;
          
          console.log(`📊 ${symbol}:`);
          console.log(`   Utilization: ${(util * 100).toFixed(2)}%`);
          console.log(`   Supply APR: ${(supplyAPR * 100).toFixed(4)}%`);
          console.log(`   Borrow APR: ${(borrowAPR * 100).toFixed(4)}%`);
          console.log(`   Supply APY: ${(supplyAPY * 100).toFixed(4)}%`);
          console.log(`   Borrow APY: ${(borrowAPY * 100).toFixed(4)}%`);
          console.log(`   Cash: ${cash.toLocaleString()}`);
          console.log(`   Borrows: ${borrows.toLocaleString()}`);
          
        } catch (error) {
          console.error(`❌ Error calculating rates for ${tokenAddress}:`, error);
        }
      }

      setRates(newRates);
      setUtilization(newUtilization);
      setLastUpdate(new Date());
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${new Date().toISOString()}] Rate calculation completed in ${duration}ms`);

    } catch (error) {
      console.error("❌ Rate fetch failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [poolAddress, provider, tokens]);

  // Auto-refresh rates periodically
  useEffect(() => {
    fetchRates();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRates, 30000);
    
    return () => clearInterval(interval);
  }, [fetchRates]);

  return {
    rates,
    utilization,
    isLoading,
    lastUpdate,
    refetch: fetchRates,
    config: RATE_CONFIG
  };
};

