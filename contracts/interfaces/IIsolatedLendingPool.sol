// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IIsolatedLendingPool
/// @notice Interface for isolated lending pools
interface IIsolatedLendingPool {
    struct TokenState {
        uint128 cash;          // Available cash in pool
        uint128 borrows;       // Total borrowed amount
        uint64 lastAccrue;     // Last accrual timestamp
        uint64 indexSupply;    // Supply index (compound interest)
        uint64 indexBorrow;    // Borrow index (compound interest)
    }
    
    struct BorrowAsset {
        address token;
        uint256 borrowQty;
        uint256 borrowApy;
    }
    
    /// @notice Lend tokens to the pool
    /// @param token Token address
    /// @param amount Amount to lend
    /// @return success True if successful
    function lend(address token, uint256 amount) external payable returns (bool);
    
    /// @notice Withdraw tokens from the pool
    /// @param token Token address
    /// @param amount Amount to withdraw
    /// @return success True if successful
    function withdraw(address token, uint256 amount) external returns (bool);
    
    /// @notice Borrow tokens from the pool
    /// @param token Token address
    /// @param amount Amount to borrow
    /// @return success True if successful
    function borrow(address token, uint256 amount) external returns (bool);
    
    /// @notice Repay borrowed tokens
    /// @param token Token address
    /// @param amount Amount to repay
    /// @return success True if successful
    function repay(address token, uint256 amount) external returns (bool);
    
    /// @notice Get pool balance for a token
    /// @param token Token address
    /// @return balance Pool balance
    function poolBalance(address token) external view returns (uint256);
    
    /// @notice Get assets available to borrow for a user
    /// @param user User address
    /// @return assets Array of borrowable assets
    function getAssetsToBorrow(address user) external view returns (BorrowAsset[] memory);
    
    /// @notice Get user's total available balance in USD
    /// @param user User address
    /// @return balance Available balance in USD
    function getUserTotalAvailableBalanceInUSD(address user) external view returns (uint256);
}
