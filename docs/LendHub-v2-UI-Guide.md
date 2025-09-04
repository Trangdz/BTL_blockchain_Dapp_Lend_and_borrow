# LendHub v2 UI Features Guide

## Overview
LendHub v2 introduces several new UI components to provide better visibility into user positions and market health.

## New UI Components

### 1. Health Factor Card
**Location**: Top of dashboard (when user has positions)

**Features**:
- **Health Factor Display**: Shows current health factor with color-coded status
  - Green (≥1.5): Safe
  - Yellow (1.2-1.5): Monitor
  - Orange (1.0-1.2): At Risk  
  - Red (<1.0): Liquidatable
- **Available Borrow Power**: Shows remaining borrowing capacity in USD
- **Borrow Utilization**: Percentage of available borrow power used
- **Warning Alerts**: Automatic alerts when health factor is at risk

**Health Factor Formula**:
```
Health Factor = (Collateral Value × Liquidation Threshold) ÷ Borrowed Value
```

### 2. Asset Metrics Table
**Location**: Below health factor card

**Features**:
- **Supply APY**: Current annual percentage yield for suppliers
- **Borrow APY**: Current annual percentage yield for borrowers  
- **Utilization Rate**: Percentage of available liquidity being borrowed
- **Total Supply**: Total amount supplied to the pool
- **Total Borrow**: Total amount borrowed from the pool
- **Market Summary**: Average APYs and utilization across all assets

**APY Calculation**:
- Uses kink interest rate model
- Rates adjust automatically based on utilization
- Higher utilization = higher rates

## Integration Guide

### For Developers

#### 1. Setup Environment
```bash
# Copy environment template
cp .env.local.example .env.local

# Configure for Ganache
NEXT_PUBLIC_NETWORK=ganache
NEXT_PUBLIC_ENABLE_V2_FEATURES=true
```

#### 2. Deploy Contracts
```bash
# Start Ganache on localhost:7545
# Then deploy contracts
npm run deploy:ganache
```

#### 3. Component Usage
```jsx
import { HealthFactorCard, AssetMetrics } from "../components";

// In your component
<HealthFactorCard 
  healthFactor="1.25"
  borrowPower="5000"
  utilizationRate="60"
/>

<AssetMetrics assetData={marketData} />
```

#### 4. Data Structure
```javascript
// Health Factor Data
const healthData = {
  healthFactor: "1.25",      // Health factor as string
  borrowPower: "5000.00",    // Available borrow power in USD
  utilizationRate: "60.5"    // Utilization percentage
};

// Asset Metrics Data
const assetData = [
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    supplyRate: "0.025",      // 2.5% APY
    borrowRate: "0.045",      // 4.5% APY
    cash: "1000000",          // Available liquidity
    borrows: "500000",        // Total borrowed
    totalSupply: "1500000",   // Total supplied
    totalSupplyUSD: "4500000",
    totalBorrow: "500000",
    totalBorrowUSD: "1500000"
  }
];
```

### For Users

#### Understanding Health Factor
- **Above 1.5**: Your position is safe
- **1.2-1.5**: Monitor your position, consider adding collateral
- **1.0-1.2**: At risk of liquidation, take action soon
- **Below 1.0**: Position may be liquidated

#### Reading Market Data
- **Green Utilization** (≤60%): Healthy market with good liquidity
- **Yellow Utilization** (60-80%): Moderate demand, rising rates
- **Red Utilization** (>80%): High demand, higher rates

#### Best Practices
1. **Maintain Health Factor**: Keep above 1.2 for safety buffer
2. **Monitor Utilization**: High utilization = higher borrow costs
3. **Track APYs**: Rates change based on market conditions
4. **Set Alerts**: Watch for liquidation warnings

## Technical Implementation

### State Management
The UI components integrate with the existing lendContext to access:
- User position data
- Market metrics
- Real-time updates

### Responsive Design
- Mobile-first approach
- Tailwind CSS for styling
- Dark/light mode support
- Accessible design patterns

### Real-time Updates
- Data refreshes when metamask account changes
- Automatic recalculation of health factors
- Live APY updates based on utilization

### Error Handling
- Graceful degradation when data unavailable
- Clear error messages
- Fallback values for missing data

## Troubleshooting

### Common Issues

1. **Health Factor shows ∞**
   - User has no borrowed amount
   - This is normal for supply-only positions

2. **APY shows 0%**
   - No borrowing activity in the market
   - Base rate applies (typically 2%)

3. **Utilization shows 0%**
   - No borrows against this asset
   - All supplied liquidity is available

### Development Issues

1. **Components not showing**
   - Check NEXT_PUBLIC_ENABLE_V2_FEATURES=true
   - Verify contract deployment
   - Check console for errors

2. **Data not updating**
   - Verify metamask connection
   - Check network configuration
   - Ensure contracts are deployed correctly

## Deployment Checklist

- [ ] Deploy LendHub v2 contracts
- [ ] Update addresses-ganache.js
- [ ] Configure environment variables
- [ ] Test all UI components
- [ ] Verify health factor calculations
- [ ] Test on mobile devices
- [ ] Check accessibility compliance

## Future Enhancements

### Planned Features
- Real-time notifications
- Price alerts
- Advanced charting
- Portfolio analytics
- Risk management tools

### Integration Ideas
- Email/SMS alerts for liquidation risk
- Mobile app companion
- Discord/Telegram bots
- DeFi portfolio trackers

---

*This guide covers LendHub v2 UI features as of the latest deployment*

