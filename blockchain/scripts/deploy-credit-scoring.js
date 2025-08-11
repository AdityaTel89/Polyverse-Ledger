const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying CreditScoring contract...");
  const CreditScoring = await hre.ethers.getContractFactory("CreditScoring");
  const contract = await CreditScoring.deploy();
  await contract.waitForDeployment();

  console.log("✅ CreditScoring deployed at:", contract.target);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
