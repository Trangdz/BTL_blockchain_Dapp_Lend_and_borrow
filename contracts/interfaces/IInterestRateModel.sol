// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IInterestRateModel
/// @notice Interface for interest rate models
interface IInterestRateModel {
    /// @notice Calculate utilization rate
    /// @param cash Available cash in the pool
    /// @param borrows Total borrowed amount
    /// @return Utilization rate in 1e18 precision
    function utilization(uint256 cash, uint256 borrows) external pure returns (uint256);
    
    /// @notice Calculate borrow rate
    /// @param util Current utilization rate
    /// @param rBase Base interest rate
    /// @param slope1 Interest rate slope before kink
    /// @param slope2 Interest rate slope after kink
    /// @param kink Utilization rate at which slope changes
    /// @return Borrow rate per year in 1e18 precision
    function rBorrow(
        uint256 util,
        uint256 rBase,
        uint256 slope1,
        uint256 slope2,
        uint256 kink
    ) external pure returns (uint256);
    
    /// @notice Calculate supply rate
    /// @param rBorrowRate Borrow rate
    /// @param util Current utilization rate
    /// @param reserveFactor Reserve factor
    /// @return Supply rate per year in 1e18 precision
    function rSupply(
        uint256 rBorrowRate,
        uint256 util,
        uint256 reserveFactor
    ) external pure returns (uint256);
}
