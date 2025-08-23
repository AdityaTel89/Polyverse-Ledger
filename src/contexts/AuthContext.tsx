import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

interface AuthContextType {
  isLoggedIn: boolean;
  walletAddress: string | null;
  blockchainId: string | null;
  isConnecting: boolean;
  login: () => Promise<void>;
  logout: (showToast?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [blockchainId, setBlockchainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const login = async () => {
    try {
      setIsConnecting(true);
      
      if (!window.ethereum) {
        toast.error('MetaMask not detected. Please install MetaMask.');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();

      // Store connection state
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('blockchainId', chainId);
      localStorage.setItem('isWalletConnected', 'true');
      
      // Update React state
      setWalletAddress(address);
      setBlockchainId(chainId);
      
      toast.success('🦊 Wallet connected successfully!');
      
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error.code === 4001) {
        toast.error('Connection cancelled by user');
      } else if (error.code === -32002) {
        toast.error('Please check MetaMask - connection request pending');
      } else {
        toast.error('Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // ✅ FIXED: Remove page reload from logout
  const logout = (showToast: boolean = true) => {
    // Clear all localStorage
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('blockchainId');
    localStorage.removeItem('isWalletConnected');
    
    // Clear React state
    setWalletAddress(null);
    setBlockchainId(null);
    
    if (showToast) {
      toast.success('👋 Successfully logged out');
    }
    
    // ✅ REMOVED: window.location.reload() - No more page reload!
  };

  // Initialize wallet connection state on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedAddress = localStorage.getItem('walletAddress');
        const storedChainId = localStorage.getItem('blockchainId');
        const wasConnected = localStorage.getItem('isWalletConnected');

        if (wasConnected === 'true' && storedAddress && storedChainId && window.ethereum) {
          // Try to verify the connection is still valid
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0 && accounts.some(acc => acc.address === storedAddress)) {
            // Connection is still valid
            setWalletAddress(storedAddress);
            setBlockchainId(storedChainId);
          } else {
            // Connection lost, clear everything
            logout(false); // Don't show toast during initialization
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        logout(false); // Don't show toast during initialization
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  // Listen for MetaMask account/network changes
  useEffect(() => {
    if (!window.ethereum || !isInitialized) return;

    const handleAccountsChanged = (accounts: string[]) => {
      const wasConnected = localStorage.getItem('isWalletConnected');
      
      if (accounts.length === 0 || wasConnected !== 'true') {
        logout(false);
      } else if (accounts[0] !== walletAddress && wasConnected === 'true') {
        // Account switched
        setWalletAddress(accounts);
        localStorage.setItem('walletAddress', accounts);
        toast.success('Account switched');
      }
    };

    const handleChainChanged = (chainId: string) => {
      const wasConnected = localStorage.getItem('isWalletConnected');
      
      if (wasConnected === 'true') {
        const newChainId = parseInt(chainId, 16).toString();
        setBlockchainId(newChainId);
        localStorage.setItem('blockchainId', newChainId);
        toast.success('Network switched');
      }
    };

    const handleDisconnect = () => {
      logout(false);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [walletAddress, isInitialized]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!walletAddress && localStorage.getItem('isWalletConnected') === 'true',
        walletAddress,
        blockchainId,
        isConnecting,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
