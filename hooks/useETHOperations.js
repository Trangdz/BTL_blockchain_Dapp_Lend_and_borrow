import { useCallback } from 'react';
import { ethers } from 'ethers';

/**
 * Hook for proper ETH supply/withdraw operations
 * Ensures ETH balance increases/decreases correctly
 */
export const useETHOperations = (poolAddress, signer, provider) => {
  
  // Pool ABI focused on ETH operations
  const POOL_ABI = [
    "function lend(address token, uint256 amount) external payable returns (bool)",
    "function withdraw(address token, uint256 amount) external returns (bool)",
    "function supplied(address user, address token) external view returns (uint256)"
  ];

  /**
   * Supply ETH to pool - preserves ETH balance logic
   */
  const supplyETH = useCallback(async (amount) => {
    console.log(`💰 Supplying ${amount} ETH to pool...`);
    
    try {
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, signer);
      const amountWei = ethers.utils.parseEther(amount.toString());
      
      // Check ETH balance
      const ethBalance = await provider.getBalance(await signer.getAddress());
      console.log(`Current ETH balance: ${ethers.utils.formatEther(ethBalance)}`);
      
      if (ethBalance.lt(amountWei)) {
        throw new Error(`Insufficient ETH balance. Have: ${ethers.utils.formatEther(ethBalance)}, Need: ${amount}`);
      }

      // ETH address for native ETH
      const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
      
      console.log("📝 Sending ETH supply transaction...");
      const tx = await poolContract.lend(ETH_ADDRESS, amountWei, {
        value: amountWei, // Send ETH as value
        gasLimit: 500000
      });

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait(1); // Wait for 1 confirmation
      
      console.log(`✅ ETH supply successful! Gas used: ${receipt.gasUsed.toString()}`);
      
      // Verify balance change
      const newEthBalance = await provider.getBalance(await signer.getAddress());
      const balanceChange = ethBalance.sub(newEthBalance);
      console.log(`📊 ETH balance change: -${ethers.utils.formatEther(balanceChange)} (including gas)`);
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        balanceChange: ethers.utils.formatEther(balanceChange)
      };

    } catch (error) {
      console.error("❌ ETH supply failed:", error);
      
      // Parse error for user-friendly message
      let errorMessage = error.message;
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [poolAddress, signer, provider]);

  /**
   * Withdraw ETH from pool - ensures ETH balance increases
   */
  const withdrawETH = useCallback(async (amount) => {
    console.log(`💸 Withdrawing ${amount} ETH from pool...`);
    
    try {
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, signer);
      const amountWei = ethers.utils.parseEther(amount.toString());
      const userAddress = await signer.getAddress();
      
      // Check supplied amount
      const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
      const supplied = await poolContract.supplied(userAddress, ETH_ADDRESS);
      
      console.log(`Current supplied: ${ethers.utils.formatEther(supplied)} ETH`);
      
      if (supplied.lt(amountWei)) {
        throw new Error(`Insufficient supplied amount. Available: ${ethers.utils.formatEther(supplied)}, Requested: ${amount}`);
      }

      // Get initial ETH balance
      const initialEthBalance = await provider.getBalance(userAddress);
      console.log(`ETH balance before withdraw: ${ethers.utils.formatEther(initialEthBalance)}`);
      
      console.log("📝 Sending ETH withdraw transaction...");
      const tx = await poolContract.withdraw(ETH_ADDRESS, amountWei, {
        gasLimit: 500000
      });

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait(1);
      
      console.log(`✅ ETH withdrawal successful! Gas used: ${receipt.gasUsed.toString()}`);
      
      // Verify balance increase
      const finalEthBalance = await provider.getBalance(userAddress);
      const balanceChange = finalEthBalance.sub(initialEthBalance);
      console.log(`📊 ETH balance change: ${ethers.utils.formatEther(balanceChange)} (net of gas)`);
      
      // Should be positive (received ETH minus gas)
      if (balanceChange.gt(0)) {
        console.log("✅ ETH balance increased as expected");
      } else {
        console.log("⚠️ ETH balance change negative (high gas cost)");
      }
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        balanceChange: ethers.utils.formatEther(balanceChange)
      };

    } catch (error) {
      console.error("❌ ETH withdrawal failed:", error);
      
      let errorMessage = error.message;
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [poolAddress, signer, provider]);

  /**
   * Check if ETH operations are supported by the pool
   */
  const checkETHSupport = useCallback(async () => {
    try {
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
      const supportedTokens = await poolContract.getSupportedTokens();
      
      const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
      const ethSupported = supportedTokens.includes(ETH_ADDRESS);
      
      console.log(`🔍 ETH support check: ${ethSupported}`);
      console.log(`📋 Supported tokens: ${supportedTokens.length}`);
      
      return ethSupported;
    } catch (error) {
      console.error("❌ ETH support check failed:", error);
      return false;
    }
  }, [poolAddress, provider]);

  return {
    supplyETH,
    withdrawETH,
    checkETHSupport
  };
};

