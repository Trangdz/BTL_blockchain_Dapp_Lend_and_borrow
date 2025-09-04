import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function TestSupply() {
  const [status, setStatus] = useState('');
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('');
  const [contractInfo, setContractInfo] = useState(null);

  // Contract addresses from latest deployment
  const CORE_POOL = "0x6739F8bf3b2315272BBC8B85Ef1EF9C0E300C3A7";
  const WETH_TOKEN = "0x5E55961B93EEecF9f1852A2d0208Be95b434ad8c";

  // ABIs - Updated for LendHub v2
  const POOL_ABI = [
    "function lend(address token, uint256 amount) external payable nonReentrant whenNotPaused",
    "function getSupportedTokens() external view returns (address[] memory)",
    "function supplied(address user, address token) external view returns (uint256)",
    "function poolBalance(address token) external view returns (uint256)",
    "function getHealthFactor(address user) external view returns (uint256)",
    "function addToken(address token) external",
    "function supportedTokens(uint256) external view returns (address)"
  ];

  const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function mint(address to, uint256 amount) external"
  ];

  const connectWallet = async () => {
    try {
      setStatus('Connecting...');
      
      if (!window.ethereum) {
        setStatus('❌ MetaMask not found');
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      
      if (network.chainId !== 1337) {
        setStatus(`❌ Wrong network. Current: ${network.chainId}, Need: 1337`);
        return;
      }

      setAccount(accounts[0]);
      const balance = await provider.getBalance(accounts[0]);
      setBalance(ethers.utils.formatEther(balance));
      
      setStatus('✅ Connected to Ganache');

      // Test contract
      await testContract(provider, accounts[0]);

    } catch (error) {
      setStatus(`❌ Connection failed: ${error.message}`);
    }
  };

  const testContract = async (provider, userAccount) => {
    try {
      setStatus('📋 Testing contract...');

      const poolContract = new ethers.Contract(CORE_POOL, POOL_ABI, provider);
      
      // Test read functions
      const supportedTokens = await poolContract.getSupportedTokens();
      const poolBalance = await poolContract.poolBalance(WETH_TOKEN);
      
      console.log('Supported tokens:', supportedTokens);
      console.log('Pool balance:', ethers.utils.formatEther(poolBalance));

      setContractInfo({
        supportedTokens: supportedTokens.length,
        poolBalance: ethers.utils.formatEther(poolBalance),
        poolAddress: CORE_POOL
      });

      setStatus('✅ Contract connection successful');

    } catch (error) {
      setStatus(`❌ Contract test failed: ${error.message}`);
      console.error('Contract error:', error);
    }
  };

  const testSupply = async () => {
    try {
      setStatus('🔄 Testing supply...');

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const poolContract = new ethers.Contract(CORE_POOL, POOL_ABI, signer);

      const amount = ethers.utils.parseEther("0.1"); // 0.1 ETH

      // Try WETH instead of ETH since that's what was deployed
      setStatus('📝 Sending WETH transaction...');
      
      // First approve WETH
      const wethContract = new ethers.Contract(WETH_TOKEN, TOKEN_ABI, signer);
      
      // Check WETH balance
      const wethBalance = await wethContract.balanceOf(await signer.getAddress());
      setStatus(`WETH Balance: ${ethers.utils.formatEther(wethBalance)}`);
      
      if (wethBalance.lt(amount)) {
        setStatus('💰 Minting WETH...');
        const mintTx = await wethContract.mint(await signer.getAddress(), ethers.utils.parseEther("10"));
        await mintTx.wait();
        setStatus('✅ WETH minted successfully');
      }
      
      // Approve WETH
      setStatus('📝 Approving WETH...');
      const approveTx = await wethContract.approve(CORE_POOL, amount);
      await approveTx.wait();
      
      setStatus('📝 Sending lend transaction...');
      const tx = await poolContract.lend(WETH_TOKEN, amount, {
        gasLimit: 500000
      });

      setStatus('⏳ Waiting for confirmation...');
      const receipt = await tx.wait();
      
      setStatus(`✅ Supply successful! Hash: ${receipt.transactionHash}`);

    } catch (error) {
      setStatus(`❌ Supply failed: ${error.message}`);
      console.error('Supply error:', error);
      
      // More detailed error logging
      if (error.data) {
        console.error('Error data:', error.data);
      }
      if (error.reason) {
        console.error('Error reason:', error.reason);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🧪 LendHub v2 - Supply Test
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          
          <div className="space-y-3">
            <div>
              <strong>Status:</strong>
              <div className="mt-1 p-2 bg-gray-100 rounded text-sm">
                {status || 'Not connected'}
              </div>
            </div>

            {account && (
              <div>
                <strong>Account:</strong>
                <div className="mt-1 p-2 bg-gray-100 rounded text-sm font-mono">
                  {account}
                </div>
              </div>
            )}

            {balance && (
              <div>
                <strong>Balance:</strong>
                <div className="mt-1 p-2 bg-gray-100 rounded text-sm">
                  {balance} ETH
                </div>
              </div>
            )}

            {contractInfo && (
              <div>
                <strong>Contract Info:</strong>
                <div className="mt-1 p-2 bg-gray-100 rounded text-sm">
                  <div>Pool: {contractInfo.poolAddress}</div>
                  <div>Supported Tokens: {contractInfo.supportedTokens}</div>
                  <div>Pool Balance: {contractInfo.poolBalance} ETH</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          
          <div className="space-y-3">
            <button
              onClick={connectWallet}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              🔗 Connect & Test Contract
            </button>

            <button
              onClick={testSupply}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
              disabled={!account}
            >
              💰 Test Supply 0.1 WETH
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Contract Details</h2>
          
          <div className="text-sm space-y-2">
            <div><strong>CORE Pool:</strong> {CORE_POOL}</div>
            <div><strong>WETH Token:</strong> {WETH_TOKEN}</div>
            <div><strong>Network:</strong> Ganache (Chain ID: 1337)</div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a 
            href="/" 
            className="text-blue-500 hover:text-blue-700 underline"
          >
            ← Back to LendHub v2
          </a>
        </div>
      </div>
    </div>
  );
}
