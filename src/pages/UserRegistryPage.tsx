import React, { useEffect, useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { getUserRegistryContract } from '../utils/getUserRegistryContract';
import toast from 'react-hot-toast';
import { BASE_API_URL } from '../utils/constants';
import { Wallet, Plus, Trash2, AlertCircle, Info, Lock, User, Mail, ChevronDown, Crown } from 'lucide-react';
import { PLAN_CONFIG, getPlanConfig, PlanConfig, PlanName } from '../utils/planConfig';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Network configurations with proper typing
interface NetworkConfig {
  name: string;
  chainId: string;
  rpc: string;
  default?: boolean;
}

const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  '1': { name: 'Ethereum', chainId: '1', rpc: 'https://mainnet.infura.io/v3/' },
  '137': { name: 'Polygon', chainId: '137', rpc: 'https://polygon-rpc.com/' },
  '42161': { name: 'Arbitrum', chainId: '42161', rpc: 'https://arb1.arbitrum.io/rpc' },
  '10': { name: 'Optimism', chainId: '10', rpc: 'https://mainnet.optimism.io' },
  '17000': { name: 'Holesky', chainId: '17000', rpc: 'https://ethereum-holesky.publicnode.com' },
  '11155111': { name: 'Sepolia', chainId: '11155111', rpc: 'https://sepolia.infura.io/v3/' },
  '8453': { name: 'Base', chainId: '8453', rpc: 'https://mainnet.base.org' },
  '56': { name: 'BSC', chainId: '56', rpc: 'https://bsc-dataseed.binance.org/' },
  '974399131': { name: 'SKALE Calypso Testnet', chainId: '974399131', rpc: 'https://testnet.skalenodes.com/v1/giant-half-dual-testnet' }
};

interface RegisteredUser {
  id: string;
  walletAddress: string;
  metadataURI: string;
  registeredAt: string;
  blockchainId: string;
  planName?: string;
  planSource?: string;
  queryLimit?: number;
  userLimit?: number;
  trialStartDate?: string;
  trialUsed?: boolean;
  subscriptionEndDate?: string;
  name?: string;
  email?: string;
  queryUsage?: number;
  trialDaysUsed?: number;
}

interface WalletInfo {
  id: string;
  walletAddress: string;
  blockchainId: string;
  blockchainName: string;
  creditScore: number;
  hasUBID: boolean;
  isUnique: boolean;
  isPrimary: boolean;
  createdAt: string;
}

interface WalletLimits {
  planName: string;
  allowedWallets: number;
  usedWallets: number;
  queryLimit: number;
  txnLimit: number | null;
  trialActive: boolean;
  walletDetails: WalletInfo[];
}

const TRIAL_DAYS = 5;

