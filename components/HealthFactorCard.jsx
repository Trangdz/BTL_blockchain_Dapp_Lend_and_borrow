import React from "react";

const HealthFactorCard = ({ healthFactor, borrowPower, utilizationRate }) => {
  // Format health factor for display
  const formatHealthFactor = (hf) => {
    if (!hf || hf === "0") return "∞";
    const num = parseFloat(hf);
    return num.toFixed(2);
  };

  // Get health factor status
  const getHealthFactorStatus = (hf) => {
    if (!hf || hf === "0") return { status: "safe", color: "text-green-500" };
    const num = parseFloat(hf);
    if (num >= 1.5) return { status: "safe", color: "text-green-500" };
    if (num >= 1.2) return { status: "warning", color: "text-yellow-500" };
    if (num >= 1.0) return { status: "danger", color: "text-orange-500" };
    return { status: "liquidatable", color: "text-red-500" };
  };

  // Get utilization color
  const getUtilizationColor = (rate) => {
    const num = parseFloat(rate || "0");
    if (num <= 60) return "text-green-500";
    if (num <= 80) return "text-yellow-500";
    return "text-red-500";
  };

  const hfStatus = getHealthFactorStatus(healthFactor);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Account Health
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Factor */}
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Health Factor
          </div>
          <div className={`text-2xl font-bold ${hfStatus.color}`}>
            {formatHealthFactor(healthFactor)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {hfStatus.status === "safe" && "Safe"}
            {hfStatus.status === "warning" && "Monitor"}
            {hfStatus.status === "danger" && "At Risk"}
            {hfStatus.status === "liquidatable" && "Liquidatable"}
          </div>
        </div>

        {/* Borrow Power */}
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Available Borrow Power
          </div>
          <div className="text-2xl font-bold text-blue-500">
            ${borrowPower ? parseFloat(borrowPower).toLocaleString() : "0"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            USD Value
          </div>
        </div>

        {/* Utilization Rate */}
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Borrow Utilization
          </div>
          <div className={`text-2xl font-bold ${getUtilizationColor(utilizationRate)}`}>
            {utilizationRate ? `${parseFloat(utilizationRate).toFixed(1)}%` : "0%"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Of Available
          </div>
        </div>
      </div>

      {/* Health Factor Warning */}
      {hfStatus.status === "danger" && (
        <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 rounded-lg">
          <div className="flex items-center">
            <div className="text-orange-600 dark:text-orange-400 text-sm">
              ⚠️ Your position is at risk. Consider adding collateral or repaying debt.
            </div>
          </div>
        </div>
      )}

      {hfStatus.status === "liquidatable" && (
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-600 dark:text-red-400 text-sm">
              🚨 Your position may be liquidated. Urgent action required!
            </div>
          </div>
        </div>
      )}

      {/* Health Factor Explanation */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>
          Health Factor = (Collateral Value × Liquidation Threshold) ÷ Borrowed Value
        </p>
        <p className="mt-1">
          Values below 1.0 may trigger liquidation. Keep above 1.2 for safety.
        </p>
      </div>
    </div>
  );
};

export default HealthFactorCard;

