# 🔧 Ganache + MetaMask Setup Guide

## 🎯 Overview
Hướng dẫn setup Ganache local blockchain và kết nối với LendHub v2 frontend.

## 📋 Prerequisites
- MetaMask browser extension
- Ganache GUI hoặc Ganache CLI

## 🚀 Step 1: Start Ganache

### Option A: Ganache GUI (Recommended)
1. Download [Ganache GUI](https://trufflesuite.com/ganache/)
2. Install và start Ganache
3. Create new workspace hoặc sử dụng "Quickstart"
4. Verify settings:
   - **Server**: `localhost:7545`
   - **Network ID**: `1337`
   - **Accounts**: 10 accounts with 100 ETH each

### Option B: Ganache CLI
```bash
# Install globally
npm install -g ganache-cli

# Start Ganache
ganache-cli --host 0.0.0.0 --port 7545 --networkId 1337 --accounts 10 --deterministic
```

## 🦊 Step 2: Configure MetaMask

### Add Ganache Network
1. Open MetaMask
2. Click network dropdown (usually shows "Ethereum Mainnet")
3. Click "Add Network" → "Add a network manually"
4. Fill in details:
   - **Network Name**: `Ganache Local`
   - **New RPC URL**: `http://127.0.0.1:7545`
   - **Chain ID**: `1337`
   - **Currency Symbol**: `ETH`
   - **Block Explorer URL**: (leave empty)
5. Click "Save"

### Import Test Accounts
1. In Ganache, click key icon (🔑) next to any account
2. Copy the private key
3. In MetaMask:
   - Click account circle → "Import Account"
   - Paste private key
   - Click "Import"
4. Repeat for multiple accounts (recommend importing 2-3 accounts)

## 📦 Step 3: Deploy LendHub v2

```bash
# In project directory
npm run compile
npm run deploy:ganache
```

**Expected output:**
```
🎯 CORE Pool: 0x6F38d044ec9598d36dfC7f6bb7E7C028C881484c
🏗️ LendingHelper: 0x8460CD29899eCA6b72D5cee97c78d79d39761B53
✅ Deployment completed!
```

## 🌐 Step 4: Start Frontend

```bash
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:3000`

## ✅ Step 5: Verify Connection

1. Open `http://localhost:3000`
2. Connect MetaMask (make sure you're on Ganache network)
3. You should see:
   - 🟢 **"Ganache Local"** badge in header
   - Your account connected
   - LendHub v2 interface loaded

## 🎭 Step 6: Setup Demo Positions (Optional)

```bash
# Setup test positions
npx hardhat run scripts/setup-demo.js --network ganache
```

This will:
- Mint test tokens to accounts
- Create sample lending/borrowing positions
- Enable Health Factor demonstrations

## 🎯 Testing Features

### Health Factor Card
1. Supply WETH as collateral
2. Borrow DAI or USDC
3. Watch Health Factor update in real-time
4. See color-coded status: 🟢 Safe → 🟡 Monitor → 🟠 At Risk → 🔴 Liquidatable

### Asset Metrics
- View real-time APY rates
- Monitor market utilization
- Track supply/borrow volumes

### Network Switching
- Switch between Ganache and Sepolia
- UI automatically detects network
- Contract addresses update dynamically

## 🔧 Troubleshooting

### Common Issues

**1. "Please switch to either Ganache Local or Sepolia"**
- Verify MetaMask is on Ganache network (Chain ID: 1337)
- Check Ganache is running on port 7545

**2. "Transaction failed"**
- Reset MetaMask account: Settings → Advanced → Reset Account
- Check if you have enough ETH for gas

**3. "Contract not found"**
- Redeploy contracts: `npm run deploy:ganache`
- Verify addresses in `addresses-ganache.js`

**4. Frontend shows old data**
- Hard refresh: Ctrl+F5 (Windows) / Cmd+Shift+R (Mac)
- Clear browser cache

### Advanced Debugging

**Check Ganache Connection:**
```bash
# Test connection
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:7545
```

**Check Contract Deployment:**
```bash
npx hardhat console --network ganache
# In console:
const pool = await ethers.getContractAt("IsolatedLendingPool", "0x6F38d044ec9598d36dfC7f6bb7E7C028C881484c");
console.log(await pool.getSupportedTokens());
```

## 🎉 Success Indicators

✅ **MetaMask connected** to Ganache (Chain ID: 1337)
✅ **Green "Ganache Local" badge** in header
✅ **Contracts deployed** with valid addresses
✅ **Frontend loads** without errors
✅ **Health Factor card** displays (when positions exist)
✅ **Asset metrics** show market data

## 🔄 Network Switching

LendHub v2 now supports seamless switching between:

- **🟢 Ganache Local** (Chain ID: 1337)
  - For development and testing
  - Uses addresses from `addresses-ganache.js`
  - Full LendHub v2 features

- **🔵 Sepolia Testnet** (Chain ID: 11155111)  
  - For testnet deployment
  - Uses addresses from `addresses.js`
  - Public testnet environment

The UI automatically detects your network and loads appropriate contract addresses!

## 📞 Support

If you encounter issues:

1. **Check Console Logs**: Browser Developer Tools → Console
2. **Verify Network**: Ensure MetaMask shows "Ganache Local"
3. **Restart Services**: Stop Ganache → Redeploy → Restart frontend
4. **Reset MetaMask**: Settings → Advanced → Reset Account

---

🎯 **Once setup is complete, you'll have a fully functional LendHub v2 DeFi protocol running locally!**

