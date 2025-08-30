const hre = require("hardhat");

async function main() {
  const creditAddress = '0x519f4AcEA3a7423962Efc1b024Dd29102361F1f8';
  const invoiceManagerAddress = '0x19f9f3F9F4F3342Cc321AF2b00974A789176708e';

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer Address:', deployer.address);

  const CreditScoring = await hre.ethers.getContractFactory('CreditScoring');
  const contract = CreditScoring.attach(creditAddress);

  try {
    console.log('Setting operator to InvoiceManager...');
    const tx = await contract.setOperator(invoiceManagerAddress);
    await tx.wait();
    console.log('✅ Operator set successfully!');

    const operator = await contract.operator();
    console.log('✅ Current operator:', operator);
  } catch (error) {
    console.error('❌ Failed to set operator:', error);
    console.log('This might be due to:');
    console.log('1. Access control (onlyOwner modifier)');
    console.log('2. Contract validation logic');
    console.log('3. Missing setOperator function');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
