// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "../interfaces/IIsolatedLendingPool.sol";
import "../libraries/Errors.sol";
import "../risk/InterestRateModel.sol";
import "../oracle/AddressToTokenMapV2.sol";
import "../config/LendingConfigV2.sol";
import "../LendingHelper.sol";

/// @title IsolatedLendingPool
/// @notice Isolated lending pool with dynamic interest rates and health factors
contract IsolatedLendingPool is 
    IIsolatedLendingPool, 
    ReentrancyGuard, 
    Pausable, 
    AccessControl,
    Initializable
{
    using SafeERC20 for IERC20;
    using InterestRateModel for uint256;

    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 3600;
    uint256 public constant INDEX_INITIAL = 1e18;

    // Core contracts
    AddressToTokenMapV2 public addressToTokenMap;
    LendingConfigV2 public lendingConfig;
    LendingHelper public lendingHelper;
    
    // Pool parameters
    uint256 public reserveFactor;
    uint256 public liquidationBonus;
    
    // Token state tracking
    mapping(address => TokenState) public tokenStates;
    
    // User positions
    mapping(address => mapping(address => uint256)) public supplied; // user => token => amount
    mapping(address => mapping(address => uint256)) public debts;    // user => token => amount
    
    // User index tracking (for compound interest calculation)
    mapping(address => mapping(address => uint256)) public supplyIndexes; // user => token => last index
    mapping(address => mapping(address => uint256)) public borrowIndexes; // user => token => last index
    
    // Supported tokens list
    address[] public supportedTokens;
    mapping(address => bool) public isTokenSupported;
    
    // Events
    event Lend(address indexed user, address indexed token, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 newBalance);
    event Borrow(address indexed user, address indexed token, uint256 amount, uint256 newDebt);
    event Repay(address indexed user, address indexed token, uint256 amount, uint256 newDebt);
    event Accrue(
        address indexed token,
        uint256 newIndexSupply,
        uint256 newIndexBorrow,
        uint256 totalCash,
        uint256 totalBorrows
    );
    event Liquidate(
        address indexed liquidator,
        address indexed user,
        address indexed debtToken,
        uint256 repaid,
        address collateralToken,
        uint256 seized
    );
    event TokenAdded(address indexed token);
    event ReserveFactorUpdated(uint256 oldFactor, uint256 newFactor);
    event LiquidationBonusUpdated(uint256 oldBonus, uint256 newBonus);
    
    modifier onlyValidToken(address token) {
        if (!isTokenSupported[token]) revert Errors.ErrInvalidToken();
        _;
    }
    
    modifier accrueInterest(address token) {
        _accrue(token);
        _;
    }

    constructor() {
        _disableInitializers();
    }
    
    /// @notice Initialize the pool (called by factory)
    /// @param _addressToTokenMap Address to token mapping contract
    /// @param _lendingConfig Lending configuration contract
    /// @param _lendingHelper Lending helper contract
    /// @param _reserveFactor Reserve factor (1e18 = 100%)
    /// @param _liquidationBonus Liquidation bonus (1e18 = 100%)
    function initialize(
        address _addressToTokenMap,
        address _lendingConfig,
        address _lendingHelper,
        uint256 _reserveFactor,
        uint256 _liquidationBonus
    ) external initializer {
        if (_addressToTokenMap == address(0) || 
            _lendingConfig == address(0) || 
            _lendingHelper == address(0)) {
            revert Errors.ErrZeroAddress();
        }
        
        addressToTokenMap = AddressToTokenMapV2(_addressToTokenMap);
        lendingConfig = LendingConfigV2(_lendingConfig);
        lendingHelper = LendingHelper(_lendingHelper);
        
        reserveFactor = _reserveFactor;
        liquidationBonus = _liquidationBonus;
        
        address admin = tx.origin; // Use tx.origin to get the actual deployer
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(LIQUIDATOR_ROLE, admin);
    }
    
    /// @notice Lend tokens to the pool
    /// @param token Token address
    /// @param amount Amount to lend
    /// @return success True if successful
    function lend(address token, uint256 amount) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        onlyValidToken(token)
        accrueInterest(token)
        returns (bool success) 
    {
        if (amount == 0) revert Errors.ErrZeroAmount();
        
        address user = msg.sender;
        
        // Update user's supply index if first time lending this token
        if (supplied[user][token] == 0) {
            supplyIndexes[user][token] = tokenStates[token].indexSupply;
        } else {
            // Apply compound interest to existing supply
            _applySupplyInterest(user, token);
        }
        
        // Transfer tokens
        _transferIn(token, user, amount);
        
        // Update state
        supplied[user][token] += amount;
        tokenStates[token].cash += uint128(amount);
        
        emit Lend(user, token, amount, supplied[user][token]);
        return true;
    }
    
    /// @notice Withdraw tokens from the pool
    /// @param token Token address
    /// @param amount Amount to withdraw
    /// @return success True if successful
    function withdraw(address token, uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyValidToken(token)
        accrueInterest(token)
        returns (bool success) 
    {
        if (amount == 0) revert Errors.ErrZeroAmount();
        
        address user = msg.sender;
        
        // Apply compound interest
        _applySupplyInterest(user, token);
        
        if (supplied[user][token] < amount) revert Errors.ErrInsufficientBalance();
        if (tokenStates[token].cash < amount) revert Errors.ErrInsufficientLiquidity();
        
        // Check health factor after withdrawal
        uint256 suppliedBefore = supplied[user][token];
        supplied[user][token] -= amount;
        
        if (debts[user][token] > 0 || _getTotalBorrowedUSD(user) > 0) {
            if (_getHealthFactor(user) < PRECISION) {
                supplied[user][token] = suppliedBefore; // Revert state
                revert Errors.ErrHealthFactorTooLow();
            }
        }
        
        // Update state and transfer
        tokenStates[token].cash -= uint128(amount);
        _transferOut(token, user, amount);
        
        emit Withdraw(user, token, amount, supplied[user][token]);
        return true;
    }
    
    /// @notice Borrow tokens from the pool
    /// @param token Token address
    /// @param amount Amount to borrow
    /// @return success True if successful
    function borrow(address token, uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyValidToken(token)
        accrueInterest(token)
        returns (bool success) 
    {
        if (amount == 0) revert Errors.ErrZeroAmount();
        
        address user = msg.sender;
        
        if (tokenStates[token].cash < amount) revert Errors.ErrInsufficientLiquidity();
        
        // Update user's borrow index if first time borrowing this token
        if (debts[user][token] == 0) {
            borrowIndexes[user][token] = tokenStates[token].indexBorrow;
        } else {
            // Apply compound interest to existing debt
            _applyBorrowInterest(user, token);
        }
        
        // Check health factor after borrow
        uint256 debtBefore = debts[user][token];
        debts[user][token] += amount;
        
        if (_getHealthFactor(user) < PRECISION) {
            debts[user][token] = debtBefore; // Revert state
            revert Errors.ErrHealthFactorTooLow();
        }
        
        // Update state and transfer
        tokenStates[token].cash -= uint128(amount);
        tokenStates[token].borrows += uint128(amount);
        _transferOut(token, user, amount);
        
        emit Borrow(user, token, amount, debts[user][token]);
        return true;
    }
    
    /// @notice Repay borrowed tokens
    /// @param token Token address
    /// @param amount Amount to repay
    /// @return success True if successful
    function repay(address token, uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyValidToken(token)
        accrueInterest(token)
        returns (bool success) 
    {
        if (amount == 0) revert Errors.ErrZeroAmount();
        
        address user = msg.sender;
        
        // Apply compound interest
        _applyBorrowInterest(user, token);
        
        uint256 debt = debts[user][token];
        if (debt == 0) revert Errors.ErrInsufficientBalance();
        
        uint256 repayAmount = amount > debt ? debt : amount;
        
        // Transfer tokens and update state
        _transferIn(token, user, repayAmount);
        debts[user][token] -= repayAmount;
        tokenStates[token].cash += uint128(repayAmount);
        
        // Ensure we don't underflow
        if (tokenStates[token].borrows >= repayAmount) {
            tokenStates[token].borrows -= uint128(repayAmount);
        } else {
            tokenStates[token].borrows = 0;
        }
        
        emit Repay(user, token, repayAmount, debts[user][token]);
        return true;
    }
    
    /// @notice Accrue interest for a token
    /// @param token Token address
    function _accrue(address token) internal {
        TokenState storage state = tokenStates[token];
        
        if (state.lastAccrue == block.timestamp) return; // Already accrued this block
        
        uint256 timeElapsed = block.timestamp - state.lastAccrue;
        if (timeElapsed == 0) return;
        
        uint256 cash = state.cash;
        uint256 borrows = state.borrows;
        
        if (borrows == 0) {
            state.lastAccrue = uint64(block.timestamp);
            return;
        }
        
        // Get risk parameters
        LendingConfigV2.RiskParams memory riskParams = lendingConfig.getRiskParams(address(this), token);
        
        // Calculate interest rates
        uint256 util = InterestRateModel.utilization(cash, borrows);
        uint256 borrowRate = InterestRateModel.rBorrow(
            util,
            riskParams.rBase,
            riskParams.slope1,
            riskParams.slope2,
            riskParams.kink
        );
        uint256 supplyRate = InterestRateModel.rSupply(borrowRate, util, reserveFactor);
        
        // Calculate interest per second
        uint256 borrowRatePerSecond = borrowRate / SECONDS_PER_YEAR;
        uint256 supplyRatePerSecond = supplyRate / SECONDS_PER_YEAR;
        
        // Compound the indexes
        uint256 borrowInterestFactor = PRECISION + (borrowRatePerSecond * timeElapsed);
        uint256 supplyInterestFactor = PRECISION + (supplyRatePerSecond * timeElapsed);
        
        uint256 newIndexBorrow = (state.indexBorrow * borrowInterestFactor) / PRECISION;
        uint256 newIndexSupply = (state.indexSupply * supplyInterestFactor) / PRECISION;
        
        // Update state
        state.indexBorrow = uint64(newIndexBorrow);
        state.indexSupply = uint64(newIndexSupply);
        state.lastAccrue = uint64(block.timestamp);
        
        emit Accrue(token, newIndexSupply, newIndexBorrow, cash, borrows);
    }
    
    /// @notice Apply compound interest to user's supply
    /// @param user User address
    /// @param token Token address
    function _applySupplyInterest(address user, address token) internal {
        uint256 currentIndex = tokenStates[token].indexSupply;
        uint256 userIndex = supplyIndexes[user][token];
        
        if (userIndex == 0 || userIndex == currentIndex) {
            supplyIndexes[user][token] = currentIndex;
            return;
        }
        
        uint256 interestFactor = (currentIndex * PRECISION) / userIndex;
        supplied[user][token] = (supplied[user][token] * interestFactor) / PRECISION;
        supplyIndexes[user][token] = currentIndex;
    }
    
    /// @notice Apply compound interest to user's debt
    /// @param user User address
    /// @param token Token address
    function _applyBorrowInterest(address user, address token) internal {
        uint256 currentIndex = tokenStates[token].indexBorrow;
        uint256 userIndex = borrowIndexes[user][token];
        
        if (userIndex == 0 || userIndex == currentIndex) {
            borrowIndexes[user][token] = currentIndex;
            return;
        }
        
        uint256 interestFactor = (currentIndex * PRECISION) / userIndex;
        debts[user][token] = (debts[user][token] * interestFactor) / PRECISION;
        borrowIndexes[user][token] = currentIndex;
    }
    
    /// @notice Transfer tokens in (handles ETH and ERC20)
    /// @param token Token address
    /// @param from From address
    /// @param amount Amount to transfer
    function _transferIn(address token, address from, uint256 amount) internal {
        if (addressToTokenMap.isETH(token)) {
            if (msg.value != amount) revert Errors.ErrTransferFailed();
        } else {
            IERC20(token).safeTransferFrom(from, address(this), amount);
        }
    }
    
    /// @notice Transfer tokens out (handles ETH and ERC20)
    /// @param token Token address
    /// @param to To address
    /// @param amount Amount to transfer
    function _transferOut(address token, address to, uint256 amount) internal {
        if (addressToTokenMap.isETH(token)) {
            (bool success, ) = payable(to).call{value: amount}("");
            if (!success) revert Errors.ErrTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
    
    /// @notice Get health factor for a user
    /// @param user User address
    /// @return Health factor (1e18 = 100%)
    function _getHealthFactor(address user) internal view returns (uint256) {
        uint256 totalCollateralUSD = _getTotalCollateralUSD(user);
        uint256 totalBorrowUSD = _getTotalBorrowedUSD(user);
        
        if (totalBorrowUSD == 0) return type(uint256).max;
        if (totalCollateralUSD == 0) return 0;
        
        return (totalCollateralUSD * PRECISION) / totalBorrowUSD;
    }
    
    /// @notice Get total collateral value in USD
    /// @param user User address
    /// @return Total collateral in USD
    function _getTotalCollateralUSD(address user) internal view returns (uint256) {
        uint256 total = 0;
        
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 balance = supplied[user][token];
            
            if (balance > 0) {
                LendingConfigV2.RiskParams memory params = lendingConfig.getRiskParams(address(this), token);
                uint256 price = addressToTokenMap.getPrice(token);
                uint256 valueUSD = (balance * price) / PRECISION;
                total += (valueUSD * params.LT) / PRECISION; // Apply liquidation threshold
            }
        }
        
        return total;
    }
    
    /// @notice Get total borrowed value in USD
    /// @param user User address
    /// @return Total borrowed in USD
    function _getTotalBorrowedUSD(address user) internal view returns (uint256) {
        uint256 total = 0;
        
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 debt = debts[user][token];
            
            if (debt > 0) {
                uint256 price = addressToTokenMap.getPrice(token);
                total += (debt * price) / PRECISION;
            }
        }
        
        return total;
    }
    
    // View functions for frontend
    
    /// @notice Get pool balance for a token
    /// @param token Token address
    /// @return balance Pool balance
    function poolBalance(address token) external view returns (uint256) {
        if (addressToTokenMap.isETH(token)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }
    
    /// @notice Get assets available to borrow for a user
    /// @param user User address
    /// @return assets Array of borrowable assets
    function getAssetsToBorrow(address user) external view returns (BorrowAsset[] memory) {
        BorrowAsset[] memory assets = new BorrowAsset[](supportedTokens.length);
        uint256 count = 0;
        
        uint256 borrowPowerUSD = _getBorrowPowerUSD(user);
        
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 cash = tokenStates[token].cash;
            
            if (cash > 0) {
                uint256 price = addressToTokenMap.getPrice(token);
                uint256 maxBorrowAmount = (borrowPowerUSD * PRECISION) / price;
                
                if (maxBorrowAmount > cash) {
                    maxBorrowAmount = cash;
                }
                
                if (maxBorrowAmount > 0) {
                    // Calculate current borrow APY
                    LendingConfigV2.RiskParams memory params = lendingConfig.getRiskParams(address(this), token);
                    uint256 util = InterestRateModel.utilization(cash, tokenStates[token].borrows);
                    uint256 borrowRate = InterestRateModel.rBorrow(
                        util,
                        params.rBase,
                        params.slope1,
                        params.slope2,
                        params.kink
                    );
                    
                    assets[count] = BorrowAsset({
                        token: token,
                        borrowQty: maxBorrowAmount,
                        borrowApy: borrowRate
                    });
                    count++;
                }
            }
        }
        
        // Resize array
        BorrowAsset[] memory result = new BorrowAsset[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = assets[i];
        }
        
        return result;
    }
    
    /// @notice Get user's total available balance in USD (borrow power)
    /// @param user User address
    /// @return balance Available balance in USD
    function getUserTotalAvailableBalanceInUSD(address user) external view returns (uint256) {
        return _getBorrowPowerUSD(user);
    }
    
    /// @notice Internal function to get borrow power in USD
    /// @param user User address
    /// @return Borrow power in USD
    function _getBorrowPowerUSD(address user) internal view returns (uint256) {
        uint256 totalSuppliedUSD = 0;
        uint256 totalBorrowedUSD = _getTotalBorrowedUSD(user);
        
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 balance = supplied[user][token];
            
            if (balance > 0) {
                LendingConfigV2.RiskParams memory params = lendingConfig.getRiskParams(address(this), token);
                uint256 price = addressToTokenMap.getPrice(token);
                uint256 valueUSD = (balance * price) / PRECISION;
                totalSuppliedUSD += (valueUSD * params.LTV) / PRECISION; // Apply LTV
            }
        }
        
        return totalSuppliedUSD > totalBorrowedUSD ? totalSuppliedUSD - totalBorrowedUSD : 0;
    }
    
    // Admin functions
    
    /// @notice Add supported token
    /// @param token Token address
    function addToken(address token) external onlyRole(ADMIN_ROLE) {
        if (token == address(0)) revert Errors.ErrZeroAddress();
        if (isTokenSupported[token]) return;
        
        isTokenSupported[token] = true;
        supportedTokens.push(token);
        
        // Initialize token state
        tokenStates[token] = TokenState({
            cash: 0,
            borrows: 0,
            lastAccrue: uint64(block.timestamp),
            indexSupply: uint64(INDEX_INITIAL),
            indexBorrow: uint64(INDEX_INITIAL)
        });
        
        emit TokenAdded(token);
    }
    
    /// @notice Set reserve factor
    /// @param newReserveFactor New reserve factor
    function setReserveFactor(uint256 newReserveFactor) external onlyRole(ADMIN_ROLE) {
        if (newReserveFactor > lendingConfig.MAX_RESERVE_FACTOR()) revert Errors.ErrInvalidConfiguration();
        
        uint256 oldFactor = reserveFactor;
        reserveFactor = newReserveFactor;
        emit ReserveFactorUpdated(oldFactor, newReserveFactor);
    }
    
    /// @notice Set liquidation bonus
    /// @param newLiquidationBonus New liquidation bonus
    function setLiquidationBonus(uint256 newLiquidationBonus) external onlyRole(ADMIN_ROLE) {
        uint256 oldBonus = liquidationBonus;
        liquidationBonus = newLiquidationBonus;
        emit LiquidationBonusUpdated(oldBonus, newLiquidationBonus);
    }
    
    /// @notice Set liquidation manager
    /// @param liquidationManager Address of liquidation manager
    function setLiquidationManager(address liquidationManager) external onlyRole(ADMIN_ROLE) {
        if (liquidationManager == address(0)) revert Errors.ErrZeroAddress();
        _grantRole(LIQUIDATOR_ROLE, liquidationManager);
    }
    
    /// @notice Pause the pool
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /// @notice Unpause the pool
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /// @notice Get supported tokens
    /// @return Array of supported token addresses
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /// @notice Get user's health factor
    /// @param user User address
    /// @return Health factor (1e18 = 100%)
    function getHealthFactor(address user) external view returns (uint256) {
        return _getHealthFactor(user);
    }
    
    /// @notice Liquidate a user's position (only by liquidator)
    /// @param user User to liquidate
    /// @param debtToken Token to repay
    /// @param repayAmount Amount to repay
    /// @param collateralToken Collateral token to seize
    /// @param seizeAmount Amount to seize
    /// @param liquidator Address receiving seized collateral
    function liquidateUser(
        address user,
        address debtToken,
        uint256 repayAmount,
        address collateralToken,
        uint256 seizeAmount,
        address liquidator
    ) external onlyRole(LIQUIDATOR_ROLE) nonReentrant {
        if (user == address(0) || liquidator == address(0)) revert Errors.ErrZeroAddress();
        
        // Check if user is actually liquidatable
        if (_getHealthFactor(user) >= PRECISION) revert Errors.ErrUserHealthy();
        
        // Reduce debt
        if (debts[user][debtToken] < repayAmount) revert Errors.ErrInsufficientBalance();
        debts[user][debtToken] -= repayAmount;
        
        // Reduce collateral
        if (supplied[user][collateralToken] < seizeAmount) revert Errors.ErrInsufficientCollateral();
        supplied[user][collateralToken] -= seizeAmount;
        
        // Update token states
        tokenStates[debtToken].cash += uint128(repayAmount);
        if (tokenStates[debtToken].borrows >= repayAmount) {
            tokenStates[debtToken].borrows -= uint128(repayAmount);
        } else {
            tokenStates[debtToken].borrows = 0;
        }
        
        tokenStates[collateralToken].cash -= uint128(seizeAmount);
        
        // Transfer seized collateral to liquidator
        _transferOut(collateralToken, liquidator, seizeAmount);
        
        emit Liquidate(liquidator, user, debtToken, repayAmount, collateralToken, seizeAmount);
    }
    
    receive() external payable {}
}
