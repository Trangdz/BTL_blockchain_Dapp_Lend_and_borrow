import { ethIcon, usdcIcon, daiIcon } from "./assets";

// For Ganache LendHub v2
const addresses = require("./addresses-ganache.js");

export const token = [
  {
    image: ethIcon,
    name: "WETH",
    address: addresses.default.WETH,
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
    decimal: "6", // USDC uses 6 decimals
    apy: 3,
    isCollateral: true,
  },
];
