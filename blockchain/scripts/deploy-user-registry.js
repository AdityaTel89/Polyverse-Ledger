const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying UserRegistry contract...");

  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const contract = await UserRegistry.deploy();
  await contract.waitForDeployment();

  console.log("✅ UserRegistry deployed at:", contract.target);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
