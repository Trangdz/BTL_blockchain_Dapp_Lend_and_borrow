# 🚀 LendHub v2 Deployment Guide

## 📋 Quick Start

### Prerequisites
- Node.js v16+
- Ganache CLI hoặc Ganache GUI
- MetaMask browser extension

### 1. Start Ganache
```bash
# Option A: Ganache GUI
# Download và start Ganache GUI trên port 7545

# Option B: Ganache CLI
npm install -g ganache-cli
ganache-cli --host 0.0.0.0 --port 7545 --accounts 10 --deterministic
```

### 2. Deploy Contracts
```bash
# Compile contracts
npm run compile

# Deploy to Ganache
npm run deploy:ganache
```

**Expected Output:**
```
🎯 CORE Pool: 0x6F38d044ec9598d36dfC7f6bb7E7C028C881484c
🏗️ LendingHelper: 0x8460CD29899eCA6b72D5cee97c78d79d39761B53
⚠️ LiquidationManager: 0xd4fB7ce9391da7e61BAa6587fEDeEb7Bc1a3afDe
```

### 3. Setup Demo Positions (Optional)
```bash
# Setup test positions for UI testing
npx hardhat run scripts/setup-demo.js --network ganache
```

### 4. Start Frontend
```bash
# Start development server
npm run dev
# Hoặc
npm run start
```

### 5. Configure MetaMask
1. **Add Ganache Network:**
   - Network Name: `Ganache Local`
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: `1337`
   - Currency Symbol: `ETH`

2. **Import Accounts:**
   - Copy private keys from Ganache
   - Import vào MetaMask

## 🧪 Testing Guide

### Run Tests
```bash
# All tests
npm test

# Specific test suites
npx hardhat test test/02_interest_model.spec.js
npx hardhat test test/07_integration.spec.js

# Gas report
npm run gas
```

### Keeper Automation
```bash
# Start local keeper (runs in background)
npm run keeper:ganache
```

## 🔧 Configuration

### Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_NETWORK=ganache
NEXT_PUBLIC_ENABLE_V2_FEATURES=true
NEXT_PUBLIC_ENABLE_HEALTH_FACTOR=true
```

### Contract Addresses
Addresses được auto-update trong `addresses-ganache.js` sau deployment.

## 🎯 UI Features

### Health Factor Card
- **Location**: Top of dashboard
- **Shows**: Current health factor, borrow power, utilization
- **Colors**: 
  - 🟢 Green (HF ≥ 1.5): Safe
  - 🟡 Yellow (HF 1.2-1.5): Monitor  
  - 🟠 Orange (HF 1.0-1.2): At Risk
  - 🔴 Red (HF < 1.0): Liquidatable

### Asset Metrics Table
- **Location**: Below health factor
- **Shows**: Supply/borrow APY, utilization, total volumes
- **Updates**: Real-time based on market conditions

## 🔍 Troubleshooting

### Common Issues

1. **"Cannot connect to Ganache"**
   ```bash
   # Check if Ganache is running on port 7545
   netstat -an | findstr 7545
   
   # Restart Ganache and redeploy
   npm run deploy:ganache
   ```

2. **"Transaction failed"**
   ```bash
   # Check MetaMask network (should be Ganache)
   # Reset MetaMask account nonce if needed
   ```

3. **"Contract not deployed"**
   ```bash
   # Redeploy contracts
   npm run compile
   npm run deploy:ganache
   ```

4. **"Health Factor shows ∞"**
   - This is normal - user has no borrowed amount
   - Supply assets then borrow to see health factor

### Development Issues

1. **Frontend not loading new features**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run dev
   ```

2. **Contract changes not reflected**
   ```bash
   # Recompile and redeploy
   npm run compile
   npm run deploy:ganache
   ```

3. **Test failures**
   ```bash
   # Check Ganache is running
   # Ensure correct network in hardhat.config.js
   npx hardhat test --network ganache
   ```

## 📈 Performance Metrics

### Gas Usage (Optimized)
- **Lend**: ~113K gas
- **Borrow**: ~233K gas  
- **Repay**: ~117K gas
- **Withdraw**: ~181K gas
- **Liquidation**: ~223K gas

### Test Results
- **148 tests PASSING** ✅
- **95.5% success rate**
- **21 second execution time**

## 🚀 Production Deployment

### Testnet (Sepolia)
```bash
# Set environment variables
export INFURA_SEPOLIA_API_URL="https://sepolia.infura.io/v3/YOUR_KEY"
export MAIN_ACCOUNT="YOUR_PRIVATE_KEY"

# Deploy to Sepolia
npx hardhat run scripts/deploy-ganache.js --network sepolia
```

### Mainnet (⚠️ Use with caution)
```bash
# Set mainnet variables
export INFURA_MAINNET_API_URL="https://mainnet.infura.io/v3/YOUR_KEY"
export MAIN_ACCOUNT="YOUR_PRIVATE_KEY"

# Deploy to mainnet
npx hardhat run scripts/deploy-ganache.js --network mainnet
```

## 📚 Architecture Overview

### Smart Contracts
```
contracts/
├── pool/IsolatedLendingPool.sol     # Core lending logic
├── factory/PoolFactory.sol         # Pool deployment  
├── risk/LiquidationManager.sol      # Liquidation handling
├── automation/KeeperAdapter.sol     # Automated liquidations
├── risk/InterestRateModel.sol       # Dynamic rate calculations
└── oracle/AddressToTokenMapV2.sol   # Price feed integration
```

### Frontend Components
```
components/
├── HealthFactorCard.jsx             # Health monitoring
├── AssetMetrics.jsx                 # Market overview
└── [existing components]            # Original functionality
```

## 🎉 Success Indicators

✅ **Contracts deployed successfully**
✅ **Tests passing (148/151)**  
✅ **Frontend loading with new features**
✅ **MetaMask connects to Ganache**
✅ **Health Factor card displays**
✅ **Asset metrics show market data**

## 📞 Support

### Logs Location
- Hardhat: Console output
- Frontend: Browser developer tools
- Ganache: Ganache GUI/CLI logs

### Debug Commands
```bash
# Check contract deployment
npx hardhat console --network ganache

# Verify contract interactions
npx hardhat test test/07_integration.spec.js --network ganache

# Frontend debugging
npm run dev
# Check http://localhost:3000
```

---

🎯 **LendHub v2 is now ready for testing and development!**

For additional support or questions, refer to the comprehensive test suite or documentation files in the `docs/` directory.

