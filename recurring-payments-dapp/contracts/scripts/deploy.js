const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;
  const feeBps = Number(process.env.PLATFORM_FEE_BPS || 50);

  console.log("Deploying from:", deployer.address);
  console.log("Fee collector:", feeCollector);
  console.log("Platform fee (bps):", feeBps);

  const RecurringAllowance = await hre.ethers.getContractFactory(
    "RecurringAllowance"
  );
  const recurringAllowance = await RecurringAllowance.deploy(
    feeCollector,
    feeBps
  );

  await recurringAllowance.waitForDeployment();
  const contractAddress = await recurringAllowance.getAddress();

  console.log("RecurringAllowance deployed to:", contractAddress);
  console.log("Network:", hre.network.name);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
