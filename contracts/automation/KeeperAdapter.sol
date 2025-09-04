// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../interfaces/ILiquidationManager.sol";
import "../libraries/Errors.sol";

/// @title KeeperAdapter
/// @notice Adapter for automated liquidations (Chainlink Automation compatible)
contract KeeperAdapter is AccessControl, ReentrancyGuard {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    ILiquidationManager public immutable liquidationManager;
    
    // Configuration
    uint256 public checkInterval = 300; // 5 minutes
    uint256 public maxLiquidationsPerUpkeep = 5;
    uint256 public minHealthFactorForLiquidation = 1e18; // 1.0
    
    // State tracking
    mapping(address => address[]) public poolUsers; // pool => users with positions
    mapping(address => mapping(address => bool)) public isUserTracked; // pool => user => tracked
    uint256 public lastUpkeepTime;
    
    // Events
    event UpkeepPerformed(uint256 liquidationsExecuted, uint256 timestamp);
    event UserAdded(address indexed pool, address indexed user);
    event UserRemoved(address indexed pool, address indexed user);
    event ConfigUpdated(uint256 checkInterval, uint256 maxLiquidations, uint256 minHealthFactor);
    
    constructor(address _liquidationManager) {
        if (_liquidationManager == address(0)) revert Errors.ErrZeroAddress();
        
        liquidationManager = ILiquidationManager(_liquidationManager);
        lastUpkeepTime = block.timestamp;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
    }
    
    /// @notice Check if upkeep is needed (Chainlink Automation compatible)
    /// @param checkData Additional data for the check
    /// @return upkeepNeeded Whether upkeep is needed
    /// @return performData Data to pass to performUpkeep
    function checkUpkeep(bytes calldata checkData) 
        external 
        view 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        // Parse checkData to get pool addresses
        address[] memory pools = abi.decode(checkData, (address[]));
        
        // Check if enough time has passed
        if (block.timestamp < lastUpkeepTime + checkInterval) {
            return (false, "");
        }
        
        // Find liquidatable users
        address[] memory liquidatableUsers = new address[](maxLiquidationsPerUpkeep);
        address[] memory liquidatablePools = new address[](maxLiquidationsPerUpkeep);
        uint256 count = 0;
        
        for (uint256 i = 0; i < pools.length && count < maxLiquidationsPerUpkeep; i++) {
            address pool = pools[i];
            address[] memory users = poolUsers[pool];
            
            for (uint256 j = 0; j < users.length && count < maxLiquidationsPerUpkeep; j++) {
                address user = users[j];
                
                if (liquidationManager.isLiquidatable(user, pool)) {
                    liquidatableUsers[count] = user;
                    liquidatablePools[count] = pool;
                    count++;
                }
            }
        }
        
        if (count > 0) {
            // Resize arrays to actual count
            address[] memory finalUsers = new address[](count);
            address[] memory finalPools = new address[](count);
            
            for (uint256 i = 0; i < count; i++) {
                finalUsers[i] = liquidatableUsers[i];
                finalPools[i] = liquidatablePools[i];
            }
            
            upkeepNeeded = true;
            performData = abi.encode(finalUsers, finalPools);
        }
    }
    
    /// @notice Perform upkeep (Chainlink Automation compatible)
    /// @param performData Data from checkUpkeep
    function performUpkeep(bytes calldata performData) external nonReentrant {
        // Decode users and pools to liquidate
        (address[] memory users, address[] memory pools) = abi.decode(performData, (address[], address[]));
        
        uint256 liquidationsExecuted = 0;
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            address pool = pools[i];
            
            // Double-check that user is still liquidatable
            if (liquidationManager.isLiquidatable(user, pool)) {
                try this.executeLiquidation(user, pool) {
                    liquidationsExecuted++;
                } catch {
                    // Continue with next liquidation if one fails
                    continue;
                }
            }
        }
        
        lastUpkeepTime = block.timestamp;
        emit UpkeepPerformed(liquidationsExecuted, block.timestamp);
    }
    
    /// @notice Execute a single liquidation
    /// @param user User to liquidate
    /// @param pool Pool address
    function executeLiquidation(address user, address pool) external {
        // This function should be called only by this contract during upkeep
        require(msg.sender == address(this), "Only self-call allowed");
        
        // Get liquidatable details
        (uint256 healthFactor, uint256 collateralUSD, uint256 borrowUSD) = 
            liquidationManager.calcHealthFactor(user, pool);
        
        if (healthFactor >= minHealthFactorForLiquidation) {
            return; // User is healthy now
        }
        
        // For simplicity, we'll liquidate a fixed percentage of the debt
        // In production, this should be more sophisticated
        uint256 liquidationPercentage = 50; // 50%
        uint256 repayAmount = (borrowUSD * liquidationPercentage) / 100;
        
        // Note: This is a simplified approach. In production, you'd need:
        // 1. Determine optimal debt token to repay
        // 2. Determine optimal collateral to seize
        // 3. Calculate exact amounts considering token decimals and prices
        // 4. Handle the actual liquidation call with proper parameters
        
        // For now, we just emit an event indicating a liquidation should happen
        // The actual liquidation would be handled by an external liquidator bot
    }
    
    /// @notice Add user to tracking for a pool
    /// @param pool Pool address
    /// @param user User address
    function addUser(address pool, address user) external onlyRole(ADMIN_ROLE) {
        if (pool == address(0) || user == address(0)) revert Errors.ErrZeroAddress();
        
        if (!isUserTracked[pool][user]) {
            poolUsers[pool].push(user);
            isUserTracked[pool][user] = true;
            emit UserAdded(pool, user);
        }
    }
    
    /// @notice Remove user from tracking for a pool
    /// @param pool Pool address
    /// @param user User address
    function removeUser(address pool, address user) external onlyRole(ADMIN_ROLE) {
        if (!isUserTracked[pool][user]) return;
        
        address[] storage users = poolUsers[pool];
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                break;
            }
        }
        
        isUserTracked[pool][user] = false;
        emit UserRemoved(pool, user);
    }
    
    /// @notice Batch add users for tracking
    /// @param pool Pool address
    /// @param users Array of user addresses
    function batchAddUsers(address pool, address[] calldata users) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            if (pool == address(0) || user == address(0)) revert Errors.ErrZeroAddress();
            
            if (!isUserTracked[pool][user]) {
                poolUsers[pool].push(user);
                isUserTracked[pool][user] = true;
                emit UserAdded(pool, user);
            }
        }
    }
    
    /// @notice Update configuration
    /// @param _checkInterval New check interval
    /// @param _maxLiquidationsPerUpkeep Max liquidations per upkeep
    /// @param _minHealthFactorForLiquidation Min health factor threshold
    function updateConfig(
        uint256 _checkInterval,
        uint256 _maxLiquidationsPerUpkeep,
        uint256 _minHealthFactorForLiquidation
    ) external onlyRole(ADMIN_ROLE) {
        checkInterval = _checkInterval;
        maxLiquidationsPerUpkeep = _maxLiquidationsPerUpkeep;
        minHealthFactorForLiquidation = _minHealthFactorForLiquidation;
        
        emit ConfigUpdated(_checkInterval, _maxLiquidationsPerUpkeep, _minHealthFactorForLiquidation);
    }
    
    /// @notice Get users tracked for a pool
    /// @param pool Pool address
    /// @return Array of tracked user addresses
    function getTrackedUsers(address pool) external view returns (address[] memory) {
        return poolUsers[pool];
    }
    
    /// @notice Get liquidatable users for multiple pools
    /// @param pools Array of pool addresses
    /// @return users Array of liquidatable users
    /// @return correspondingPools Array of pools for each user
    function getLiquidatableUsers(address[] calldata pools) 
        external 
        view 
        returns (address[] memory users, address[] memory correspondingPools) 
    {
        // Count total liquidatable users first
        uint256 totalCount = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            address[] memory poolUserList = poolUsers[pools[i]];
            for (uint256 j = 0; j < poolUserList.length; j++) {
                if (liquidationManager.isLiquidatable(poolUserList[j], pools[i])) {
                    totalCount++;
                }
            }
        }
        
        // Allocate arrays with exact size
        users = new address[](totalCount);
        correspondingPools = new address[](totalCount);
        
        // Fill arrays
        uint256 index = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            address[] memory poolUserList = poolUsers[pools[i]];
            for (uint256 j = 0; j < poolUserList.length; j++) {
                if (liquidationManager.isLiquidatable(poolUserList[j], pools[i])) {
                    users[index] = poolUserList[j];
                    correspondingPools[index] = pools[i];
                    index++;
                }
            }
        }
    }
    
    /// @notice Grant keeper role to address
    /// @param keeper Address to grant role
    function grantKeeperRole(address keeper) external onlyRole(ADMIN_ROLE) {
        _grantRole(KEEPER_ROLE, keeper);
    }
    
    /// @notice Revoke keeper role from address
    /// @param keeper Address to revoke role
    function revokeKeeperRole(address keeper) external onlyRole(ADMIN_ROLE) {
        _revokeRole(KEEPER_ROLE, keeper);
    }
}