const UserRegistryPage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, walletAddress, blockchainId, login } = useAuth();
  
  const [state, setState] = useState({
    metadataUri: '',
    newMetadataUri: '',
    selectedNetwork: Object.keys(SUPPORTED_NETWORKS).find(key => SUPPORTED_NETWORKS[key]?.default) || '1351057110',
    loading: false,
    isChecking: true,
    planCheckLoading: false,
    walletScoresLoading: false,
    showAddWallet: false,
    addingWallet: false,
    newWalletAddress: '',
    newWalletChain: '',
    newWalletMetadata: '',
    userName: '',
    userEmail: '',
    isGeneratingMetadata: false,
    networkDropdownOpen: false,
    newWalletNetworkDropdownOpen: false
  });

  const [registeredUser, setRegisteredUser] = useState<RegisteredUser | null>(null);
  const [walletLimits, setWalletLimits] = useState<WalletLimits | null>(null);
  const [userWallets, setUserWallets] = useState<WalletInfo[]>([]);
  const [timeoutIds, setTimeoutIds] = useState<NodeJS.Timeout[]>([]);

  // Utility functions
  const notify = (msg: string, type: 'success' | 'error' | 'warning') => {
    type === 'success' ? toast.success(msg) : 
    type === 'warning' ? toast.error(msg, { icon: '⚠️' }) : 
    toast.error(msg);
  };

  const updateState = (updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateWalletAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

  const validateBlockchainId = (id: string) => /^\d+$/.test(id);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [timeoutIds]);

  const planCapabilities = useMemo(() => {
    if (!registeredUser?.planName) return getPlanConfig('Free');
    return getPlanConfig(registeredUser.planName);
  }, [registeredUser?.planName]);

  // FIXED: Check for plan upgrade requirements with proper trial days and query limit logic
  const getUpgradeMessage = useMemo(() => {
    if (!registeredUser) return null;

    const queryUsage = registeredUser.queryUsage || 0;
    const queryLimit = registeredUser.queryLimit || planCapabilities.queryLimit;
    const trialDaysUsed = registeredUser.trialDaysUsed || 0;
    const isFreeOrTrialPlan = registeredUser.planName === 'Free' || registeredUser.planName === 'Trial';
    
    console.log('Debug upgrade check:', {
      queryUsage,
      queryLimit,
      trialDaysUsed,
      TRIAL_DAYS,
      planName: registeredUser.planName,
      isFreeOrTrialPlan
    });

    // PRIORITY 1: Check query limit first (exact limit reached)
    if (queryUsage >= queryLimit) {
      return {
        type: 'query-limit',
        message: `You have reached your query limit of ${queryLimit.toLocaleString()}. Please upgrade your plan to continue.`,
        severity: 'error' as const
      };
    }

    // PRIORITY 2: Check trial days expired (exact match or exceeded)
    if (trialDaysUsed >= TRIAL_DAYS && isFreeOrTrialPlan) {
      return {
        type: 'trial-expired',
        message: `Your ${TRIAL_DAYS}-day trial has ended. Upgrade to continue using premium features.`,
        severity: 'error' as const
      };
    }

    // No upgrade message needed if limits aren't reached
    return null;
  }, [registeredUser, planCapabilities]);

  // Network change handler
  useEffect(() => {
    const handleNetworkChange = async () => {
      if (window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const numericChainId = parseInt(chainId, 16).toString();
          
          if (numericChainId !== blockchainId) {
            setRegisteredUser(null);
            updateState({ isChecking: true });
            
            const timeoutId = setTimeout(() => {
              if (isLoggedIn && walletAddress) {
                checkUserRegistration();
              }
            }, 500);
            
            setTimeoutIds(prev => [...prev, timeoutId]);
          }
        } catch (error) {
          console.error('Network change detection error:', error);
        }
      }
    };

    if (window.ethereum) {
      window.ethereum.on('chainChanged', handleNetworkChange);
      return () => window.ethereum.removeListener('chainChanged', handleNetworkChange);
    }
  }, [isLoggedIn, walletAddress, blockchainId]);

  const generateMetadataUri = async (walletAddress: string, name: string, email: string) => {
    try {
      updateState({ isGeneratingMetadata: true });
      
      const metadata = {
        wallet: walletAddress,
        name: name,
        email: email,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      const metadataString = JSON.stringify(metadata);
      const encoder = new TextEncoder();
      const data = encoder.encode(metadataString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return `metadata://${hashHex.substring(0, 32)}`;
      
    } catch (error) {
      console.error('Error generating metadata:', error);
      return `user_${walletAddress.slice(-8)}_${Date.now()}`;
    } finally {
      updateState({ isGeneratingMetadata: false });
    }
  };

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${BASE_API_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || error.details || `Request failed: ${response.status}`);
    }
    
    return response.json();
  };

  // Validate current network
  const validateCurrentNetwork = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const currentChainId = network.chainId.toString();
    
    if (!SUPPORTED_NETWORKS[currentChainId]) {
      throw new Error(`Unsupported network. Please switch to a supported network.`);
    }
    
    return { provider, network, currentChainId };
  };

  // Registration function
  const handleRegister = async () => {
    try {
      updateState({ loading: true });

      // Validation
      if (!state.userName.trim()) {
        return notify('Please enter your name', 'error');
      }
      if (!state.userEmail.trim()) {
        return notify('Please enter your email', 'error');
      }
      if (!validateEmail(state.userEmail.trim())) {
        return notify('Please enter a valid email address', 'error');
      }
      if (!walletAddress || !blockchainId) {
        return notify('Wallet not connected', 'error');
      }

      // Network validation
      const { provider, network, currentChainId } = await validateCurrentNetwork();
      
      console.log('Registration Debug Info:');
      console.log('Selected Network:', state.selectedNetwork);
      console.log('Current Network:', currentChainId);
      console.log('Network Name:', SUPPORTED_NETWORKS[currentChainId]?.name);

      const signer = await provider.getSigner();
      
      try {
        // Pass both signer and chainId to getUserRegistryContract
        const contract = getUserRegistryContract(signer, parseInt(currentChainId, 10));
        
        const generatedMetadataUri = await generateMetadataUri(
          walletAddress, 
          state.userName.trim(), 
          state.userEmail.trim()
        );

        const isRegistered = await contract.isRegistered(walletAddress);
        if (isRegistered) {
          try {
            const dbUser = await apiCall(`/user/wallet/${walletAddress}/${currentChainId}`);
            setRegisteredUser({
              ...dbUser.data,
              registeredAt: new Date(dbUser.data.createdAt || Date.now()).toLocaleString(),
              planName: dbUser.data.Plan?.name || 'Free'
            });
            notify('✅ Already registered! Redirecting to dashboard...', 'success');
            
            const timeoutId = setTimeout(() => navigate('/dashboard'), 1500);
            setTimeoutIds(prev => [...prev, timeoutId]);
            return;
          } catch {
            // Sync with database if blockchain registration exists but DB doesn't
            await apiCall('/user/register', {
              method: 'POST',
              body: JSON.stringify({
                walletAddress: walletAddress,
                metadataURI: generatedMetadataUri,
                blockchainId: currentChainId,
                chainName: SUPPORTED_NETWORKS[currentChainId].name,
                name: state.userName.trim(),
                email: state.userEmail.trim()
              })
            });
            notify('✅ Registration synced! Redirecting to dashboard...', 'success');
            
            const timeoutId = setTimeout(() => navigate('/dashboard'), 1500);
            setTimeoutIds(prev => [...prev, timeoutId]);
            return;
          }
        }

        notify('⏳ Submitting to blockchain...', 'success');
        const tx = await contract.registerUser(generatedMetadataUri);
        
        if (!tx) {
          throw new Error('Transaction failed');
        }
        
        await tx.wait();
        
        const dbResult = await apiCall('/user/register', {
          method: 'POST',
          body: JSON.stringify({
            walletAddress: walletAddress,
            metadataURI: generatedMetadataUri,
            blockchainId: currentChainId,
            chainName: SUPPORTED_NETWORKS[currentChainId].name,
            name: state.userName.trim(),
            email: state.userEmail.trim()
          })
        });

        setRegisteredUser({
          ...dbResult.data,
          registeredAt: new Date().toLocaleString(),
          planName: dbResult.data.Plan?.name || 'Free',
          name: state.userName.trim(),
          email: state.userEmail.trim()
        });

        updateState({ 
          userName: '', 
          userEmail: '',
          selectedNetwork: Object.keys(SUPPORTED_NETWORKS).find(key => SUPPORTED_NETWORKS[key]?.default) || '1351057110'
        });
        
        notify('🎉 Registration completed! Redirecting to dashboard...', 'success');
        
        const timeoutId = setTimeout(() => navigate('/dashboard'), 2000);
        setTimeoutIds(prev => [...prev, timeoutId]);

      } catch (contractError: any) {
        if (contractError.message.includes('Contract not deployed')) {
          notify(`UserRegistry contract not available on ${SUPPORTED_NETWORKS[currentChainId]?.name}. Please try another network.`, 'error');
        } else {
          throw contractError;
        }
      }

    } catch (err: any) {
      console.error('Registration Error:', err);
      notify(`Registration failed: ${err.message}`, 'error');
    } finally {
      updateState({ loading: false });
    }
  };

  // Update metadata function
  const handleUpdate = async () => {
    if (!state.newMetadataUri.trim()) {
      return notify('Please provide metadata URI', 'error');
    }

    try {
      updateState({ loading: true });
      
      const { provider, currentChainId } = await validateCurrentNetwork();
      const signer = await provider.getSigner();
      const contract = getUserRegistryContract(signer, parseInt(currentChainId, 10));

      const tx = await contract.updateMetadata(state.newMetadataUri.trim());
      if (!tx) {
        throw new Error('Transaction failed');
      }
      
      await tx.wait();

      await apiCall(`/user/kyc/${walletAddress}/${blockchainId}`, {
        method: 'PATCH',
        body: JSON.stringify({ identityHash: state.newMetadataUri.trim() })
      });

      setRegisteredUser(prev => prev ? { ...prev, metadataURI: state.newMetadataUri.trim() } : null);
      updateState({ newMetadataUri: '' });
      notify('✅ Successfully updated!', 'success');

    } catch (err: any) {
      notify(`Update failed: ${err.message}`, 'error');
    } finally {
      updateState({ loading: false });
    }
  };

  // Fetch wallet limits
  const fetchWalletLimits = async (userId: string) => {
    try {
      updateState({ walletScoresLoading: true });
      const data = await apiCall(`/user/wallet-limits/${userId}`);
      if (data.success) {
        setWalletLimits(data.data);
        setUserWallets(data.data.walletDetails || []);
      }
    } catch (err: any) {
      notify('Failed to load wallet information', 'error');
    } finally {
      updateState({ walletScoresLoading: false });
    }
  };

  // Add additional wallet
  const addAdditionalWallet = async () => {
    if (!validateWalletAddress(state.newWalletAddress) || 
        !validateBlockchainId(state.newWalletChain) || 
        !state.newWalletMetadata.trim()) {
      return notify('Please fill all wallet fields correctly', 'error');
    }

    const selectedNetwork = SUPPORTED_NETWORKS[state.newWalletChain];
    if (!selectedNetwork) {
      return notify('Please select a valid network', 'error');
    }

    try {
      updateState({ addingWallet: true });
      
      await apiCall('/user/add-wallet', {
        method: 'POST',
        body: JSON.stringify({
          userId: registeredUser?.id,
          walletAddress: state.newWalletAddress,
          blockchainId: state.newWalletChain,
          metadataURI: state.newWalletMetadata.trim(),
          chainName: selectedNetwork.name,
        })
      });

      notify('✅ Wallet added successfully', 'success');
      
      if (registeredUser?.id) await fetchWalletLimits(registeredUser.id);
      updateState({ 
        newWalletAddress: '', 
        newWalletChain: '', 
        newWalletMetadata: '', 
        showAddWallet: false 
      });

    } catch (err: any) {
      notify(`Failed to add wallet: ${err.message}`, 'error');
    } finally {
      updateState({ addingWallet: false });
    }
  };

  // Check user registration when wallet is connected
  const checkUserRegistration = async () => {
    if (!walletAddress || !blockchainId) return;
    
    try {
      const result = await apiCall(`/user/wallet/${walletAddress}/${blockchainId}`);
      const userData: RegisteredUser = {
        ...result.data,
        registeredAt: new Date(result.data.createdAt || Date.now()).toLocaleString(),
        planName: result.data.Plan?.name || 'Free',
        // Use real API data or default values
        queryUsage: result.data.queryUsage || 0,
        trialDaysUsed: result.data.trialDaysUsed || 0,
      };

      setRegisteredUser(userData);
      
      const planConfig = getPlanConfig(userData.planName);
      if (planConfig.maxWallets > 1) {
        await fetchWalletLimits(userData.id);
      }

    } catch (err) {
      setRegisteredUser(null);
    } finally {
      updateState({ isChecking: false });
    }
  };

  // Credit score helpers
  const getCreditScoreColor = (score: number) => 
    score >= 700 ? 'text-green-600' : score >= 500 ? 'text-yellow-600' : 'text-red-600';
  
  const getCreditScoreLabel = (score: number) => 
    score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';

  // Initialize when wallet connects
  useEffect(() => {
    if (isLoggedIn && walletAddress && blockchainId) {
      checkUserRegistration();
    } else {
      updateState({ isChecking: false });
      setRegisteredUser(null);
    }
  }, [isLoggedIn, walletAddress, blockchainId]);

  // Enhanced Network Dropdown Component
  const NetworkDropdown = ({ 
    selectedNetwork, 
    onSelect, 
    isOpen, 
    setIsOpen, 
    placeholder = "Select Network" 
  }: {
    selectedNetwork: string;
    onSelect: (networkId: string) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    placeholder?: string;
  }) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 border rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          {selectedNetwork && (
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          )}
          <span className={selectedNetwork ? 'text-gray-900' : 'text-gray-500'}>
            {selectedNetwork ? SUPPORTED_NETWORKS[selectedNetwork]?.name : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {Object.entries(SUPPORTED_NETWORKS)
            .sort(([, a], [, b]) => a.name.localeCompare(b.name))
            .map(([chainId, network]) => (
            <button
              key={chainId}
              type="button"
              onClick={() => {
                onSelect(chainId);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none flex items-center justify-between border-b border-gray-100 last:border-b-0 transition-colors ${
                selectedNetwork === chainId ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-center flex-1">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  selectedNetwork === chainId ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">{network.name}</span>
                  <span className="text-xs text-gray-500">Chain ID: {network.chainId}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {network.default && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">Default</span>
                )}
                {selectedNetwork === chainId && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // FIXED: Plan Upgrade Message Component - only shows for critical conditions
  const PlanUpgradeMessage = () => {
    if (!getUpgradeMessage) return null;

    const bgColor = getUpgradeMessage.severity === 'error' 
      ? 'bg-red-50 border-red-200' 
      : 'bg-amber-50 border-amber-200';
    const textColor = getUpgradeMessage.severity === 'error' 
      ? 'text-red-800' 
      : 'text-amber-800';
    const iconColor = getUpgradeMessage.severity === 'error' 
      ? 'text-red-600' 
      : 'text-amber-600';
    const buttonColor = getUpgradeMessage.severity === 'error'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-amber-600 hover:bg-amber-700';

    return (
      <div className={`p-4 ${bgColor} border rounded-lg mb-6`}>
        <div className="flex items-start">
          <Crown className={`w-6 h-6 ${iconColor} mr-3 mt-0.5 flex-shrink-0`} />
          <div className="flex-1">
            <p className={`font-semibold ${textColor} mb-1`}>
              {getUpgradeMessage.severity === 'error' ? '🚨 Action Required' : '⚠️ Upgrade Recommended'}
            </p>
            <p className={`text-sm ${textColor} mb-3 leading-relaxed`}>
              {getUpgradeMessage.message}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/plans')}
                className={`text-sm font-medium px-4 py-2 rounded transition-colors text-white ${buttonColor}`}
              >
                🚀 Upgrade Now
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm font-medium px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Show connect wallet screen if not logged in
  if (!isLoggedIn) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
          <Wallet className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            Please connect your MetaMask wallet to access the User Registry.
          </p>
          <button
            onClick={login}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Connect MetaMask Wallet
          </button>
        </div>
      </div>
    );
  }

  if (state.isChecking) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2">Checking registration status...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">User Registry</h1>
      
      {/* FIXED: Plan Upgrade Message - Only shows when critical conditions are met */}
      <PlanUpgradeMessage />
      
      {/* Wallet Info */}
      <div className="mb-4 p-3 bg-gray-50 border rounded">
        <p className="text-sm text-gray-600">
          <strong>Wallet:</strong> <span className="font-mono break-all">{walletAddress}</span>
        </p>
        <p className="text-sm text-gray-600">
          <strong>Network:</strong> <span className="font-mono">{blockchainId}</span> 
          {blockchainId && SUPPORTED_NETWORKS[blockchainId] && (
            <span className="ml-2">({SUPPORTED_NETWORKS[blockchainId].name})</span>
          )}
        </p>
      </div>

      {registeredUser ? (
        <>
          {/* Registration Status */}
          <div className="p-4 bg-green-50 border border-green-200 rounded mb-4">
            <p className="font-semibold text-green-800 mb-3">✅ Registration Active</p>
            
            <div className="space-y-2 text-sm">
              {registeredUser.name && (
                <p><strong>Name:</strong> {registeredUser.name}</p>
              )}
              {registeredUser.email && (
                <p><strong>Email:</strong> {registeredUser.email}</p>
              )}
              <p><strong>Identity:</strong> <span className="ml-2 font-mono break-all">{registeredUser.metadataURI}</span></p>
              <p><strong>Network:</strong> {registeredUser.blockchainId && SUPPORTED_NETWORKS[registeredUser.blockchainId] ? SUPPORTED_NETWORKS[registeredUser.blockchainId].name : registeredUser.blockchainId}</p>
              <p><strong>Registered:</strong> {registeredUser.registeredAt}</p>
            </div>

            {/* Plan Information */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="font-semibold text-blue-800 mb-2">📋 Plan: {registeredUser.planName}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Limits:</strong></p>
                  <ul className="ml-4 list-disc">
                    <li>Wallets: <strong>{planCapabilities.maxWallets}</strong></li>
                    <li>Queries: <strong>{planCapabilities.queryLimit.toLocaleString()}</strong>/month</li>
                    {planCapabilities.txnLimit && <li>Transaction: <strong>${planCapabilities.txnLimit.toLocaleString()}</strong></li>}
                  </ul>
                </div>
                <div>
                  <p><strong>Features:</strong></p>
                  <ul className="ml-4 list-disc">
                    <li>{planCapabilities.canViewOthers ? '✅' : '❌'} View others</li>
                    <li>{planCapabilities.canAddWallets ? '✅' : '❌'} Multi-wallet</li>
                    <li>✅ Credit scoring</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Dashboard Button */}
            <div className="mt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard →
              </button>
            </div>
          </div>

          {/* Multi-Wallet Management */}
          {planCapabilities.maxWallets > 1 ? (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Wallet className="w-5 h-5 text-indigo-600 mr-2" />
                  <h3 className="font-semibold text-indigo-800">💼 Wallet Portfolio</h3>
                </div>
                <button
                  onClick={() => updateState({ showAddWallet: !state.showAddWallet })}
                  disabled={walletLimits ? walletLimits.usedWallets >= walletLimits.allowedWallets : false}
                  className="flex items-center bg-indigo-500 text-white px-3 py-2 rounded text-sm hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Wallet
                </button>
              </div>
              
              {/* Wallet Usage */}
              {walletLimits && (
                <div className="mb-4 p-3 bg-white border rounded">
                  <p className="font-medium mb-2">Wallet Usage</p>
                  <p className="text-sm text-gray-600">
                    <strong>{walletLimits.usedWallets}/{walletLimits.allowedWallets}</strong> wallets used
                  </p>
                </div>
              )}

              {/* Add Wallet Form */}
              {state.showAddWallet && (
                <div className="mb-4 p-4 bg-white border rounded">
                  <h4 className="font-medium mb-3">Add Additional Wallet</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Wallet Address (0x...)"
                      value={state.newWalletAddress}
                      onChange={(e) => updateState({ newWalletAddress: e.target.value })}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    
                    <NetworkDropdown
                      selectedNetwork={state.newWalletChain}
                      onSelect={(chainId) => updateState({ newWalletChain: chainId })}
                      isOpen={state.newWalletNetworkDropdownOpen}
                      setIsOpen={(open) => updateState({ newWalletNetworkDropdownOpen: open })}
                      placeholder="Select Network"
                    />
                    
                    <input
                      type="text"
                      placeholder="Metadata URI"
                      value={state.newWalletMetadata}
                      onChange={(e) => updateState({ newWalletMetadata: e.target.value })}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={addAdditionalWallet}
                        disabled={state.addingWallet}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        {state.addingWallet ? "Adding..." : "Add Wallet"}
                      </button>
                      <button
                        onClick={() => updateState({ 
                          showAddWallet: false,
                          newWalletAddress: '',
                          newWalletChain: '',
                          newWalletMetadata: ''
                        })}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Wallet List */}
              {userWallets.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Your Wallets</h4>
                  {userWallets.map((wallet) => (
                    <div key={wallet.id} className="p-3 bg-white border rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="font-mono text-sm">
                              {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
                            </span>
                            {wallet.isPrimary && (
                              <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Primary</span>
                            )}
                            {wallet.blockchainId !== registeredUser?.blockchainId && (
                              <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">Cross-Chain</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {wallet.blockchainName} • {new Date(wallet.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${getCreditScoreColor(wallet.creditScore)}`}>
                            {wallet.creditScore}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getCreditScoreLabel(wallet.creditScore)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 border rounded">
              <div className="flex items-center">
                <Lock className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <h3 className="font-medium text-gray-700">Single Wallet Plan</h3>
                  <p className="text-gray-600 text-sm">
                    Upgrade to Pro or Premium for multi-wallet support.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Update Section */}
          <div className="space-y-3">
            <h3 className="font-semibold">Update Metadata</h3>
            <input
              className="border p-3 rounded w-full focus:ring-2 focus:ring-blue-500"
              placeholder="New metadata URI"
              value={state.newMetadataUri}
              onChange={(e) => updateState({ newMetadataUri: e.target.value })}
            />
            <button
              onClick={handleUpdate}
              disabled={state.loading || !state.newMetadataUri}
              className="w-full bg-indigo-600 px-4 py-3 text-white rounded disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
              {state.loading ? "Updating..." : "Update Metadata"}
            </button>
          </div>
        </>
      ) : (
        // Registration Form
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Create Your Account</h2>
          
          {/* Supported Networks Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-4">
            <div className="flex items-center mb-2">
              <Info className="w-4 h-4 text-blue-600 mr-2" />
              <span className="text-blue-800 font-medium">Multi-Chain Support</span>
            </div>
            <div className="text-sm text-blue-700">
              <p className="mb-2">Register once and access your identity across multiple blockchains:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SUPPORTED_NETWORKS)
                  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                  .map(([chainId, network]) => (
                  <div key={chainId} className="flex items-center text-xs">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span>{network.name}</span>
                    {network.default && <span className="ml-1 text-green-600 font-medium">(Default)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* User Information Fields */}
          <div className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                className="border p-3 pl-10 rounded w-full focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Full Name *"
                value={state.userName}
                onChange={(e) => updateState({ userName: e.target.value })}
                required
              />
            </div>
            
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="email"
                className="border p-3 pl-10 rounded w-full focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Email Address *"
                value={state.userEmail}
                onChange={(e) => updateState({ userEmail: e.target.value })}
                required
              />
              {state.userEmail && !validateEmail(state.userEmail) && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid email address</p>
              )}
            </div>
          </div>

          {state.isGeneratingMetadata && (
            <div className="flex items-center justify-center p-4 bg-yellow-50 border border-yellow-200 rounded">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mr-2"></div>
              <span className="text-yellow-800">Generating metadata...</span>
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={
              state.loading || 
              state.isGeneratingMetadata ||
              !state.userName.trim() || 
              !state.userEmail.trim() || 
              (state.userEmail.trim() && !validateEmail(state.userEmail.trim()))
            }
            className="w-full bg-green-600 px-4 py-3 text-white rounded disabled:opacity-50 hover:bg-green-700 transition-colors font-medium"
          >
            {state.loading 
              ? "Creating Account..." 
              : state.isGeneratingMetadata 
                ? "Preparing..." 
                : "Create Account & Register"}
          </button>

          {/* Current Network Warning */}
          {blockchainId && !SUPPORTED_NETWORKS[blockchainId] && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-orange-600 mr-2" />
                <span className="text-orange-800 font-medium">Unsupported Network</span>
              </div>
              <p className="text-orange-700 text-sm mt-1">
                Please switch to a supported network to register. Current network ({blockchainId}) is not supported.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserRegistryPage;
