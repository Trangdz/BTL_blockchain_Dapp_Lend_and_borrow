import React, { useState } from "react";
import LendContext from "./lendContext";
import { ethers } from "ethers";

// Import token lists based on network
const getTokensList = (chainId) => {
  if (chainId === 1337) {
    // Ganache - use LendHub v2 token list
    try {
      return require("../token-list-ganache.js");
    } catch (error) {
      console.warn("Ganache token list not found, using default");
      return require("../token-list-goerli");
    }
  } else {
    // Sepolia - use original token list
    return require("../token-list-goerli");
  }
};

// Import addresses based on network
const getContractAddresses = (chainId) => {
  if (chainId === 1337) {
    // Ganache - use LendHub v2 addresses
    const ganacheAddresses = require("../addresses-ganache.js");
    return {
      ETHAddress: ganacheAddresses.ETHAddress,
      LendingPoolAddress: ganacheAddresses.LendingPoolAddress,
      LendingHelperAddress: ganacheAddresses.LendingHelperAddress,
      WETH: ganacheAddresses.default.WETH,
      USDC: ganacheAddresses.default.USDC, 
      DAI: ganacheAddresses.default.DAI,
    };
  } else {
    // Sepolia - use original addresses
    const sepoliaAddresses = require("../addresses.js");
    return {
      ETHAddress: sepoliaAddresses.ETHAddress,
      LendingPoolAddress: sepoliaAddresses.LendingPoolAddress,
      LendingHelperAddress: sepoliaAddresses.LendingHelperAddress,
      WETH: sepoliaAddresses.ETHAddress, // Fallback
      USDC: sepoliaAddresses.USDCTokenAddress,
      DAI: sepoliaAddresses.DAITokenAddress,
    };
  }
};

// Token list compatible with v2
const getTokenList = (addresses) => {
  return [
    {
      image: "../assets/eth-icon.svg", 
      name: "WETH",
      address: addresses.WETH,
      decimal: "18",
      apy: 3,
      isCollateral: true,
    },
    {
      image: "../assets/dai-icon.svg",
      name: "DAI", 
      address: addresses.DAI,
      decimal: "18",
      apy: 3,
      isCollateral: true,
    },
    {
      image: "../assets/usdc-icon.svg",
      name: "USDC",
      address: addresses.USDC,
      decimal: addresses.USDC.includes("USDC") ? "6" : "18", // Handle decimals
      apy: 3,
      isCollateral: true,
    }
  ];
};

const numberToEthers = (number) => {
  return ethers.utils.parseEther(number.toString());
};

