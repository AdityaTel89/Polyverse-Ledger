//src/utils/getCreditScoreContract.ts
import { ethers } from "ethers";
import CreditScoreABI from "../abi/CreditScore.json";

// Contract addresses for each network
const CONTRACT_ADDRESSES: Record<number, string> = {
  17000: "0x519f4AcEA3a7423962Efc1b024Dd29102361F1f8", // Holesky testnet (original)
  11155111: "0x3aDc463cA65DDe2b739A1900D53c286a0eD06d13", // Sepolia testnet (new)
  974399131:"0x4aeeDAF0eB9932B4b138d7BfA7fF9D72208754D6",
  // Add other networks as you deploy:
  // 1: "0x...", // Ethereum Mainnet
  // 137: "0x...", // Polygon
  // 42161: "0x...", // Arbitrum One
  // 10: "0x...", // Optimism
  // 1351057110: "0x...", // SKALE Europa
};

// Async version that auto-detects chain ID
export const getCreditScoreContractAsync = async (
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
    throw new Error(`❌ CreditScore contract not deployed on chain ${chainId}`);
  }
  
  const abi = CreditScoreABI.abi || CreditScoreABI;
  return new ethers.Contract(contractAddress, abi, signerOrProvider);
};

// Sync version with explicit chain ID (recommended for better performance)
export const getCreditScoreContract = (
  signerOrProvider: any,
  chainId?: number
) => {
  // If chainId is provided, use it; otherwise use default (backward compatibility)
  const targetChainId = chainId || 17000; // Default to Holesky for backward compatibility
  const contractAddress = CONTRACT_ADDRESSES[targetChainId];
  
  if (!contractAddress) {
    throw new Error(`❌ CreditScore contract not deployed on chain ${targetChainId}`);
  }
  
  const abi = CreditScoreABI.abi || CreditScoreABI;
  return new ethers.Contract(contractAddress, abi, signerOrProvider);
};

// Helper function to get contract address for a specific chain
export const getCreditScoreAddress = (chainId: number): string => {
  const address = CONTRACT_ADDRESSES[chainId];
  if (!address) {
    throw new Error(`CreditScore contract not deployed on chain ${chainId}`);
  }
  return address;
};

// Helper function to check if contract is deployed on a chain
export const isCreditScoreDeployed = (chainId: number): boolean => {
  return chainId in CONTRACT_ADDRESSES;
};

// Export supported chain IDs
export const SUPPORTED_CREDIT_SCORE_CHAINS = Object.keys(CONTRACT_ADDRESSES).map(Number);
