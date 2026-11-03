// Deploy the Certificate contract to Sepolia testnet.
// Usage (after `npm install` in blockchain/ and filling .env):
//   npx hardhat run scripts/deploy.js --network sepolia
const { ethers, network } = require("hardhat");

async function main() {
  if (!["sepolia", "hardhat", "localhost"].includes(network.name)) throw new Error("Test networks only");
  const Certificate = await ethers.getContractFactory("Certificate");
  const cert = await Certificate.deploy();
  await cert.waitForDeployment();
  console.log("Certificate deployed to:", await cert.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
