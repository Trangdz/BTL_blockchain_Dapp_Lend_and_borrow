// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Errors
/// @notice Custom error definitions for LendHub v2
library Errors {
    // General errors
    error ErrZeroAmount();
    error ErrZeroAddress();
    error ErrInvalidToken();
    error ErrTransferFailed();
    
    // Pool errors
    error ErrPoolNotFound();
    error ErrPoolAlreadyExists();
    error ErrInvalidPool();
    
    // Lending errors
    error ErrInsufficientBalance();
    error ErrInsufficientLiquidity();
    error ErrInsufficientCollateral();
    error ErrExceedsBalance();
    
    // Oracle errors
    error ErrStalePrice();
    error ErrInvalidPrice();
    error ErrOracleNotFound();
    
    // Health Factor errors
    error ErrHealthFactorTooLow();
    error ErrUserHealthy();
    error ErrLiquidationFailed();
    
    // Access control errors
    error ErrUnauthorized();
    error ErrNotLiquidator();
    
    // Configuration errors
    error ErrInvalidConfiguration();
    error ErrInvalidRiskParams();
    
    // Math errors
    error ErrDivisionByZero();
    error ErrOverflow();
}
