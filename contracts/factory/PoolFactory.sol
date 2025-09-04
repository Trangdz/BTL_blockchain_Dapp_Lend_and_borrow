// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../libraries/Errors.sol";

/// @title PoolFactory
/// @notice Factory contract for creating isolated lending pools
contract PoolFactory is AccessControl {
    bytes32 public constant POOL_CREATOR = keccak256("POOL_CREATOR");
    
    // Implementation contract address
    address public immutable poolImplementation;
    
    // Pool creation parameters
    struct PoolParams {
        address addressToTokenMap;
        address lendingConfig;
        address lendingHelper;
        uint256 reserveFactor;
        uint256 liquidationBonus;
    }
    
    // Storage
    mapping(bytes32 => address) public pools;        // name => pool address
    address[] public allPools;                       // Array of all pools
    mapping(address => bool) public isValidPool;     // pool address => validity
    
    // Events
    event PoolCreated(
        bytes32 indexed name,
        address indexed pool,
        address indexed creator,
        PoolParams params
    );
    
    constructor(address _poolImplementation) {
        if (_poolImplementation == address(0)) revert Errors.ErrZeroAddress();
        
        poolImplementation = _poolImplementation;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POOL_CREATOR, msg.sender);
    }
    
    /// @notice Create a new isolated lending pool
    /// @param name Unique name for the pool
    /// @param params Pool creation parameters
    /// @return pool Address of the created pool
    function createPool(
        bytes32 name,
        PoolParams calldata params
    ) external onlyRole(POOL_CREATOR) returns (address pool) {
        if (name == bytes32(0)) revert Errors.ErrInvalidConfiguration();
        if (pools[name] != address(0)) revert Errors.ErrPoolAlreadyExists();
        if (params.addressToTokenMap == address(0) || 
            params.lendingConfig == address(0) || 
            params.lendingHelper == address(0)) {
            revert Errors.ErrZeroAddress();
        }
        
        // Clone the implementation
        pool = Clones.clone(poolImplementation);
        
        // Initialize the pool
        IIsolatedLendingPool(pool).initialize(
            params.addressToTokenMap,
            params.lendingConfig,
            params.lendingHelper,
            params.reserveFactor,
            params.liquidationBonus
        );
        
        // Store pool data
        pools[name] = pool;
        allPools.push(pool);
        isValidPool[pool] = true;
        
        emit PoolCreated(name, pool, msg.sender, params);
    }
    
    /// @notice Get pool address by name
    /// @param name Pool name
    /// @return pool Pool address
    function getPool(bytes32 name) external view returns (address pool) {
        pool = pools[name];
        if (pool == address(0)) revert Errors.ErrPoolNotFound();
    }
    
    /// @notice Get all pools
    /// @return Array of all pool addresses
    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }
    
    /// @notice Get total number of pools
    /// @return Total pool count
    function getPoolCount() external view returns (uint256) {
        return allPools.length;
    }
    
    /// @notice Check if an address is a valid pool
    /// @param pool Address to check
    /// @return True if valid pool
    function isPool(address pool) external view returns (bool) {
        return isValidPool[pool];
    }
}

/// @notice Interface for pool initialization
interface IIsolatedLendingPool {
    function initialize(
        address addressToTokenMap,
        address lendingConfig,
        address lendingHelper,
        uint256 reserveFactor,
        uint256 liquidationBonus
    ) external;
}
