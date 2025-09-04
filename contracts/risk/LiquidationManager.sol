// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/ILiquidationManager.sol";
import "../libraries/Errors.sol";
import "../pool/IsolatedLendingPool.sol";
import "../config/LendingConfigV2.sol";
import "../oracle/AddressToTokenMapV2.sol";

/// @title LiquidationManager
/// @notice Manages liquidations for isolated lending pools
contract LiquidationManager is ILiquidationManager, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;
    
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant LIQUIDATION_THRESHOLD_FACTOR = 1e18; // Health factor threshold for liquidation (1.0)
    
    AddressToTokenMapV2 public immutable addressToTokenMap;
    LendingConfigV2 public immutable lendingConfig;
    
    // Events
    event LiquidationExecuted(
        address indexed liquidator,
        address indexed user,
        address indexed pool,
        address debtToken,
        uint256 repaidAmount,
        address collateralToken,
        uint256 seizedAmount
    );
    
    event LiquidationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    
    constructor(
        address _addressToTokenMap,
        address _lendingConfig
    ) {
        if (_addressToTokenMap == address(0) || _lendingConfig == address(0)) {
            revert Errors.ErrZeroAddress();
        }
        
        addressToTokenMap = AddressToTokenMapV2(_addressToTokenMap);
        lendingConfig = LendingConfigV2(_lendingConfig);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(LIQUIDATOR_ROLE, msg.sender);
    }
    
    /// @notice Calculate health factor for a user in a specific pool
    /// @param user User address
    /// @param pool Pool address
    /// @return hf Health factor in 1e18 precision
    /// @return collateralUSD Total collateral value in USD
    /// @return borrowUSD Total borrow value in USD
    function calcHealthFactor(address user, address pool) 
        external 
        view 
        override
        returns (uint256 hf, uint256 collateralUSD, uint256 borrowUSD) 
    {
        return _calcHealthFactor(user, pool);
    }
    
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
    ) external override nonReentrant {
        if (user == address(0) || pool == address(0) || 
            debtToken == address(0) || collateralToken == address(0)) {
            revert Errors.ErrZeroAddress();
        }
        if (repayAmount == 0) revert Errors.ErrZeroAmount();
        
        address liquidator = msg.sender;
        IsolatedLendingPool poolContract = IsolatedLendingPool(payable(pool));
        
        // Check if user is liquidatable
        (uint256 healthFactor, uint256 collateralUSD, uint256 borrowUSD) = _calcHealthFactor(user, pool);
        
        if (healthFactor >= LIQUIDATION_THRESHOLD_FACTOR) {
            revert Errors.ErrUserHealthy();
        }
        
        // Get user's current debt and supplied amounts
        uint256 userDebt = poolContract.debts(user, debtToken);
        uint256 userCollateral = poolContract.supplied(user, collateralToken);
        
        if (userDebt == 0) revert Errors.ErrInsufficientBalance();
        if (userCollateral == 0) revert Errors.ErrInsufficientCollateral();
        
        // Calculate actual repay amount (can't repay more than debt)
        uint256 actualRepayAmount = repayAmount > userDebt ? userDebt : repayAmount;
        
        // Calculate seizure amount with liquidation bonus
        uint256 seizeAmount = _calculateSeizeAmount(
            pool,
            debtToken,
            actualRepayAmount,
            collateralToken
        );
        
        if (seizeAmount > userCollateral) {
            seizeAmount = userCollateral;
        }
        
        // Transfer repay amount from liquidator to pool
        IERC20(debtToken).safeTransferFrom(liquidator, pool, actualRepayAmount);
        
        // Execute liquidation through pool
        _executeLiquidation(
            poolContract,
            user,
            debtToken,
            actualRepayAmount,
            collateralToken,
            seizeAmount,
            liquidator
        );
        
        emit LiquidationExecuted(
            liquidator,
            user,
            pool,
            debtToken,
            actualRepayAmount,
            collateralToken,
            seizeAmount
        );
    }
    
    /// @notice Calculate seize amount for liquidation
    /// @param pool Pool address
    /// @param debtToken Debt token address
    /// @param repayAmount Repay amount
    /// @param collateralToken Collateral token address
    /// @return seizeAmount Amount of collateral to seize
    function calculateSeizeAmount(
        address pool,
        address debtToken,
        uint256 repayAmount,
        address collateralToken
    ) external view returns (uint256) {
        return _calculateSeizeAmount(pool, debtToken, repayAmount, collateralToken);
    }
    
    /// @notice Check if a user is liquidatable
    /// @param user User address
    /// @param pool Pool address
    /// @return liquidatable True if user can be liquidated
    function isLiquidatable(address user, address pool) external view returns (bool) {
        (uint256 healthFactor, , ) = _calcHealthFactor(user, pool);
        return healthFactor < LIQUIDATION_THRESHOLD_FACTOR;
    }
    
    /// @notice Internal function to calculate health factor
    /// @param user User address
    /// @param pool Pool address
    /// @return hf Health factor
    /// @return collateralUSD Total collateral in USD
    /// @return borrowUSD Total borrows in USD
    function _calcHealthFactor(address user, address pool) 
        internal 
        view 
        returns (uint256 hf, uint256 collateralUSD, uint256 borrowUSD) 
    {
        IsolatedLendingPool poolContract = IsolatedLendingPool(payable(pool));
        address[] memory supportedTokens = poolContract.getSupportedTokens();
        
        // Calculate total collateral value (with liquidation threshold applied)
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 supplied = poolContract.supplied(user, token);
            
            if (supplied > 0) {
                LendingConfigV2.RiskParams memory params = lendingConfig.getRiskParams(pool, token);
                uint256 price = addressToTokenMap.getPrice(token);
                uint256 valueUSD = (supplied * price) / PRECISION;
                collateralUSD += (valueUSD * params.LT) / PRECISION; // Apply liquidation threshold
            }
        }
        
        // Calculate total borrow value
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 debt = poolContract.debts(user, token);
            
            if (debt > 0) {
                uint256 price = addressToTokenMap.getPrice(token);
                borrowUSD += (debt * price) / PRECISION;
            }
        }
        
        // Calculate health factor
        if (borrowUSD == 0) {
            hf = type(uint256).max; // No debt = healthy
        } else if (collateralUSD == 0) {
            hf = 0; // No collateral but has debt = very unhealthy
        } else {
            hf = (collateralUSD * PRECISION) / borrowUSD;
        }
    }
    
    /// @notice Internal function to calculate seize amount
    /// @param pool Pool address
    /// @param debtToken Debt token address
    /// @param repayAmount Repay amount
    /// @param collateralToken Collateral token address
    /// @return seizeAmount Amount to seize
    function _calculateSeizeAmount(
        address pool,
        address debtToken,
        uint256 repayAmount,
        address collateralToken
    ) internal view returns (uint256 seizeAmount) {
        // Get prices for both tokens
        uint256 debtPrice = addressToTokenMap.getPrice(debtToken);
        uint256 collateralPrice = addressToTokenMap.getPrice(collateralToken);
        
        // Get liquidation bonus from pool config
        IsolatedLendingPool poolContract = IsolatedLendingPool(payable(pool));
        uint256 liquidationBonus = poolContract.liquidationBonus();
        
        // Calculate seize amount: repayAmount * debtPrice * (1 + bonus) / collateralPrice
        uint256 repayValueUSD = (repayAmount * debtPrice) / PRECISION;
        uint256 bonusMultiplier = PRECISION + liquidationBonus;
        uint256 seizeValueUSD = (repayValueUSD * bonusMultiplier) / PRECISION;
        
        seizeAmount = (seizeValueUSD * PRECISION) / collateralPrice;
    }
    
    /// @notice Internal function to execute liquidation
    /// @param poolContract Pool contract instance
    /// @param user User being liquidated
    /// @param debtToken Debt token
    /// @param repayAmount Repay amount
    /// @param collateralToken Collateral token
    /// @param seizeAmount Seize amount
    /// @param liquidator Liquidator address
    function _executeLiquidation(
        IsolatedLendingPool poolContract,
        address user,
        address debtToken,
        uint256 repayAmount,
        address collateralToken,
        uint256 seizeAmount,
        address liquidator
    ) internal {
        // Call the pool's liquidation function
        poolContract.liquidateUser(
            user,
            debtToken,
            repayAmount,
            collateralToken,
            seizeAmount,
            liquidator
        );
    }
    
    /// @notice Grant liquidator role to an address
    /// @param liquidator Address to grant role to
    function grantLiquidatorRole(address liquidator) external onlyRole(ADMIN_ROLE) {
        _grantRole(LIQUIDATOR_ROLE, liquidator);
    }
    
    /// @notice Revoke liquidator role from an address
    /// @param liquidator Address to revoke role from
    function revokeLiquidatorRole(address liquidator) external onlyRole(ADMIN_ROLE) {
        _revokeRole(LIQUIDATOR_ROLE, liquidator);
    }
    
    /// @notice Get list of users that may need liquidation in a pool
    /// @param pool Pool address
    /// @param users Array of users to check
    /// @return liquidatableUsers Array of users that can be liquidated
    function getLiquidatableUsers(address pool, address[] calldata users) 
        external 
        view 
        returns (address[] memory liquidatableUsers) 
    {
        uint256 count = 0;
        address[] memory tempArray = new address[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            (uint256 healthFactor, , ) = _calcHealthFactor(users[i], pool);
            if (healthFactor < LIQUIDATION_THRESHOLD_FACTOR) {
                tempArray[count] = users[i];
                count++;
            }
        }
        
        // Resize array to actual count
        liquidatableUsers = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            liquidatableUsers[i] = tempArray[i];
        }
    }
}
