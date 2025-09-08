import React, { useState, useContext } from "react";
import lendContext from "../context/lendContext";

const TestLend = () => {
  const { 
    metamaskDetails, 
    connectWallet, 
    LendAsset, 
    fetchUserAssets,
    userAssets 
  } = useContext(lendContext);
  
  const [testAmount, setTestAmount] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const testLend = async () => {
    if (!metamaskDetails.currentAccount) {
      addLog("❌ Please connect wallet first");
      return;
    }

    setIsLoading(true);
    addLog(`🧪 Testing lend of ${testAmount} ETH...`);

    try {
      // Get ETH asset (native ETH)
      const ethAsset = userAssets.find(asset => asset.symbol === "ETH");
      if (!ethAsset) {
        addLog("❌ No ETH asset found");
        setIsLoading(false);
        return;
      }

      addLog(`📊 Found ETH asset: ${ethAsset.balance} (address: ${ethAsset.address})`);

      // Test lend
      const result = await LendAsset(ethAsset.address, testAmount);
      
      if (result.status === 200) {
        addLog(`✅ Lend successful! TX: ${result.txHash}`);
        
        // Refresh data
        addLog("🔄 Refreshing data...");
        await fetchUserAssets();
        addLog("✅ Data refreshed");
      } else {
        addLog(`❌ Lend failed: ${result.message}`);
      }

    } catch (error) {
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🧪 ETH Lend Test</h1>
        
        {/* Connection Status */}
        <div className="bg-white rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          {metamaskDetails.currentAccount ? (
            <div className="text-green-600">
              ✅ Connected: {metamaskDetails.currentAccount}
              <br />
              Network: {metamaskDetails.networkName}
            </div>
          ) : (
            <div className="text-red-600">
              ❌ Not connected
              <button 
                onClick={connectWallet}
                className="ml-4 bg-blue-500 text-white px-4 py-2 rounded"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>

        {/* User Assets */}
        <div className="bg-white rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Assets</h2>
          {userAssets.length > 0 ? (
            <div className="space-y-2">
              {userAssets.map((asset, index) => (
                <div key={index} className="border p-3 rounded">
                  <div className="font-semibold">{asset.symbol}</div>
                  <div>Balance: {asset.balance}</div>
                  <div>Address: {asset.address}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No assets found</div>
          )}
        </div>

        {/* Test Controls */}
        <div className="bg-white rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Lend</h2>
          <div className="flex gap-4 items-center">
            <input
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              placeholder="Amount to lend"
              className="border p-2 rounded"
            />
            <button
              onClick={testLend}
              disabled={isLoading || !metamaskDetails.currentAccount}
              className="bg-green-500 text-white px-6 py-2 rounded disabled:bg-gray-400"
            >
              {isLoading ? "Testing..." : "Test Lend"}
            </button>
            <button
              onClick={clearLogs}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-black text-green-400 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Debug Logs</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-sm font-mono">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestLend;

