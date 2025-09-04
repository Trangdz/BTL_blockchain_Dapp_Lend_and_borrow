require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true, // Enable the Solidity optimizer (default: false)
        runs: 200, // Optimize for 200 runs (default: 200)
      },
    },
  },

  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true,
    },

    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337,
      allowUnlimitedContractSize: true,
    },

    sepolia: {
      url: process.env.INFURA_SEPOLIA_API_URL || "https://sepolia.infura.io/v3/",
      accounts: process.env.MAIN_ACCOUNT ? [process.env.MAIN_ACCOUNT] : [],
      chainId: 11155111,
    },

    mumbai: {
      url: process.env.INFURA_MUMBAI_API_URL || "https://polygon-mumbai.infura.io/v3/",
      accounts: process.env.MAIN_ACCOUNT ? [process.env.MAIN_ACCOUNT] : [],
      chainIds: 80001, // mumbai testnet
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP,
    token: "eth",
    outputFile: "artifacts/gas-report.md",
    noColors: true,
  },
};
