// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../AggregatorV3Interface.sol";

/// @title MockV3Aggregator
/// @notice Mock Chainlink price feed for testing
contract MockV3Aggregator is AggregatorV3Interface {
    uint256 public constant VERSION = 4;
    
    uint8 public override decimals;
    string public override description;
    
    int256 private _latestAnswer;
    uint256 private _latestTimestamp;
    uint256 private _latestRound;
    
    mapping(uint256 => int256) private _answers;
    mapping(uint256 => uint256) private _timestamps;
    
    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        description = "Mock Price Feed";
        _updateAnswer(_initialAnswer);
    }
    
    function version() external pure override returns (uint256) {
        return VERSION;
    }
    
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            uint80(_latestRound),
            _latestAnswer,
            _latestTimestamp,
            _latestTimestamp,
            uint80(_latestRound)
        );
    }
    
    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            _answers[_roundId],
            _timestamps[_roundId],
            _timestamps[_roundId],
            _roundId
        );
    }
    
    function updateAnswer(int256 _answer) external {
        _updateAnswer(_answer);
    }
    
    function updateRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _timestamp,
        uint256 _startedAt
    ) external {
        _latestRound = _roundId;
        _latestAnswer = _answer;
        _latestTimestamp = _timestamp;
        _answers[_roundId] = _answer;
        _timestamps[_roundId] = _timestamp;
    }
    
    function _updateAnswer(int256 _answer) private {
        _latestAnswer = _answer;
        _latestTimestamp = block.timestamp;
        _latestRound++;
        _answers[_latestRound] = _answer;
        _timestamps[_latestRound] = _latestTimestamp;
    }
}
