// Frontend helper for wallet authentication
declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * Sign a message using MetaMask wallet (gasless)
 */
export async function signWalletMessage(walletAddress: string): Promise<{ message: string; signature: string }> {
  if (!window.ethereum) {
    throw new Error('No wallet available. Please install MetaMask.');
  }

  try {
    const provider = window.ethereum;
    const message = `Registering with MythosNet at ${new Date().toISOString()}`;
    
    // Use personal_sign for MetaMask compatibility
    // Parameters: [message, address]
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message, walletAddress]
    });

    return { message, signature };
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the signing request');
    }
    throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Alternative signing method using ethers provider
 */
export async function signWalletMessageEthers(walletAddress: string): Promise<{ message: string; signature: string }> {
  if (!window.ethereum) {
    throw new Error('No wallet available. Please install MetaMask.');
  }

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const message = `Registering with MythosNet at ${new Date().toISOString()}`;
    const signature = await signer.signMessage(message);

    return { message, signature };
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the signing request');
    }
    throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Check if wallet is available
 */
export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/**
 * Request wallet connection
 */
export async function connectWallet(): Promise<string[]> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    return accounts;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the connection request');
    }
    throw new Error(`Connection failed: ${error.message}`);
  }
}

/**
 * Get current wallet accounts
 */
export async function getWalletAccounts(): Promise<string[]> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_accounts' 
    });
    return accounts;
  } catch (error: any) {
    throw new Error(`Failed to get accounts: ${error.message}`);
  }
}

/**
 * Get current network chain ID
 */
export async function getCurrentChainId(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const chainId = await window.ethereum.request({ 
      method: 'eth_chainId' 
    });
    return parseInt(chainId, 16).toString();
  } catch (error: any) {
    throw new Error(`Failed to get chain ID: ${error.message}`);
  }
}
