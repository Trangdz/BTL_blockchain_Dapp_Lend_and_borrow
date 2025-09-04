// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../risk/InterestRateModel.sol";

/// @title TestInterestRateModel
/// @notice Test contract to expose InterestRateModel library functions
contract TestInterestRateModel {
    using InterestRateModel for uint256;
    
    function testUtilization(uint256 cash, uint256 borrows) external pure returns (uint256) {
        return InterestRateModel.utilization(cash, borrows);
    }
    
    function testRBorrow(
        uint256 util,
        uint256 rBase,
        uint256 slope1,
        uint256 slope2,
        uint256 kink
    ) external pure returns (uint256) {
        return InterestRateModel.rBorrow(util, rBase, slope1, slope2, kink);
    }
    
    function testRSupply(
        uint256 rBorrowRate,
        uint256 util,
        uint256 reserveFactor
    ) external pure returns (uint256) {
        return InterestRateModel.rSupply(rBorrowRate, util, reserveFactor);
    }
}
