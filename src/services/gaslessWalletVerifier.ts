import { ethers } from "ethers";

/**
 * verifyWalletSignature
 * - message: original string that user signed
 * - signature: signature returned by wallet
 * - walletAddress: expected signer address (0x...)
 */
export async function verifyWalletSignature(message: string, signature: string, walletAddress: string): Promise<boolean> {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === walletAddress.toLowerCase();
  } catch (err) {
    console.error("Signature verification failed:", err);
    return false;
  }
}

/**
 * Alternative verification method using ethers v6 syntax
 */
export async function verifyWalletSignatureV6(message: string, signature: string, walletAddress: string): Promise<boolean> {
  try {
    // For ethers v6
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (err) {
    console.error("Signature verification failed (v6):", err);
    return false;
  }
}

/**
 * Generate a standard message for signing
 */
export function generateSignMessage(timestamp?: string): string {
  const isoTime = timestamp || new Date().toISOString();
  return `Registering with MythosNet at ${isoTime}`;
}

/**
 * Validate signature format
 */
export function isValidSignature(signature: string): boolean {
  // Check if signature is a valid hex string with 0x prefix and correct length
  return /^0x[a-fA-F0-9]{130}$/.test(signature);
}

/**
 * Validate ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
