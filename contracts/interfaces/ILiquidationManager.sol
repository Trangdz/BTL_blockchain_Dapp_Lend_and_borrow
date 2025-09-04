// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title ILiquidationManager
/// @notice Interface for liquidation management
interface ILiquidationManager {
    /// @notice Calculate health factor for a user
    /// @param user User address
    /// @param pool Pool address
    /// @return hf Health factor in 1e18 precision
    /// @return collateralUSD Total collateral value in USD
    /// @return borrowUSD Total borrow value in USD
    function calcHealthFactor(address user, address pool) 
        external 
        view 
        returns (uint256 hf, uint256 collateralUSD, uint256 borrowUSD);
    
    /// @notice Liquidate a user's position
    /// @param user User to liquidate
    /// @param pool Pool address
    /// @param debtToken Token to repay
    /// @param repayAmount Amount to repay
    /// @param collateralToken Collateral token to seize
    function liquidate(
        address user,
        address pool,
        address debtToken,
        uint256 repayAmount,
        address collateralToken
    ) external;
    
    /// @notice Check if a user is liquidatable
    /// @param user User address
    /// @param pool Pool address
    /// @return liquidatable True if user can be liquidated
    function isLiquidatable(address user, address pool) external view returns (bool);
}
