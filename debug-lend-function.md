# LendHub v2 Lend Function Analysis

## Key Issues to Check:

### 1. Function Signature
```solidity
function lend(address token, uint256 amount) external payable nonReentrant whenNotPaused
```

### 2. Requirements that might cause revert:
- Token must be supported (added via addToken)
- Contract must not be paused
- Amount must be > 0
- For ETH: token = 0x0, amount = msg.value
- Contract must have correct permissions

### 3. Common Revert Causes:
- ErrZeroAmount() - amount is 0
- ErrZeroAddress() - token is 0x0 but not handling ETH properly
- ErrUnsupportedToken() - token not added to pool
- Contract paused
- Reentrancy guard active

### 4. ETH Handling:
- ETH address should be 0x0000000000000000000000000000000000000000
- Must send ETH via msg.value
- amount parameter should match msg.value

## Fixes to Try:

### Fix 1: Check if ETH token is added
The pool might not have ETH (0x0) added as supported token.

### Fix 2: Check contract state
Contract might be paused or have other state issues.

### Fix 3: Use WETH instead of ETH
Since we deployed WETH token, might need to use WETH instead of ETH.

