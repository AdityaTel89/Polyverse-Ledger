//src/utils/getUserRegistryContract.ts
import { ethers } from "ethers";
import contractJson from "../abi/UserRegistry.json";

const CONTRACT_ADDRESSES: Record<number, string> = {
  17000: "0x4fF4FE79a2Ef6fC8d35fb942C6c5A3cEaa84b898", // Holesky
  11155111: "0x37Ec737aA52E2997d30a6EF82664Da9F32A8a399", // Sepolia
  974399131:"0x1aC444596c3c4ab9B024EB9972A0E87dCe047B77",
};

// Async version that auto-detects chain ID
export const getUserRegistryContractAsync = async (
  signerOrProvider: ethers.Signer | ethers.Provider
) => {
  // Type guard to check if it's a Provider
  let provider: ethers.Provider;
  
  if ('provider' in signerOrProvider && signerOrProvider.provider) {
    // It's a Signer with a provider
    provider = signerOrProvider.provider;
  } else if ('getNetwork' in signerOrProvider) {
    // It's already a Provider
    provider = signerOrProvider as ethers.Provider;
  } else {
    throw new Error("❌ No provider available to detect network");
  }
  
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  const contractAddress = CONTRACT_ADDRESSES[chainId];
  
  if (!contractAddress) {
    throw new Error(`❌ UserRegistry contract not deployed on chain ${chainId}`);
  }
  
  return new ethers.Contract(contractAddress, contractJson.abi, signerOrProvider);
};

// Sync version with explicit chain ID (recommended for better performance)
export const getUserRegistryContract = (
  signerOrProvider: ethers.Signer | ethers.Provider,
  chainId: number
) => {
  const contractAddress = CONTRACT_ADDRESSES[chainId];
  
  if (!contractAddress) {
    throw new Error(`❌ UserRegistry contract not deployed on chain ${chainId}`);
  }
  
  return new ethers.Contract(contractAddress, contractJson.abi, signerOrProvider);
};
