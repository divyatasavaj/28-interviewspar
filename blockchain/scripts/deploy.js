// Deploy the Certificate contract to Sepolia testnet.
// Usage (after `npm install` in blockchain/ and filling .env):
//   npx hardhat run scripts/deploy.js --network sepolia
import { ethers } from "hardhat";

async function main() {
  const Certificate = await ethers.getContractFactory("Certificate");
  const cert = await Certificate.deploy();
  await cert.waitForDeployment();
  console.log("Certificate deployed to:", await cert.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
