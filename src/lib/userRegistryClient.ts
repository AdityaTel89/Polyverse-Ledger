// src/lib/userRegistryClient.ts
// Optional server-side relayer for on-chain registration on SKALE
import { ethers } from "ethers";

// You'll need to add the UserRegistry ABI JSON file
// import contractJson from "../abi/UserRegistry.json";

const SKALE_RPC_URL = process.env.SKALE_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const USER_REGISTRY_ADDRESS = process.env.USER_REGISTRY_ADDRESS!;

// Simple ABI for UserRegistry contract
const USER_REGISTRY_ABI = [
  "function registerUser(string memory metadataURI) external",
  "function isRegistered(address user) external view returns (bool)",
  "function getUserMetadata(address user) external view returns (string memory)"
];

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let userRegistryContract: ethers.Contract | null = null;

// Initialize the connection
function initializeConnection() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(SKALE_RPC_URL);
  }
  
  if (!signer) {
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
  }
  
  if (!userRegistryContract) {
    userRegistryContract = new ethers.Contract(
      USER_REGISTRY_ADDRESS,
      USER_REGISTRY_ABI,
      signer
    );
  }
}

/**
 * Register a user on-chain via SKALE (server pays gas)
 */
export async function registerUserOnChain(metadataURI: string): Promise<string> {
  try {
    initializeConnection();
    
    if (!userRegistryContract) {
      throw new Error('Contract not initialized');
    }

    console.log('🚀 Registering user on SKALE blockchain:', metadataURI);
    
    const tx = await userRegistryContract.registerUser(metadataURI);
    const receipt = await tx.wait();
    
    console.log('✅ On-chain registration successful:', receipt.transactionHash);
    
    return receipt.transactionHash;
  } catch (error) {
    console.error('❌ On-chain registration failed:', error);
    throw error;
  }
}

/**
 * Check if a user is registered on-chain
 */
export async function isUserRegisteredOnChain(walletAddress: string): Promise<boolean> {
  try {
    initializeConnection();
    
    if (!userRegistryContract) {
      throw new Error('Contract not initialized');
    }

    const isRegistered = await userRegistryContract.isRegistered(walletAddress);
    return isRegistered;
  } catch (error) {
    console.error('Error checking on-chain registration:', error);
    return false;
  }
}

/**
 * Get user metadata from on-chain
 */
export async function getUserMetadataOnChain(walletAddress: string): Promise<string> {
  try {
    initializeConnection();
    
    if (!userRegistryContract) {
      throw new Error('Contract not initialized');
    }

    const metadata = await userRegistryContract.getUserMetadata(walletAddress);
    return metadata;
  } catch (error) {
    console.error('Error fetching on-chain metadata:', error);
    return '';
  }
}

// Export the contract instance for advanced usage
export { userRegistryContract };

// Usage in your registration endpoint:
// After successful database registration, optionally call:
// const txHash = await registerUserOnChain(metadataURI);
