const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying UserRegistry contract...");
  console.log("🌐 Network:", hre.network.name);
  console.log("⛓️  Chain ID:", hre.network.config.chainId);
  
  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const contract = await UserRegistry.deploy();
  await contract.waitForDeployment();
  
  console.log("✅ UserRegistry deployed at:", contract.target);
  console.log("📋 Update this address in getUserRegistryContract.ts");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
