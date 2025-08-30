const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying CreditScoring contract...");
  console.log("🌐 Network:", hre.network.name);
  console.log("⛓️  Chain ID:", hre.network.config.chainId);
  
  const CreditScoring = await hre.ethers.getContractFactory("CreditScoring");
  const contract = await CreditScoring.deploy();
  await contract.waitForDeployment();
  
  console.log("✅ CreditScoring deployed at:", contract.target);
  console.log("📋 Update this address in getCreditScoreContract.ts");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
