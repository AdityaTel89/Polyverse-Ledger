// src/utils/getInvoiceManagerContract.ts
import { ethers } from "ethers";
// ✅ Add the required import attribute
import InvoiceManagerABI from "../abi/InvoiceManager.json" with { type: "json" };

// Contract addresses for each network
const CONTRACT_ADDRESSES: Record<number, string> = {
  17000: "0x19f9f3F9F4F3342Cc321AF2b00974A789176708e", // Holesky testnet
  11155111: "0xF4ae0Bd8bE25d465115e553B69bb808eB7F924Ce", // Sepolia testnet
  974399131:"0xcBC10b31779090869E2C67b3824F55ac6CebD38D",
  // Add other networks as you deploy:
  // 1: "0x...", // Ethereum Mainnet
  // 137: "0x...", // Polygon
  // 42161: "0x...", // Arbitrum One
  // 10: "0x...", // Optimism
  // 1351057110: "0x...", // SKALE Europa
};

// Async version that auto-detects chain ID
export const getInvoiceManagerContractAsync = async (
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
    throw new Error(`❌ InvoiceManager contract not deployed on chain ${chainId}`);
  }
  
  return new ethers.Contract(contractAddress, InvoiceManagerABI.abi, signerOrProvider);
};

// Sync version with explicit chain ID (recommended for better performance)
export const getInvoiceManagerContract = (
  signerOrProvider: ethers.Provider | ethers.Signer,
  chainId?: number
) => {
  // If chainId is provided, use it; otherwise use default (backward compatibility)
  const targetChainId = chainId || 17000; // Default to Holesky for backward compatibility
  const contractAddress = CONTRACT_ADDRESSES[targetChainId];
  
  if (!contractAddress) {
    throw new Error(`❌ InvoiceManager contract not deployed on chain ${targetChainId}`);
  }
  
  return new ethers.Contract(contractAddress, InvoiceManagerABI.abi, signerOrProvider);
};

// Helper function to get contract address for a specific chain
export const getInvoiceManagerAddress = (chainId: number): string => {
  const address = CONTRACT_ADDRESSES[chainId];
  if (!address) {
    throw new Error(`InvoiceManager contract not deployed on chain ${chainId}`);
  }
  return address;
};

// Helper function to check if contract is deployed on a chain
export const isInvoiceManagerDeployed = (chainId: number): boolean => {
  return chainId in CONTRACT_ADDRESSES;
};

// Export supported chain IDs
export const SUPPORTED_INVOICE_MANAGER_CHAINS = Object.keys(CONTRACT_ADDRESSES).map(Number);
