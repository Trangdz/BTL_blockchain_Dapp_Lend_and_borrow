import { useState, useEffect } from 'react';

export default function Debug() {
  const [walletInfo, setWalletInfo] = useState({
    hasMetaMask: false,
    isConnected: false,
    accounts: [],
    chainId: null,
    error: null,
  });

  const checkWallet = async () => {
    try {
      // Check if window.ethereum exists
      if (typeof window.ethereum === 'undefined') {
        setWalletInfo(prev => ({
          ...prev,
          hasMetaMask: false,
          error: 'MetaMask not installed'
        }));
        return;
      }

      setWalletInfo(prev => ({ ...prev, hasMetaMask: true }));

      // Check current connection
      const accounts = await window.ethereum.request({ 
        method: 'eth_accounts' 
      });
      
      const chainId = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });

      setWalletInfo(prev => ({
        ...prev,
        isConnected: accounts.length > 0,
        accounts: accounts,
        chainId: parseInt(chainId, 16),
        error: null
      }));

    } catch (error) {
      console.error('Check wallet error:', error);
      setWalletInfo(prev => ({
        ...prev,
        error: error.message
      }));
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const chainId = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });

      setWalletInfo(prev => ({
        ...prev,
        isConnected: true,
        accounts: accounts,
        chainId: parseInt(chainId, 16),
        error: null
      }));

      console.log('✅ Connected successfully:', { accounts, chainId });

    } catch (error) {
      console.error('❌ Connection failed:', error);
      setWalletInfo(prev => ({
        ...prev,
        error: `Connection failed: ${error.message}`
      }));

      if (error.code === 4001) {
        alert('Connection rejected by user');
      } else if (error.code === -32002) {
        alert('Connection already pending in MetaMask');
      }
    }
  };

  const addGanacheNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x539', // 1337 in hex
          chainName: 'Ganache Local',
          rpcUrls: ['http://127.0.0.1:7545'],
          nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
          }
        }]
      });
      
      console.log('✅ Ganache network added');
      checkWallet(); // Refresh info
      
    } catch (error) {
      console.error('❌ Failed to add network:', error);
      alert(`Failed to add Ganache network: ${error.message}`);
    }
  };

  const switchToGanache = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x539' }], // 1337 in hex
      });
      
      console.log('✅ Switched to Ganache');
      checkWallet(); // Refresh info
      
    } catch (error) {
      console.error('❌ Failed to switch network:', error);
      
      // If network doesn't exist, add it
      if (error.code === 4902) {
        addGanacheNetwork();
      } else {
        alert(`Failed to switch network: ${error.message}`);
      }
    }
  };

  useEffect(() => {
    checkWallet();
  }, []);

  const getChainName = (chainId) => {
    switch (chainId) {
      case 1: return 'Ethereum Mainnet';
      case 3: return 'Ropsten Testnet';
      case 4: return 'Rinkeby Testnet';
      case 5: return 'Goerli Testnet';
      case 11155111: return 'Sepolia Testnet';
      case 1337: return 'Ganache Local';
      default: return `Unknown (${chainId})`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🔧 LendHub v2 - Wallet Debug
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet Status</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>MetaMask Installed:</span>
              <span className={walletInfo.hasMetaMask ? 'text-green-600' : 'text-red-600'}>
                {walletInfo.hasMetaMask ? '✅ Yes' : '❌ No'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Connected:</span>
              <span className={walletInfo.isConnected ? 'text-green-600' : 'text-red-600'}>
                {walletInfo.isConnected ? '✅ Yes' : '❌ No'}
              </span>
            </div>

            {walletInfo.accounts.length > 0 && (
              <div>
                <span className="font-medium">Account:</span>
                <div className="text-sm font-mono bg-gray-100 p-2 rounded mt-1">
                  {walletInfo.accounts[0]}
                </div>
              </div>
            )}

            {walletInfo.chainId && (
              <div className="flex justify-between">
                <span>Network:</span>
                <span className="text-blue-600">
                  {getChainName(walletInfo.chainId)} ({walletInfo.chainId})
                </span>
              </div>
            )}

            {walletInfo.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>Error:</strong> {walletInfo.error}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          
          <div className="space-y-3">
            <button
              onClick={checkWallet}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              🔄 Refresh Wallet Info
            </button>

            <button
              onClick={connectWallet}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
              disabled={!walletInfo.hasMetaMask}
            >
              🔗 Connect Wallet
            </button>

            <button
              onClick={switchToGanache}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded"
              disabled={!walletInfo.hasMetaMask}
            >
              🟢 Switch to Ganache (1337)
            </button>

            <button
              onClick={addGanacheNetwork}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded"
              disabled={!walletInfo.hasMetaMask}
            >
              ➕ Add Ganache Network
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Troubleshooting Steps</h2>
          
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Make sure MetaMask is installed in your browser</li>
            <li>Make sure MetaMask is unlocked</li>
            <li>Try refreshing the page</li>
            <li>Make sure Ganache is running on port 7545</li>
            <li>Add/switch to Ganache network using buttons above</li>
            <li>Try connecting wallet again</li>
            <li>Check browser console for detailed error messages</li>
          </ol>
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

