import React from "react";

const AssetMetrics = ({ assetData }) => {
  // Calculate utilization rate
  const calculateUtilization = (cash, borrows) => {
    const cashNum = parseFloat(cash || "0");
    const borrowsNum = parseFloat(borrows || "0");
    const total = cashNum + borrowsNum;
    
    if (total === 0) return 0;
    return (borrowsNum / total) * 100;
  };

  // Calculate APY from rate (assuming rate is annual)
  const formatAPY = (rate) => {
    if (!rate) return "0.00";
    const rateNum = parseFloat(rate);
    return (rateNum * 100).toFixed(2);
  };

  // Get utilization color
  const getUtilizationColor = (utilization) => {
    if (utilization <= 60) return "text-green-500";
    if (utilization <= 80) return "text-yellow-500";
    return "text-red-500";
  };

  if (!assetData || assetData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Market Overview
        </h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No asset data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Market Overview
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-2 font-medium text-gray-900 dark:text-white">
                Asset
              </th>
              <th className="text-right py-3 px-2 font-medium text-gray-900 dark:text-white">
                Supply APY
              </th>
              <th className="text-right py-3 px-2 font-medium text-gray-900 dark:text-white">
                Borrow APY
              </th>
              <th className="text-right py-3 px-2 font-medium text-gray-900 dark:text-white">
                Utilization
              </th>
              <th className="text-right py-3 px-2 font-medium text-gray-900 dark:text-white">
                Total Supply
              </th>
              <th className="text-right py-3 px-2 font-medium text-gray-900 dark:text-white">
                Total Borrow
              </th>
            </tr>
          </thead>
          <tbody>
            {assetData.map((asset, index) => {
              const utilization = calculateUtilization(asset.cash, asset.borrows);
              
              return (
                <tr 
                  key={index}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs mr-3">
                        {asset.symbol?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {asset.symbol || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {asset.name || ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className="font-medium text-green-600 dark:text-green-400">
                      {formatAPY(asset.supplyRate)}%
                    </div>
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className="font-medium text-red-600 dark:text-red-400">
                      {formatAPY(asset.borrowRate)}%
                    </div>
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className={`font-medium ${getUtilizationColor(utilization)}`}>
                      {utilization.toFixed(1)}%
                    </div>
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className="text-gray-900 dark:text-white">
                      {asset.totalSupply ? parseFloat(asset.totalSupply).toLocaleString() : "0"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ${asset.totalSupplyUSD ? parseFloat(asset.totalSupplyUSD).toLocaleString() : "0"}
                    </div>
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className="text-gray-900 dark:text-white">
                      {asset.totalBorrow ? parseFloat(asset.totalBorrow).toLocaleString() : "0"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ${asset.totalBorrowUSD ? parseFloat(asset.totalBorrowUSD).toLocaleString() : "0"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Market Stats Summary */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {assetData.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Markets
          </div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {(() => {
              const avgSupplyAPY = assetData.reduce((sum, asset) => 
                sum + parseFloat(asset.supplyRate || "0"), 0) / assetData.length;
              return formatAPY(avgSupplyAPY);
            })()}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Avg Supply APY
          </div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {(() => {
              const avgBorrowAPY = assetData.reduce((sum, asset) => 
                sum + parseFloat(asset.borrowRate || "0"), 0) / assetData.length;
              return formatAPY(avgBorrowAPY);
            })()}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Avg Borrow APY
          </div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {(() => {
              const avgUtilization = assetData.reduce((sum, asset) => 
                sum + calculateUtilization(asset.cash, asset.borrows), 0) / assetData.length;
              return avgUtilization.toFixed(1);
            })()}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Avg Utilization
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>
          APY rates are calculated using the kink interest rate model based on current utilization.
        </p>
        <p className="mt-1">
          Higher utilization typically leads to higher interest rates for both suppliers and borrowers.
        </p>
      </div>
    </div>
  );
};

export default AssetMetrics;

