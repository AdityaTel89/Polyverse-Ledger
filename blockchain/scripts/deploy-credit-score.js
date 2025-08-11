const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying CreditScore contract...");

  const CreditScore = await hre.ethers.getContractFactory("CreditScore");
  const creditScore = await CreditScore.deploy();
  await creditScore.waitForDeployment();

  const address = await creditScore.getAddress();
  console.log("✅ CreditScore deployed at:", address);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});





