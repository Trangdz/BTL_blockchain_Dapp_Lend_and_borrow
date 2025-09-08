import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

/**
 * Hook to fetch accurate token balances with proper decimal handling
 * Implements direct ERC20.balanceOf() calls, no cache/subgraph dependency
 */
export const useTokenBalances = (account, provider, tokens, chainId) => {
  const [balances, setBalances] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  // ERC20 ABI for balance checking
  const ERC20_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)"
  ];

  const fetchBalances = useCallback(async () => {
    if (!account || !provider || !tokens || tokens.length === 0) {
      console.log("⏭️ Skipping balance fetch - missing dependencies");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const startTime = Date.now();
    console.log(`📊 [${new Date().toISOString()}] Fetching balances for ${account}`);

    try {
      const newBalances = {};

      for (const token of tokens) {
        try {
          let balance = "0";
          let decimals = 18;
          let symbol = token.symbol || "UNKNOWN";

          if (token.address === "0x0000000000000000000000000000000000000000" || token.symbol === "ETH") {
            // Native ETH balance
            const ethBalance = await provider.getBalance(account);
            balance = ethers.utils.formatEther(ethBalance);
            symbol = "ETH";
            console.log(`✅ ETH balance: ${balance}`);
          } else {
            // ERC20 token balance
            const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
            
            // Get decimals first
            try {
              decimals = await tokenContract.decimals();
            } catch (error) {
              console.warn(`Could not get decimals for ${token.address}, using default 18`);
              decimals = token.decimals || 18;
            }
            
            // Get balance
            const rawBalance = await tokenContract.balanceOf(account);
            balance = ethers.utils.formatUnits(rawBalance, decimals);
            
            // Get symbol if not provided
            if (!token.symbol) {
              try {
                symbol = await tokenContract.symbol();
              } catch (error) {
                symbol = "UNKNOWN";
              }
            }
            
            console.log(`✅ ${symbol} balance: ${balance} (decimals: ${decimals})`);
          }

          newBalances[token.address] = {
            raw: balance,
            formatted: parseFloat(balance),
            decimals: decimals,
            symbol: symbol,
            address: token.address
          };

        } catch (error) {
          console.error(`❌ Error fetching balance for ${token.address}:`, error);
          newBalances[token.address] = {
            raw: "0",
            formatted: 0,
            decimals: 18,
            symbol: token.symbol || "UNKNOWN",
            address: token.address,
            error: error.message
          };
        }
      }

      setBalances(newBalances);
      setLastUpdate(new Date());
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${new Date().toISOString()}] Balance fetch completed in ${duration}ms`);
      console.log("📋 Updated balances:", newBalances);

    } catch (error) {
      console.error("❌ Balance fetch failed:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [account, provider, tokens, chainId]);

  // Auto-refresh on account/chain change
  useEffect(() => {
    console.log("🔄 Account or chain changed, fetching balances...");
    fetchBalances();
  }, [fetchBalances]);

  // Listen to account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      console.log("👤 Accounts changed:", accounts);
      setTimeout(fetchBalances, 500); // Small delay for provider to update
    };

    const handleChainChanged = (chainId) => {
      console.log("🔗 Chain changed:", chainId);
      setTimeout(fetchBalances, 1000); // Longer delay for network switch
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [fetchBalances]);

  return {
    balances,
    isLoading,
    lastUpdate,
    error,
    refetch: fetchBalances
  };
};

