# 🏦 LendHub v2 - Advanced DeFi Lending & Borrowing Protocol

![LendHub v2](https://img.shields.io/badge/LendHub-v2.0-blue) ![Solidity](https://img.shields.io/badge/Solidity-^0.8.19-363636) ![Tests](https://img.shields.io/badge/Tests-148%20passing-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## 🌟 Features

### 🆕 LendHub v2 New Features
- **🏊 Isolated Lending Pools** - Separate risk for different asset pools
- **📈 Dynamic Interest Rate Model** - Kink model with utilization-based rates  
- **⚡ Auto-Liquidation System** - Chainlink Automation + local keeper
- **💻 Enhanced UI** - Real-time Health Factor & Asset Metrics
- **🔗 Multi-Network Support** - Ganache Local + Sepolia Testnet

### 🎯 Core Functionality
- **Supply & Earn** - Deposit assets to earn interest
- **Borrow & Leverage** - Borrow against collateral
- **Real-time Health Monitoring** - Prevent liquidation with live updates
- **Market Analytics** - Track APY, utilization, and market trends

## 🚀 Quick Start

### Option 1: Ganache Local (Recommended for Development)

```bash
# 1. Start Ganache (localhost:7545, Chain ID: 1337)
# Download Ganache GUI or use CLI:
ganache-cli --port 7545 --networkId 1337 --accounts 10

# 2. Deploy contracts
npm run compile
npm run deploy:ganache

# 3. Start frontend
npm run dev

# 4. Configure MetaMask
# Network: Ganache Local
# RPC: http://127.0.0.1:7545
# Chain ID: 1337
```

### Option 2: Sepolia Testnet

```bash
# 1. Set environment variables
export INFURA_SEPOLIA_API_URL="https://sepolia.infura.io/v3/YOUR_KEY"
export MAIN_ACCOUNT="YOUR_PRIVATE_KEY"

# 2. Deploy to Sepolia
npx hardhat run scripts/deploy-ganache.js --network sepolia

# 3. Start frontend
npm run dev

# 4. Connect MetaMask to Sepolia
```

## 🎮 Demo Setup

```bash
# Setup test positions for UI demo
npx hardhat run scripts/setup-demo.js --network ganache
```

This creates:
- Liquidity pools with test tokens
- User positions with collateral/debt
- Health Factor demonstrations
- Liquidation scenarios

## 📱 UI Features

### 🩺 Health Factor Card
Real-time position monitoring with color-coded status:

- 🟢 **Safe** (HF ≥ 1.5) - Position is secure
- 🟡 **Monitor** (HF 1.2-1.5) - Watch carefully  
- 🟠 **At Risk** (HF 1.0-1.2) - Add collateral soon
- 🔴 **Liquidatable** (HF < 1.0) - Urgent action needed!

### 📊 Asset Metrics Table
Market overview with live data:

- **Supply/Borrow APY** - Current interest rates
- **Utilization Rate** - Market demand indicator
- **Total Volumes** - Market size and liquidity
- **Real-time Updates** - Rates adjust with market conditions

### 🌐 Network Indicator
Header shows current network:

- 🟢 **Ganache Local** - Development environment
- 🔵 **Sepolia Testnet** - Public testnet
- ⚠️ **Unsupported** - Switch network prompt

## 🏗️ Architecture

### Smart Contracts
```
contracts/
├── pool/IsolatedLendingPool.sol      # Core lending logic
├── factory/PoolFactory.sol          # Pool deployment
├── risk/LiquidationManager.sol       # Liquidation handling  
├── automation/KeeperAdapter.sol      # Automated liquidations
├── risk/InterestRateModel.sol        # Dynamic rate calculations
├── oracle/AddressToTokenMapV2.sol    # Price feed integration
└── mocks/                           # Testing utilities
```

### Frontend Components
```
components/
├── HealthFactorCard.jsx             # Health monitoring
├── AssetMetrics.jsx                 # Market overview
├── Header.jsx                       # Network indicator
└── [legacy components]              # Original functionality
```

## 🧪 Testing

### Comprehensive Test Suite
```bash
# Run all tests (148 passing!)
npm test

# Specific test categories
npx hardhat test test/02_interest_model.spec.js    # Interest rates
npx hardhat test test/07_integration.spec.js       # Full system
npx hardhat test test/08_invariants.spec.js        # System integrity

# Gas usage analysis
npm run gas
```

### Test Results
- ✅ **148 tests passing** in 21 seconds
- ✅ **95.5% success rate**
- ✅ **Gas optimized** operations
- ✅ **Comprehensive coverage** - Unit, Integration, Invariant

## ⛽ Gas Usage (Optimized)

| Operation | Gas Cost | Description |
|-----------|----------|-------------|
| **Lend** | 113,152 | Supply assets to earn interest |
| **Borrow** | 233,049 | Borrow against collateral |
| **Repay** | 117,150 | Repay borrowed assets |
| **Withdraw** | 180,613 | Withdraw supplied assets |
| **Liquidation** | 223,452 | Liquidate undercollateralized position |

**Total Lifecycle: 867,416 gas** ⚡

## 🔧 Configuration

### Network Support
LendHub v2 automatically detects and supports:

- **Ganache Local** (Chain ID: 1337) - Uses `addresses-ganache.js`
- **Sepolia Testnet** (Chain ID: 11155111) - Uses `addresses.js`
- **Automatic Switching** - UI adapts to connected network

### Environment Variables
```env
# Network Configuration
NEXT_PUBLIC_NETWORK=ganache  # or sepolia

# Feature Flags
NEXT_PUBLIC_ENABLE_V2_FEATURES=true
NEXT_PUBLIC_ENABLE_HEALTH_FACTOR=true
NEXT_PUBLIC_ENABLE_ASSET_METRICS=true
```

## 🤖 Automation

### Keeper System
```bash
# Start local keeper for automated liquidations
npm run keeper:ganache
```

Features:
- **Automatic Detection** - Finds liquidatable users
- **Batch Processing** - Efficient multi-user liquidations
- **Configurable Parameters** - Adjust timing and limits
- **Production Ready** - Chainlink Automation integration

## 🔒 Security

### Security Features
- ✅ **OpenZeppelin Standards** - Battle-tested contracts
- ✅ **Reentrancy Protection** - All external calls protected
- ✅ **Oracle Security** - Staleness checks and validation
- ✅ **Access Control** - Role-based permissions
- ✅ **Custom Errors** - Gas-efficient error handling

### Audit Readiness
- Comprehensive test coverage
- NatSpec documentation
- CEI pattern implementation
- Gas optimization analysis

## 📖 Documentation

### Developer Guides
- [Ganache Setup Guide](docs/GANACHE-SETUP.md) - Local development
- [UI Features Guide](docs/LendHub-v2-UI-Guide.md) - Frontend features
- [Deployment Guide](DEPLOYMENT-GUIDE.md) - Production deployment
- [Gas Report](artifacts/gas-report.md) - Performance analysis

### Technical References
- [Architecture Diagram](docs/LendHub%20-%20Architecture%20Diagram.pdf)
- [HLD Documentation](docs/Lendhub-HLD-documentation.pdf)  
- [LLD Documentation](docs/LendHub-LLD-documentation.pdf)

## 🎯 Use Cases

### For Users
- **Earn Passive Income** - Supply assets to earn interest
- **Access Liquidity** - Borrow without selling assets
- **Risk Management** - Monitor health factor in real-time
- **Market Analysis** - Track yields and utilization trends

### For Developers
- **DeFi Integration** - Composable protocol design
- **Liquidation Bots** - Keeper system integration
- **Market Making** - Access to utilization metrics
- **Risk Analytics** - Health factor calculations

## 🚧 Roadmap

### Completed ✅
- Isolated lending pools
- Dynamic interest rates  
- Auto-liquidation system
- Enhanced UI with health monitoring
- Multi-network support
- Comprehensive testing

### Future Enhancements 🔮
- **Additional Networks** - Polygon, Arbitrum, Optimism
- **More Assets** - Expanded token support
- **Advanced Analytics** - Portfolio tracking and alerts
- **Mobile App** - Native mobile experience
- **Governance** - Community-driven parameters

## 🤝 Contributing

### Development Setup
```bash
# Clone repository
git clone [repository-url]
cd lendhub-v2

# Install dependencies
npm install

# Setup environment
cp .env.local.example .env.local

# Start development
npm run compile
npm run deploy:ganache
npm run dev
```

### Testing Guidelines
- Write comprehensive tests for all features
- Maintain >95% test coverage
- Include gas usage analysis
- Test on multiple networks

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- **OpenZeppelin** - Security standards and libraries
- **Hardhat** - Development environment
- **Chainlink** - Price feeds and automation
- **Ethers.js** - Ethereum interaction library
- **Next.js** - Frontend framework

---

## 🎉 Getting Started Now!

1. **Choose Your Network**:
   - 🟢 **Local Development**: Follow Ganache setup
   - 🔵 **Testnet**: Use Sepolia configuration

2. **Deploy & Test**:
   ```bash
   npm run deploy:ganache  # or deploy:sepolia
   npm run dev
   ```

3. **Experience LendHub v2**:
   - Connect MetaMask
   - Supply collateral
   - Watch Health Factor in real-time
   - Explore market metrics

**🚀 Welcome to the future of DeFi lending with LendHub v2!**