const LendStateV2 = (props) => {
  // State management
  const [metamaskDetails, setMetamaskDetails] = useState({
    provider: null,
    networkName: null,
    signer: null,
    currentAccount: null,
    chainId: null,
    contractAddresses: null,
  });

  const [userAssets, setUserAssets] = useState([]);
  const [supplyAssets, setSupplyAssets] = useState([]);
  const [assetsToBorrow, setAssetsToBorrow] = useState([]);
  const [yourBorrows, setYourBorrows] = useState([]);

  const [supplySummary, setSupplySummary] = useState({
    totalUSDBalance: 0,
    weightedAvgAPY: 0,
    totalUSDCollateral: 0,
  });

  const [borrowSummary, setBorrowSummary] = useState({
    totalUSDBalance: 0,
    weightedAvgAPY: 0,
    totalBorrowPowerUsed: 0,
  });

  // LendHub v2 specific states
  const [healthFactor, setHealthFactor] = useState("0");
  const [borrowPower, setBorrowPower] = useState("0");
  const [utilizationRate, setUtilizationRate] = useState("0");
  const [assetMetrics, setAssetMetrics] = useState([]);

  const connectWallet = async () => {
    console.log("🔗 Connecting to wallet...");
    const { ethereum } = window;
    
    try {
      if (!ethereum) {
        console.error("❌ MetaMask not detected");
        alert("Please install MetaMask & connect your MetaMask");
        return;
      }

      console.log("✅ MetaMask detected");
      const account = await ethereum.request({
        method: "eth_requestAccounts",
      });

      window.ethereum.on("chainChanged", () => {
        console.log("🔄 Chain changed, reloading...");
        window.location.reload();
      });
      
      window.ethereum.on("accountsChanged", () => {
        console.log("👤 Accounts changed, reloading...");
        window.location.reload();
      });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      const networkName = network.name;
      const signer = provider.getSigner();
      const chainId = network.chainId;

      console.log(`📡 Network: ${networkName}, Chain ID: ${chainId}`);

      // Support Ganache and Sepolia
      if (chainId !== 1337 && chainId !== 11155111) {
        alert("Please switch to either:\n- Ganache Local (localhost:7545, Chain ID: 1337)\n- Sepolia Testnet (Chain ID: 11155111)");
        return;
      }

      if (account.length) {
        const addresses = getContractAddresses(chainId);
        console.log("Using contract addresses:", addresses);

        setMetamaskDetails({
          provider: provider,
          networkName: networkName,
          signer: signer,
          currentAccount: account[0],
          chainId: chainId,
          contractAddresses: addresses,
        });

        console.log(`✅ Connected to ${networkName} (Chain ID: ${chainId})`);
      }
    } catch (error) {
      console.error("❌ Connection failed:", error);
      alert(`Connection failed: ${error.message || "Unknown error"}`);
    }
  };

  // LendHub v2 compatible functions
  const LendAssetV2 = async (token, supplyAmount) => {
    try {
      const amount = numberToEthers(supplyAmount);
      console.log(`***Lending token: ${token} | amount: ${supplyAmount}`);

      if (!metamaskDetails.contractAddresses) {
        throw new Error("Contract addresses not loaded");
      }

      const poolAddress = metamaskDetails.contractAddresses.LendingPoolAddress;
      
      // Use v2 ABI
      const poolABI = [
        "function lend(address token, uint256 amount) external payable returns (bool)",
        "function supplied(address user, address token) external view returns (uint256)",
        "function getSupportedTokens() external view returns (address[])"
      ];

      const poolContract = new ethers.Contract(poolAddress, poolABI, metamaskDetails.signer);

      // For v2, we need to use actual token addresses, not ETH special case
      let transaction;
      
      if (token === metamaskDetails.contractAddresses.ETHAddress) {
        // Handle ETH -> WETH conversion for v2
        const wethAddress = metamaskDetails.contractAddresses.WETH;
        
        // First mint WETH if needed
        const wethABI = ["function mint(address to, uint256 amount) external", "function approve(address spender, uint256 amount) returns (bool)"];
        const wethContract = new ethers.Contract(wethAddress, wethABI, metamaskDetails.signer);
        
        console.log("Minting WETH...");
        const mintTx = await wethContract.mint(metamaskDetails.currentAccount, amount);
        await mintTx.wait();
        
        console.log("Approving WETH...");
        const approveTx = await wethContract.approve(poolAddress, amount);
        await approveTx.wait();
        
        console.log("Lending WETH...");
        transaction = await poolContract.lend(wethAddress, amount);
      } else {
        // Handle ERC20 tokens
        const tokenABI = ["function approve(address spender, uint256 amount) returns (bool)"];
        const tokenContract = new ethers.Contract(token, tokenABI, metamaskDetails.signer);
        
        console.log("Approving token...");
        const approveTx = await tokenContract.approve(poolAddress, amount);
        await approveTx.wait();
        
        console.log("Lending token...");
        transaction = await poolContract.lend(token, amount);
      }

      await transaction.wait();
      console.log("✅ Transaction successful");
      return { status: 200, message: "Transaction Successful!" };

    } catch (error) {
      console.error("❌ Lend failed:", error);
      return { status: 500, message: error.message };
    }
  };

  const getUserAssets = async () => {
    console.log("📋 Getting user assets...");
    
    if (!metamaskDetails.currentAccount || !metamaskDetails.contractAddresses) {
      console.log("⏭️ Skipping - not connected");
      return;
    }

    try {
      const addresses = metamaskDetails.contractAddresses;
      const tokensList = getTokensList(metamaskDetails.chainId);
      
      const assets = await Promise.all(
        tokensList.token.map(async (token) => {
          try {
            let balance = "0";
            
            if (token.name === "WETH") {
              // Get WETH balance
              const tokenABI = ["function balanceOf(address) view returns (uint256)"];
              const tokenContract = new ethers.Contract(token.address, tokenABI, metamaskDetails.provider);
              const bal = await tokenContract.balanceOf(metamaskDetails.currentAccount);
              balance = ethers.utils.formatEther(bal);
            } else {
              // Get other token balances
              const tokenABI = ["function balanceOf(address) view returns (uint256)"];
              const tokenContract = new ethers.Contract(token.address, tokenABI, metamaskDetails.provider);
              const bal = await tokenContract.balanceOf(metamaskDetails.currentAccount);
              balance = ethers.utils.formatUnits(bal, token.decimal);
            }

            return {
              image: token.image,
              address: token.address,
              name: token.name,
              apy: token.apy,
              isCollateral: token.isCollateral,
              balance: balance,
            };
          } catch (error) {
            console.error(`Error getting balance for ${token.name}:`, error);
            return {
              image: token.image,
              address: token.address,
              name: token.name,
              apy: token.apy,
              isCollateral: token.isCollateral,
              balance: "0",
            };
          }
        })
      );

      setUserAssets(assets);
      console.log("✅ User assets loaded:", assets);
      
    } catch (error) {
      console.error("❌ Error getting user assets:", error);
    }
  };

  // LendHub v2 price conversion function
  const getAmountInUSD = async (tokenAddress, amount) => {
    try {
      if (!metamaskDetails.contractAddresses) {
        console.log("⏭️ Contract addresses not loaded");
        return 0;
      }

      // Simple price conversion for v2 (using hardcoded prices like original)
      const addresses = metamaskDetails.contractAddresses;
      
      // Convert amount to number
      const tokenAmount = parseFloat(ethers.utils.formatEther(amount));
      
      // Get token symbol to determine price
      let priceUSD = 1; // Default $1
      
      if (tokenAddress === addresses.WETH) {
        priceUSD = 3000; // WETH = $3000
      } else if (tokenAddress === addresses.DAI) {
        priceUSD = 1; // DAI = $1
      } else if (tokenAddress === addresses.USDC) {
        priceUSD = 1; // USDC = $1
      } else if (tokenAddress === addresses.ETHAddress) {
        priceUSD = 3000; // ETH = $3000
      }
      
      const totalUSD = tokenAmount * priceUSD;
      console.log(`💰 ${tokenAmount} tokens × $${priceUSD} = $${totalUSD}`);
      
      return totalUSD;
    } catch (error) {
      console.error("❌ getAmountInUSD error:", error);
      return 0;
    }
  };

  // Load market metrics for AssetMetrics component
  const loadAssetMetrics = async () => {
    if (!metamaskDetails.contractAddresses || !metamaskDetails.provider) {
      console.log("⏭️ Skipping asset metrics - not connected");
      return;
    }

    try {
      console.log("📊 Loading asset metrics...");
      const poolAddress = metamaskDetails.contractAddresses.LendingPoolAddress;
      
      const poolABI = [
        "function getSupportedTokens() external view returns (address[])",
        "function tokenStates(address) external view returns (uint128 cash, uint128 borrows, uint64 lastAccrue, uint64 indexSupply, uint64 indexBorrow)"
      ];

      const pool = new ethers.Contract(poolAddress, poolABI, metamaskDetails.provider);
      const supportedTokens = await pool.getSupportedTokens();
      
      const metrics = [];
      
      for (const tokenAddress of supportedTokens) {
        try {
          const tokenState = await pool.tokenStates(tokenAddress);
          const cash = parseFloat(ethers.utils.formatEther(tokenState.cash));
          const borrows = parseFloat(ethers.utils.formatEther(tokenState.borrows));
          
          // Get token symbol
          let symbol = "UNKNOWN";
          if (tokenAddress === metamaskDetails.contractAddresses.WETH) symbol = "WETH";
          else if (tokenAddress === metamaskDetails.contractAddresses.DAI) symbol = "DAI";
          else if (tokenAddress === metamaskDetails.contractAddresses.USDC) symbol = "USDC";
          
          // Calculate utilization
          const totalSupply = cash + borrows;
          const utilization = totalSupply > 0 ? (borrows / totalSupply) * 100 : 0;
          
          // Calculate APYs (simplified)
          const baseRate = 2; // 2% base
          const utilizationRate = utilization / 100;
          const borrowRate = baseRate + (utilizationRate * 5); // Simple model
          const supplyRate = borrowRate * utilizationRate * 0.9; // 90% of borrow rate
          
          metrics.push({
            symbol,
            name: symbol,
            cash: cash.toString(),
            borrows: borrows.toString(),
            supplyRate: (supplyRate / 100).toString(),
            borrowRate: (borrowRate / 100).toString(),
            totalSupply: totalSupply.toString(),
            totalBorrow: borrows.toString(),
            totalSupplyUSD: (totalSupply * (symbol === "WETH" ? 3000 : 1)).toString(),
            totalBorrowUSD: (borrows * (symbol === "WETH" ? 3000 : 1)).toString()
          });
          
        } catch (error) {
          console.error(`Error loading metrics for ${tokenAddress}:`, error);
        }
      }
      
      setAssetMetrics(metrics);
      console.log("✅ Asset metrics loaded:", metrics);
      
    } catch (error) {
      console.error("❌ Error loading asset metrics:", error);
    }
  };

  // Placeholder functions for compatibility
  const getYourSupplies = async () => {
    console.log("📋 Getting supplies (v2)...");
    // Load asset metrics when getting supplies
    loadAssetMetrics();
  };

  const getAssetsToBorrow = async () => {
    console.log("📋 Getting borrow assets (v2)...");
    // TODO: Implement v2 borrow assets logic
  };

  const getYourBorrows = async () => {
    console.log("📋 Getting borrows (v2)...");
    // TODO: Implement v2 borrows logic
  };

  const updateInterests = async () => {
    console.log("📊 Updating interests (v2)...");
    // TODO: Implement v2 interest updates
  };

  const WithdrawAsset = async (tokenAddress, withdrawAmount) => {
    console.log("💸 Withdraw (v2):", tokenAddress, withdrawAmount);
    // TODO: Implement v2 withdraw
    return { status: 200, message: "Withdraw not implemented yet" };
  };

  const borrowAsset = async (token, borrowAmount) => {
    console.log("💰 Borrow (v2):", token, borrowAmount);
    // TODO: Implement v2 borrow
    return { status: 200, message: "Borrow not implemented yet" };
  };

  const repayAsset = async (tokenAddress, repayAmount) => {
    console.log("💳 Repay (v2):", tokenAddress, repayAmount);
    // TODO: Implement v2 repay
    return { status: 200, message: "Repay not implemented yet" };
  };

  const ApproveToContinue = async (tokenAddress, approveAmount) => {
    console.log("✅ Approve (v2):", tokenAddress, approveAmount);
    // TODO: Implement v2 approve
    return { status: 200, message: "Approve not implemented yet" };
  };

  return (
    <LendContext.Provider
      value={{
        metamaskDetails,
        connectWallet,
        getUserAssets,
        supplySummary,
        LendAsset: LendAssetV2, // Use v2 implementation
        ApproveToContinue,
        userAssets,
        getYourSupplies,
        supplyAssets,
        WithdrawAsset,
        getAssetsToBorrow,
        assetsToBorrow,
        borrowAsset,
        getYourBorrows,
        yourBorrows,
        repayAsset,
        borrowSummary,
        updateInterests,
        // v2 specific data
        healthFactor,
        borrowPower,
        utilizationRate,
        assetMetrics,
        // Price functions
        getAmountInUSD,
        numberToEthers,
      }}
    >
      {props.children}
    </LendContext.Provider>
  );
};

export default LendStateV2;
