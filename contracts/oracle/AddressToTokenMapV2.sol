// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../AggregatorV3Interface.sol";
import "../libraries/Errors.sol";

/// @title AddressToTokenMapV2
/// @notice Enhanced mapping contract with oracle staleness check
contract AddressToTokenMapV2 is Ownable {
    uint256 public constant PRECISION = 1e18;
    
    // Token address => Symbol mapping
    mapping(address => string) private _symbols;
    
    // Token address => Price feed address mapping
    mapping(address => address) private _priceFeeds;
    
    // Token address => Decimals mapping
    mapping(address => uint8) private _decimals;
    
    // Oracle staleness threshold
    uint256 public oracleStaleThreshold = 3600; // 1 hour
    
    // Events
    event SymbolSet(address indexed token, string symbol);
    event PriceFeedSet(address indexed token, address indexed priceFeed);
    event DecimalsSet(address indexed token, uint8 decimals);
    event OracleStaleThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    
    constructor() {}
    
    /// @notice Set token symbol
    /// @param token Token address
    /// @param symbol Token symbol
    function setSymbol(address token, string memory symbol) external onlyOwner {
        if (token == address(0)) revert Errors.ErrZeroAddress();
        _symbols[token] = symbol;
        emit SymbolSet(token, symbol);
    }
    
    /// @notice Set price feed for token
    /// @param token Token address
    /// @param priceFeed Price feed address
    function setPriceFeed(address token, address priceFeed) external onlyOwner {
        if (token == address(0) || priceFeed == address(0)) revert Errors.ErrZeroAddress();
        _priceFeeds[token] = priceFeed;
        emit PriceFeedSet(token, priceFeed);
    }
    
    /// @notice Set token decimals
    /// @param token Token address
    /// @param decimals_ Token decimals
    function setDecimals(address token, uint8 decimals_) external onlyOwner {
        if (token == address(0)) revert Errors.ErrZeroAddress();
        _decimals[token] = decimals_;
        emit DecimalsSet(token, decimals_);
    }
    
    /// @notice Set oracle stale threshold
    /// @param threshold New threshold in seconds
    function setOracleStaleThreshold(uint256 threshold) external onlyOwner {
        uint256 oldThreshold = oracleStaleThreshold;
        oracleStaleThreshold = threshold;
        emit OracleStaleThresholdUpdated(oldThreshold, threshold);
    }
    
    /// @notice Batch set token data
    /// @param tokens Array of token addresses
    /// @param symbols Array of symbols
    /// @param priceFeeds Array of price feed addresses
    /// @param decimals_ Array of decimals
    function batchSetTokenData(
        address[] calldata tokens,
        string[] calldata symbols,
        address[] calldata priceFeeds,
        uint8[] calldata decimals_
    ) external onlyOwner {
        uint256 length = tokens.length;
        if (length != symbols.length || 
            length != priceFeeds.length || 
            length != decimals_.length) {
            revert Errors.ErrInvalidConfiguration();
        }
        
        for (uint256 i = 0; i < length; ) {
            _symbols[tokens[i]] = symbols[i];
            _priceFeeds[tokens[i]] = priceFeeds[i];
            _decimals[tokens[i]] = decimals_[i];
            
            emit SymbolSet(tokens[i], symbols[i]);
            emit PriceFeedSet(tokens[i], priceFeeds[i]);
            emit DecimalsSet(tokens[i], decimals_[i]);
            
            unchecked { ++i; }
        }
    }
    
    /// @notice Get token symbol
    /// @param token Token address
    /// @return symbol Token symbol
    function getSymbol(address token) external view returns (string memory) {
        return _symbols[token];
    }
    
    /// @notice Get price feed for token
    /// @param token Token address
    /// @return priceFeed Price feed address
    function getPriceFeed(address token) external view returns (address) {
        address priceFeed = _priceFeeds[token];
        if (priceFeed == address(0)) revert Errors.ErrOracleNotFound();
        return priceFeed;
    }
    
    /// @notice Get token decimals
    /// @param token Token address
    /// @return decimals Token decimals
    function getDecimals(address token) external view returns (uint8) {
        return _decimals[token];
    }
    
    /// @notice Check if token is ETH
    /// @param token Token address
    /// @return True if token is ETH
    function isETH(address token) external view returns (bool) {
        return keccak256(abi.encodePacked(_symbols[token])) == keccak256(abi.encodePacked("ETH"));
    }
    
    /// @notice Get latest price from oracle with staleness check
    /// @param token Token address
    /// @return price Token price in USD (scaled to 1e18)
    function getPrice(address token) external view returns (uint256) {
        address priceFeed = _priceFeeds[token];
        if (priceFeed == address(0)) revert Errors.ErrOracleNotFound();
        
        AggregatorV3Interface aggregator = AggregatorV3Interface(priceFeed);
        
        (, int256 price, , uint256 updatedAt, ) = aggregator.latestRoundData();
        
        if (price <= 0) revert Errors.ErrInvalidPrice();
        if (block.timestamp - updatedAt > oracleStaleThreshold) revert Errors.ErrStalePrice();
        
        uint8 feedDecimals = aggregator.decimals();
        
        // Normalize to 1e18 precision
        if (feedDecimals < 18) {
            return uint256(price) * (10 ** (18 - feedDecimals));
        } else if (feedDecimals > 18) {
            return uint256(price) / (10 ** (feedDecimals - 18));
        } else {
            return uint256(price);
        }
    }
    
    /// @notice Get price without staleness check (for emergency use)
    /// @param token Token address
    /// @return price Token price in USD (scaled to 1e18)
    function getPriceUnsafe(address token) external view returns (uint256) {
        address priceFeed = _priceFeeds[token];
        if (priceFeed == address(0)) revert Errors.ErrOracleNotFound();
        
        AggregatorV3Interface aggregator = AggregatorV3Interface(priceFeed);
        (, int256 price, , , ) = aggregator.latestRoundData();
        
        if (price <= 0) revert Errors.ErrInvalidPrice();
        
        uint8 feedDecimals = aggregator.decimals();
        
        // Normalize to 1e18 precision
        if (feedDecimals < 18) {
            return uint256(price) * (10 ** (18 - feedDecimals));
        } else if (feedDecimals > 18) {
            return uint256(price) / (10 ** (feedDecimals - 18));
        } else {
            return uint256(price);
        }
    }
}
