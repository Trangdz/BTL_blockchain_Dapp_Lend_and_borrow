import { ethIcon, usdcIcon, daiIcon } from "./assets";

// For Ganache LendHub v2 - Restored ETH support like original
const addresses = require("./addresses-ganache.js");

export const token = [
  {
    image: ethIcon,
    name: "ETH", // Restored original ETH
    address: addresses.ETHAddress, // 0x0000000000000000000000000000000000000000
    decimal: "18",
    apy: 3,
    isCollateral: true,
  },
  {
    image: daiIcon,
    name: "DAI",
    address: addresses.default.DAI,
    decimal: "18",
    apy: 3,
    isCollateral: true,
  },
  {
    image: usdcIcon,
    name: "USDC",
    address: addresses.default.USDC,
    decimal: "6",
    apy: 3,
    isCollateral: true,
  },
  // Keep WETH as additional option
  {
    image: ethIcon,
    name: "WETH",
    address: addresses.default.WETH,
    decimal: "18", 
    apy: 3,
    isCollateral: true,
  },
];

