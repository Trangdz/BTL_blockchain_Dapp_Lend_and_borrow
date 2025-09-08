import React, { useContext, useState } from "react";
import lendContext from "../context/lendContext";

const RefreshDataButton = () => {
  const { 
    getUserAssets, 
    getYourSupplies, 
    getAssetsToBorrow, 
    getYourBorrows,
    metamaskDetails 
  } = useContext(lendContext);
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAllData = async () => {
    if (!metamaskDetails.currentAccount) {
      alert("Please connect wallet first");
      return;
    }

    setIsRefreshing(true);
    console.log("🔄 Manual data refresh started...");

    try {
      // Refresh all data
      await getUserAssets();
      await getYourSupplies();
      await getAssetsToBorrow();
      await getYourBorrows();
      
      console.log("✅ All data refreshed successfully");
    } catch (error) {
      console.error("❌ Refresh failed:", error);
    }
    
    setIsRefreshing(false);
  };

  if (!metamaskDetails.currentAccount) {
    return null; // Don't show if not connected
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={refreshAllData}
        disabled={isRefreshing}
        className={`
          px-4 py-2 rounded-lg shadow-lg font-medium text-sm
          ${isRefreshing 
            ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'
          }
        `}
      >
        {isRefreshing ? (
          <>
            <span className="animate-spin inline-block mr-2">⟳</span>
            Refreshing...
          </>
        ) : (
          <>
            🔄 Refresh Data
          </>
        )}
      </button>
    </div>
  );
};

export default RefreshDataButton;

