// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../libraries/Errors.sol";

/// @title LendingConfigV2
/// @notice Configuration contract for LendHub v2 with isolated pools support
contract LendingConfigV2 is AccessControl {
    bytes32 public constant RISK_ADMIN = keccak256("RISK_ADMIN");
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_LTV = 0.9e18; // 90%
    uint256 public constant MAX_LT = 0.95e18; // 95%
    uint256 public constant MAX_RESERVE_FACTOR = 0.5e18; // 50%
    
    struct RiskParams {
        uint256 LTV;           // Loan-to-value ratio (1e18)
        uint256 LT;            // Liquidation threshold (1e18)
        uint256 kink;          // Kink point for interest rate model (1e18)
        uint256 rBase;         // Base interest rate (1e18 per year)
        uint256 slope1;        // Interest rate slope before kink (1e18 per year)
        uint256 slope2;        // Interest rate slope after kink (1e18 per year)
    }
    
    struct PoolConfig {
        uint256 reserveFactor;      // Reserve factor (1e18)
        uint256 liquidationBonus;   // Liquidation bonus (1e18)
        bool isActive;              // Pool active status
        bool isPaused;              // Pool pause status
    }
    
    // Pool => Token => RiskParams
    mapping(address => mapping(address => RiskParams)) public riskParams;
    
    // Pool => PoolConfig
    mapping(address => PoolConfig) public poolConfigs;
    
    // Oracle staleness threshold (seconds)
    uint256 public oracleStaleThreshold = 3600; // 1 hour
    
    // Events
    event RiskParamsUpdated(
        address indexed pool,
        address indexed token,
        uint256 LTV,
        uint256 LT,
        uint256 kink,
        uint256 rBase,
        uint256 slope1,
        uint256 slope2
    );
    
    event PoolConfigUpdated(
        address indexed pool,
        uint256 reserveFactor,
        uint256 liquidationBonus,
        bool isActive,
        bool isPaused
    );
    
    event OracleStaleThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_ADMIN, msg.sender);
    }
    
    /// @notice Set risk parameters for a token in a pool
    /// @param pool Pool address
    /// @param token Token address
    /// @param params Risk parameters
    function setRiskParams(
        address pool,
        address token,
        RiskParams calldata params
    ) external onlyRole(RISK_ADMIN) {
        _setRiskParamsInternal(pool, token, params);
    }
    
    /// @notice Set pool configuration
    /// @param pool Pool address
    /// @param config Pool configuration
    function setPoolConfig(
        address pool,
        PoolConfig calldata config
    ) external onlyRole(RISK_ADMIN) {
        if (pool == address(0)) revert Errors.ErrZeroAddress();
        if (config.reserveFactor > MAX_RESERVE_FACTOR) revert Errors.ErrInvalidConfiguration();
        
        poolConfigs[pool] = config;
        
        emit PoolConfigUpdated(
            pool,
            config.reserveFactor,
            config.liquidationBonus,
            config.isActive,
            config.isPaused
        );
    }
    
    /// @notice Set oracle stale threshold
    /// @param threshold New threshold in seconds
    function setOracleStaleThreshold(uint256 threshold) external onlyRole(RISK_ADMIN) {
        uint256 oldThreshold = oracleStaleThreshold;
        oracleStaleThreshold = threshold;
        emit OracleStaleThresholdUpdated(oldThreshold, threshold);
    }
    
    /// @notice Batch set risk parameters for multiple tokens
    /// @param pool Pool address
    /// @param tokens Array of token addresses
    /// @param params Array of risk parameters
    function batchSetRiskParams(
        address pool,
        address[] calldata tokens,
        RiskParams[] calldata params
    ) external onlyRole(RISK_ADMIN) {
        if (tokens.length != params.length) revert Errors.ErrInvalidConfiguration();
        
        for (uint256 i = 0; i < tokens.length; ) {
            _setRiskParamsInternal(pool, tokens[i], params[i]);
            unchecked { ++i; }
        }
    }
    
    /// @notice Internal function to set risk parameters
    /// @param pool Pool address
    /// @param token Token address
    /// @param params Risk parameters
    function _setRiskParamsInternal(
        address pool,
        address token,
        RiskParams calldata params
    ) internal {
        if (pool == address(0) || token == address(0)) revert Errors.ErrZeroAddress();
        if (params.LTV > MAX_LTV || params.LT > MAX_LT || params.LTV > params.LT) {
            revert Errors.ErrInvalidRiskParams();
        }
        if (params.kink > PRECISION) revert Errors.ErrInvalidRiskParams();
        
        riskParams[pool][token] = params;
        
        emit RiskParamsUpdated(
            pool,
            token,
            params.LTV,
            params.LT,
            params.kink,
            params.rBase,
            params.slope1,
            params.slope2
        );
    }
    
    /// @notice Get risk parameters for a token in a pool
    /// @param pool Pool address
    /// @param token Token address
    /// @return Risk parameters
    function getRiskParams(address pool, address token) external view returns (RiskParams memory) {
        return riskParams[pool][token];
    }
    
    /// @notice Get pool configuration
    /// @param pool Pool address
    /// @return Pool configuration
    function getPoolConfig(address pool) external view returns (PoolConfig memory) {
        return poolConfigs[pool];
    }
    
    /// @notice Check if pool is active and not paused
    /// @param pool Pool address
    /// @return True if pool is operational
    function isPoolOperational(address pool) external view returns (bool) {
        PoolConfig memory config = poolConfigs[pool];
        return config.isActive && !config.isPaused;
    }
}
