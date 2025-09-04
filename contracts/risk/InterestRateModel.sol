// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/Errors.sol";

/// @title InterestRateModel
/// @notice Library for calculating interest rates using kink model
library InterestRateModel {
    uint256 public constant PRECISION = 1e18;
    
    /// @notice Calculate utilization rate
    /// @param cash Available cash in the pool
    /// @param borrows Total borrowed amount
    /// @return util Utilization rate in 1e18 precision
    function utilization(uint256 cash, uint256 borrows) internal pure returns (uint256 util) {
        if (cash == 0 && borrows == 0) return 0;
        
        uint256 total = cash + borrows;
        if (total == 0) revert Errors.ErrDivisionByZero();
        
        util = (borrows * PRECISION) / total;
    }
    
    /// @notice Calculate borrow rate using kink model
    /// @param util Current utilization rate (1e18)
    /// @param rBase Base interest rate (1e18 per year)
    /// @param slope1 Interest rate slope before kink (1e18 per year)
    /// @param slope2 Interest rate slope after kink (1e18 per year)
    /// @param kink Utilization rate at which slope changes (1e18)
    /// @return rBorrowRate Borrow rate per year in 1e18 precision
    function rBorrow(
        uint256 util,
        uint256 rBase,
        uint256 slope1,
        uint256 slope2,
        uint256 kink
    ) internal pure returns (uint256 rBorrowRate) {
        if (util <= kink) {
            // Before kink: rBase + slope1 * util
            rBorrowRate = rBase + (slope1 * util) / PRECISION;
        } else {
            // After kink: rBase + slope1 * kink + slope2 * (util - kink)
            uint256 excessUtil = util - kink;
            rBorrowRate = rBase + (slope1 * kink) / PRECISION + (slope2 * excessUtil) / PRECISION;
        }
    }
    
    /// @notice Calculate supply rate
    /// @param rBorrowRate Borrow rate (1e18 per year)
    /// @param util Current utilization rate (1e18)
    /// @param reserveFactor Reserve factor (1e18)
    /// @return rSupplyRate Supply rate per year in 1e18 precision
    function rSupply(
        uint256 rBorrowRate,
        uint256 util,
        uint256 reserveFactor
    ) internal pure returns (uint256 rSupplyRate) {
        // rSupply = rBorrow * util * (1 - reserveFactor)
        uint256 oneMinusReserveFactor = PRECISION - reserveFactor;
        rSupplyRate = (rBorrowRate * util * oneMinusReserveFactor) / (PRECISION * PRECISION);
    }
}
