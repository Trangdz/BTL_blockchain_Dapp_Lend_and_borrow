# 🎯 LendHub v2 - Hướng Dẫn Chạy Từng Bước

## 📋 BƯỚC 1: Chuẩn Bị Môi Trường

### **1.1 Cài Đặt MetaMask**
```
✅ Download MetaMask extension cho Chrome
✅ Tạo wallet hoặc import existing wallet
✅ Unlock MetaMask
```

### **1.2 Cài Đặt Dependencies**
```bash
# Đã cài sẵn trong project
npm install
```

## 🚀 BƯỚC 2: Start Ganache Blockchain

### **Option A: Ganache CLI (Recommended)**
```bash
# Đã cài xong, bây giờ start:
ganache-cli --host 0.0.0.0 --port 7545 --networkId 1337 --accounts 10 --deterministic
```

### **Option B: Ganache GUI**
```
1. Download Ganache GUI từ: https://trufflesuite.com/ganache/
2. Install và start
3. Create "New Workspace" hoặc "Quickstart"
4. Verify: Port 7545, Network ID 1337
```

**Expected Output:**
```
Ganache CLI v6.12.2 (ganache-core: 2.13.2)

Available Accounts
==================
(0) 0xd162E0AFdBF08ad5bF5b28dd39d53E63A3625474 (100 ETH)
(1) 0x55043543f49145Ed052c47F23A8185CdAE2eab25 (100 ETH)
...

Private Keys
==================
(0) 0x...
(1) 0x...

Listening on 0.0.0.0:7545
```

## 🏗️ BƯỚC 3: Deploy Smart Contracts

### **3.1 Compile Contracts**
```bash
npm run compile
```

**Expected Output:**
```
Compiled X Solidity files successfully
```

### **3.2 Deploy to Ganache**
```bash
npm run deploy:ganache
```

**Expected Output:**
```
🚀 Starting LendHub v2 deployment to Ganache...
💰 Deploying Mock Tokens...
WETH deployed to: 0x...
🎯 Creating CORE Pool...
CORE Pool created at: 0x...
✅ Deployment completed!
```

## 🦊 BƯỚC 4: Cấu Hình MetaMask

### **4.1 Add Ganache Network**

**Manual Method:**
```
1. Mở MetaMask
2. Click network dropdown
3. Click "Add Network" → "Add a network manually"
4. Fill in:
   - Network Name: Ganache Local
   - New RPC URL: http://127.0.0.1:7545
   - Chain ID: 1337
   - Currency Symbol: ETH
5. Click "Save"
6. Switch to "Ganache Local"
```

**Auto Method:**
```
1. Mở: add-ganache-network.html trong browser
2. Click "Add Ganache Network" button
3. Approve trong MetaMask popup
```

### **4.2 Import Test Accounts**
```
1. Trong Ganache, copy private key của account đầu tiên
2. Trong MetaMask:
   - Click account icon → "Import Account"
   - Paste private key
   - Click "Import"
3. Repeat cho 2-3 accounts khác
```

## 🌐 BƯỚC 5: Start Frontend

```bash
npm run dev
```

**Expected Output:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
event - compiled client and server successfully
```

## 🎮 BƯỚC 6: Test LendHub v2

### **6.1 Mở LendHub**
```
1. Mở browser
2. Vào: http://localhost:3000
3. Verify trang load thành công
```

### **6.2 Connect Wallet**
```
1. Click "Connect Wallet" button
2. Select MetaMask
3. Make sure network hiển thị "🟢 Ganache Local"
4. Approve connection
```

### **6.3 Test Supply (Simple)**
```
1. Mở: http://localhost:3000/test-supply
2. Click "Connect & Test Contract"
3. Click "Test Supply 0.1 WETH"
4. Approve transactions trong MetaMask
```

**Expected Success:**
```
🔄 Testing supply...
💰 Minting WETH... (if needed)
✅ WETH minted successfully
📝 Approving WETH...
📝 Sending lend transaction...
✅ Supply successful! Hash: 0x...
```

## 🔧 BƯỚC 7: Troubleshooting

### **7.1 Nếu MetaMask không connect:**
```bash
# Check debug page
http://localhost:3000/debug
```

### **7.2 Nếu contracts không work:**
```bash
# Verify deployment
npx hardhat run scripts/test-contracts.js --network ganache
```

### **7.3 Nếu frontend có lỗi:**
```bash
# Clear cache và restart
rm -rf .next
npm run dev
```

## ✅ BƯỚC 8: Verify Success

### **Success Indicators:**
- ✅ Ganache running trên port 7545
- ✅ MetaMask connected to "Ganache Local"
- ✅ Frontend load tại localhost:3000
- ✅ Contract test page works
- ✅ Supply transaction successful

### **What You Should See:**
1. **Header**: 🟢 "Ganache Local" badge
2. **Account**: Address hiển thị trong header
3. **Test Page**: Supply transaction works
4. **Console**: No critical errors

## 🎉 HOÀN THÀNH!

Khi tất cả bước trên hoạt động:
- ✅ **LendHub v2 ready** với 148 tests passing
- ✅ **Smart contracts deployed** và working
- ✅ **Frontend connected** to Ganache
- ✅ **Supply functionality** verified

## 🚀 Commands Tóm Tắt:

```bash
# 1. Start Ganache
ganache-cli --host 0.0.0.0 --port 7545 --networkId 1337 --accounts 10 --deterministic

# 2. Deploy contracts (terminal mới)
npm run compile
npm run deploy:ganache

# 3. Start frontend (terminal mới)
npm run dev

# 4. Test
# Mở: http://localhost:3000/test-supply
# Connect wallet và test supply
```

**🎯 Follow từng bước này và LendHub v2 sẽ chạy perfect!**
