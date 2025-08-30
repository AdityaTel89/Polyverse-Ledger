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
  refreshNetwork: () => Promise<void>; // ✅ NEW: Add manual refresh function
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [blockchainId, setBlockchainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // ✅ NEW: Get current network from MetaMask
  const getCurrentNetwork = async (): Promise<string | null> => {
    try {
      if (!window.ethereum) return null;
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      return network.chainId.toString();
    } catch (error) {
      console.error('Failed to get current network:', error);
      return null;
    }
  };

  // ✅ NEW: Manual refresh function
  const refreshNetwork = async () => {
    const currentNetwork = await getCurrentNetwork();
    if (currentNetwork && currentNetwork !== blockchainId) {
      setBlockchainId(currentNetwork);
      localStorage.setItem('blockchainId', currentNetwork);
      console.log('Network refreshed:', currentNetwork);
    }
  };

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
      
      // ✅ IMPROVED: Get network more reliably
      const currentNetwork = await getCurrentNetwork();
      if (!currentNetwork) {
        toast.error('Could not detect network');
        return;
      }

      // Store connection state
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('blockchainId', currentNetwork);
      localStorage.setItem('isWalletConnected', 'true');
      
      // Update React state
      setWalletAddress(address);
      setBlockchainId(currentNetwork);
      
      toast.success(`🦊 Wallet connected! Network: ${currentNetwork}`);
      
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

  const logout = (showToast: boolean = true) => {
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('blockchainId');
    localStorage.removeItem('isWalletConnected');
    
    setWalletAddress(null);
    setBlockchainId(null);
    
    if (showToast) {
      toast.success('👋 Successfully logged out');
    }
  };

  // Initialize wallet connection state on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedAddress = localStorage.getItem('walletAddress');
        const storedChainId = localStorage.getItem('blockchainId');
        const wasConnected = localStorage.getItem('isWalletConnected');

        if (wasConnected === 'true' && storedAddress && window.ethereum) {
          // ✅ IMPROVED: Always verify current network
          const currentNetwork = await getCurrentNetwork();
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0 && accounts.some(acc => acc.address === storedAddress)) {
            setWalletAddress(storedAddress);
            
            // ✅ FIXED: Use current network, not stored one
            if (currentNetwork) {
              setBlockchainId(currentNetwork);
              localStorage.setItem('blockchainId', currentNetwork);
              
              // Show network info if it changed
              if (currentNetwork !== storedChainId) {
                console.log(`Network changed from ${storedChainId} to ${currentNetwork}`);
              }
            }
          } else {
            logout(false);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        logout(false);
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
        // ✅ FIXED: Use accounts[0], not accounts
        setWalletAddress(accounts[0]);
        localStorage.setItem('walletAddress', accounts[0]);
        toast.success(`Account switched to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    };

    const handleChainChanged = async (chainId: string) => {
      const wasConnected = localStorage.getItem('isWalletConnected');
      
      if (wasConnected === 'true') {
        const newChainId = parseInt(chainId, 16).toString();
        console.log('Chain changed to:', newChainId); // ✅ Debug log
        
        setBlockchainId(newChainId);
        localStorage.setItem('blockchainId', newChainId);
        toast.success(`Network switched to ${newChainId}`);
        
        // ✅ NEW: Trigger a page refresh for network-dependent components
        window.dispatchEvent(new Event('networkChanged'));
      }
    };

    const handleDisconnect = () => {
      logout(false);
    };

    // ✅ Add event listeners
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
        refreshNetwork, // ✅ NEW: Expose refresh function
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
