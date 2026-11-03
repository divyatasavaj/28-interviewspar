require("@nomicfoundation/hardhat-toolbox");
const dotenv = require("dotenv");

dotenv.config({ path: "../.env" });

const config = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

module.exports = config;
