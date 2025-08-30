const hre = require("hardhat");

async function main() {
  console.log("📦 Deploying InvoiceManager contract...");
  console.log("🌐 Network:", hre.network.name);
  console.log("⛓️  Chain ID:", hre.network.config.chainId);

  // Contract addresses mapping (same as in your utils)
  const CREDIT_SCORING_ADDRESSES = {
    17000: "0x519f4AcEA3a7423962Efc1b024Dd29102361F1f8", // Holesky
    11155111: "0x3aDc463cA65DDe2b739A1900D53c286a0eD06d13", // Sepolia
    974399131: "0x4aeeDAF0eB9932B4b138d7BfA7fF9D72208754D6", // SKALE Calypso Test
  };

  const chainId = hre.network.config.chainId;
  const creditScoringAddress = CREDIT_SCORING_ADDRESSES[chainId];

  if (!creditScoringAddress) {
    throw new Error(`❌ CreditScoring not deployed on chain ${chainId}. Deploy it first!`);
  }

  console.log("🔗 Using CreditScoring at:", creditScoringAddress);

  const InvoiceManager = await hre.ethers.getContractFactory("InvoiceManager");
  const contract = await InvoiceManager.deploy(creditScoringAddress);
  await contract.waitForDeployment();

  console.log("✅ InvoiceManager deployed at:", contract.target);
  console.log("📋 Update this address in getInvoiceManagerContract.ts");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
