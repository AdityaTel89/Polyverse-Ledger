// src/pages/UsersPage.tsx - CORRECTED VERSION (Duplicate key fixed)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Wallet, Search, RefreshCw, AlertCircle, Info, Lock, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout';
import PlanCard from '../components/PlanCard';
import PlanUsageStats from '../components/PlanUsageStats';
import UpgradePlans from '../components/UpgradePlans';
import TransactionLimits from '../components/TransactionLimits';
import { BASE_API_URL } from '../utils/constants';
import { PLAN_CONFIG, getFormattedPlanPrice, getPlanConfig, getPlanDescription } from '../utils/planConfig';
import { isTrialActive, getTrialDaysRemaining } from '../utils/isTrialActive';

interface User {
  id: string;
  walletAddress: string;
  blockchainId: string;
  bns: string;
  crossChainAddress: string;
  metadataUri: string;
  creditScore: number;
  createdAt: string;
  updatedAt: string;
  Plan?: { name: string };
  planSource?: 'individual' | 'organization' | 'inherited';
  trialStartDate?: string;
  trialUsed?: boolean;
  queriesUsed?: number;
  queriesLimit?: number;
  trialDaysRemaining?: number;
  trialActive?: boolean;
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
  subscriptionActive?: boolean;
  isPrimary?: boolean;
  source?: 'primary' | 'crosschain';
  parentUserId?: string;
  blockchainName?: string;
  isCurrentUser?: boolean;
  walletSource?: 'primary' | 'crosschain';
  crossChainIdentityId?: string;
  queryResetDate?: string;
  lastQueryReset?: string;
  transactionLimits?: {
    used: number;
    limit: number | null;
    currency: string;
    percentage: number;
  };
  walletLimits?: {
    planName: string;
    allowedWallets: number;
    usedWallets: number;
    queryLimit: number;
    txnLimit: number | null;
    trialActive: boolean;
    walletDetails: any[];
  };
  planDetails?: any;
  isLoadingPlan?: boolean;
  isLoadingQueryUsage?: boolean;
  isLoadingTransactionLimits?: boolean;
  primaryWalletAddress?: string;
  primaryBlockchainId?: string;
}

interface ErrorState {
  hasError: boolean;
  type: 'network' | 'ratelimit' | 'auth' | 'unknown';
  message: string;
  retryable: boolean;
  timestamp: number;
}

interface AppState {
  walletConnected: boolean;
  walletAddress: string | null;
  blockchainId: string | null;
  isRateLimited: boolean;
  error: ErrorState | null;
}

// Custom hook for debounced search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Custom hook for caching
const useCache = () => {
  const cache = useRef(new Map<string, { data: any; timestamp: number }>());
  
  const getCached = useCallback((key: string, maxAge = 5 * 60 * 1000) => {
    const cached = cache.current.get(key);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      return cached.data;
    }
    return null;
  }, []);
  
  const setCache = useCallback((key: string, data: any) => {
    cache.current.set(key, { data, timestamp: Date.now() });
    // Cleanup old entries
    if (cache.current.size > 50) {
      const oldestKey = cache.current.keys().next().value;
      cache.current.delete(oldestKey);
    }
  }, []);
  
  return { getCached, setCache };
};

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { getCached, setCache } = useCache();
  
  // Simplified state management
  const [appState, setAppState] = useState<AppState>({
    walletConnected: false,
    walletAddress: null,
    blockchainId: null,
    isRateLimited: false,
    error: null,
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  // Cache for successful data
  const [cachedUser, setCachedUser] = useState<User | null>(null);
  const [cachedUsers, setCachedUsers] = useState<User[]>([]);

  // Optimized fallback user creation - memoized to prevent recreation
  const fallbackUser = useMemo((): User | null => {
    if (!appState.walletAddress || !appState.blockchainId) return null;
    
    return {
      id: `fallback-${appState.walletAddress}-${appState.blockchainId}`,
      walletAddress: appState.walletAddress,
      blockchainId: appState.blockchainId,
      bns: '',
      crossChainAddress: '',
      metadataUri: '',
      creditScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      Plan: { name: 'Free' },
      planSource: 'individual',
      trialStartDate: new Date().toISOString(),
      trialUsed: false,
      queriesUsed: 100,
      queriesLimit: getPlanConfig('Free').queryLimit,
      trialDaysRemaining: 0,
      trialActive: false,
      subscriptionEndDate: '',
      subscriptionStartDate: '',  
      subscriptionActive: false,
      isPrimary: true,
      source: 'primary',
      parentUserId: undefined,
      blockchainName: 'Primary Wallet',
      isCurrentUser: true,
      walletSource: 'primary',
      crossChainIdentityId: `fallback-${appState.walletAddress}`,
      queryResetDate: '',
      lastQueryReset: '',
      transactionLimits: {
        used: 0,
        limit: getPlanConfig('Free').txnLimit,
        currency: 'USD',
        percentage: 0,
      },
      walletLimits: undefined,
      planDetails: getPlanConfig('Free'),
      isLoadingPlan: false,
      isLoadingQueryUsage: false,
      isLoadingTransactionLimits: false,
      primaryWalletAddress: appState.walletAddress,
      primaryBlockchainId: appState.blockchainId,
    };
  }, [appState.walletAddress, appState.blockchainId]);

  // Enhanced API helper with better error handling
  const apiCall = useCallback(async (url: string, retryCount = 0): Promise<any> => {
    const cacheKey = `api-${url}`;
    const cached = getCached(cacheKey, 2 * 60 * 1000); // 2 minutes cache
    if (cached) return cached;

    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.status === 429) {
        setAppState(prev => ({
          ...prev,
          isRateLimited: true,
          error: {
            hasError: true,
            type: 'ratelimit',
            message: 'Rate limit exceeded - showing upgrade options',
            retryable: false,
            timestamp: Date.now(),
          }
        }));
        
        throw new Error('Rate limit exceeded');
      }
      
      // Clear rate limit and errors on successful request
      if (appState.isRateLimited || appState.error) {
        setAppState(prev => ({
          ...prev,
          isRateLimited: false,
          error: null,
        }));
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCache(cacheKey, data);
      return data;
    } catch (error: any) {
      console.error('API call failed:', { url, error: error.message, retryCount });
      
      if (error.message.includes('Rate limit exceeded')) {
        throw error;
      }
      
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return apiCall(url, retryCount + 1);
      }
      
      setAppState(prev => ({
        ...prev,
        error: {
          hasError: true,
          type: 'network',
          message: error.message || 'Network request failed',
          retryable: true,
          timestamp: Date.now(),
        }
      }));
      
      throw error;
    }
  }, [getCached, setCache, appState.isRateLimited, appState.error]);

  // Optimized plan name extraction
  const extractPlanName = useCallback((planData: any): string => {
    if (!planData) return 'Free';
    
    if (Array.isArray(planData)) {
      return planData[0]?.name || 'Free';
    }
    
    if (typeof planData === 'object' && planData.name) {
      return planData.name;
    }
    
    if (typeof planData === 'string') {
      return planData;
    }
    
    return 'Free';
  }, []);

  // Memoized primary wallet info getter
  const getPrimaryWalletInfo = useCallback(async (user: any) => {
    const cacheKey = `primary-wallet-${user.id || user.crossChainIdentityId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      if (user.source === 'crosschain') {
        if (user.User?.walletAddress && user.User?.blockchainId) {
          const result = {
            walletAddress: user.User.walletAddress,
            blockchainId: user.User.blockchainId
          };
          setCache(cacheKey, result);
          return result;
        }

        const primaryUserId = user.mainUserId || user.userId || user.parentUserId;
        if (primaryUserId) {
          try {
            const walletLimitsResponse = await apiCall(`${BASE_API_URL}/user/wallet-limits/${primaryUserId}`);
            const walletLimits = walletLimitsResponse.data || walletLimitsResponse;
            
            if (walletLimits?.walletDetails?.length > 0) {
              const primaryWallet = walletLimits.walletDetails.find((wallet: any) => wallet.isPrimary) ||
                                  walletLimits.walletDetails[0];
              
              if (primaryWallet?.walletAddress && primaryWallet?.blockchainId) {
                const result = {
                  walletAddress: primaryWallet.walletAddress,
                  blockchainId: primaryWallet.blockchainId
                };
                setCache(cacheKey, result);
                return result;
              }
            }
          } catch (error) {
            console.warn('Failed to fetch primary wallet info:', error);
          }
        }

        // Fallback checks
        if (user.primaryWalletAddress && user.primaryBlockchainId) {
          const result = {
            walletAddress: user.primaryWalletAddress,
            blockchainId: user.primaryBlockchainId
          };
          setCache(cacheKey, result);
          return result;
        }

        if (user.mainUser?.walletAddress && user.mainUser?.blockchainId) {
          const result = {
            walletAddress: user.mainUser.walletAddress,
            blockchainId: user.mainUser.blockchainId
          };
          setCache(cacheKey, result);
          return result;
        }
      }
    } catch (error) {
      console.warn('Error getting primary wallet info:', error);
    }
    
    return null;
  }, [apiCall, getCached, setCache]);

  // Optimized user data correction
  const getCorrectUserData = useCallback((user: any, planName: string) => {
    const planConfig = getPlanConfig(planName);
    const correctedLimit = user.queriesLimit !== planConfig.queryLimit ? 
      planConfig.queryLimit : (user.queriesLimit || planConfig.queryLimit);
    const correctedUsage = Math.min(user.queriesUsed || 0, correctedLimit);

    return {
      ...user,
      queriesLimit: correctedLimit,
      queriesUsed: correctedUsage
    };
  }, []);

  // Optimized wallet connection detection - removed problematic dependency
  const checkWalletConnection = useCallback(() => {
    const walletAddress = window.localStorage.getItem('walletAddress');
    const blockchainId = window.localStorage.getItem('blockchainId');
    const isConnected = !!(walletAddress && blockchainId);
    
    setAppState(prev => {
      // Only update if actually changed to prevent unnecessary re-renders
      if (prev.walletConnected !== isConnected || 
          prev.walletAddress !== walletAddress || 
          prev.blockchainId !== blockchainId) {
        
        if (!isConnected) {
          // Clear cache and queries when wallet disconnected
          queryClient.removeQueries({ queryKey: ['currentUser'] });
          queryClient.removeQueries({ queryKey: ['users'] });
          setCachedUser(null);
          setCachedUsers([]);
        }
        
        return {
          ...prev,
          walletConnected: isConnected,
          walletAddress,
          blockchainId,
          isRateLimited: isConnected ? prev.isRateLimited : false,
          error: isConnected ? prev.error : null,
        };
      }
      return prev;
    });
    
    return isConnected;
  }, [queryClient]);

  // Memoized transaction limits with caching
  const getTransactionLimits = useCallback(async (
    walletAddress: string, 
    blockchainId: string, 
    planName: string, 
    user?: any
  ) => {
    const cacheKey = `txn-limits-${walletAddress}-${blockchainId}-${planName}`;
    const cached = getCached(cacheKey, 3 * 60 * 1000); // 3 minutes cache
    if (cached) return cached;

    const defaultLimits = {
      used: 0,
      limit: getPlanConfig(planName).txnLimit,
      currency: 'USD',
      percentage: 0,
      planName: planName
    };

    try {
      let txnResponse;
      
      try {
        txnResponse = await apiCall(`${BASE_API_URL}/transaction/limits/${walletAddress}/${blockchainId}`);
      } catch (error: any) {
        if (error.message.includes('404') && user?.source === 'crosschain') {
          const primaryWalletInfo = await getPrimaryWalletInfo(user);
          
          if (primaryWalletInfo) {
            try {
              txnResponse = await apiCall(
                `${BASE_API_URL}/transaction/limits/${primaryWalletInfo.walletAddress}/${primaryWalletInfo.blockchainId}`
              );
              
              // Update user with primary wallet info
              if (user) {
                user.primaryWalletAddress = primaryWalletInfo.walletAddress;
                user.primaryBlockchainId = primaryWalletInfo.blockchainId;
              }
            } catch (primaryError) {
              throw error;
            }
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      
      if (txnResponse?.success && txnResponse.data) {
        const txnData = txnResponse.data;
        const planTxnLimit = txnData.limit;
        
        const result = {
          used: txnData.currentVolume || 0,
          limit: planTxnLimit,
          currency: 'USD',
          percentage: planTxnLimit !== null && planTxnLimit > 0 ? 
            Math.round(((txnData.currentVolume || 0) / planTxnLimit) * 100) : 0,
          planName: planName
        };
        
        setCache(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn('Failed to fetch transaction limits:', error);
    }

    setCache(cacheKey, defaultLimits);
    return defaultLimits;
  }, [apiCall, getPrimaryWalletInfo, getCached, setCache]);

  // Optimized query limits checker
  const hasExceededQueryLimits = useCallback((user: User | null): boolean => {
    if (!user) return false;
    
    const planName = user.Plan?.name || 'Free';
    const planConfig = getPlanConfig(planName);
    const queryLimit = user.queriesLimit ?? planConfig.queryLimit;
    const queryUsed = user.queriesUsed ?? 0;
    
    return queryUsed >= queryLimit;
  }, []);

  // Optimized query enablement logic
  const shouldEnableQueries = useMemo((): boolean => {
    return appState.walletConnected && 
           !!appState.walletAddress && 
           !!appState.blockchainId && 
           !appState.isRateLimited;
  }, [appState.walletConnected, appState.walletAddress, appState.blockchainId, appState.isRateLimited]);

  // Optimized current user query
  const {
    data: currentUser,
    isLoading: userLoading,
    error: userError,
  } = useQuery({
    queryKey: ['currentUser', appState.walletAddress, appState.blockchainId],
    queryFn: async (): Promise<User | null> => {
      if (!appState.walletConnected || !appState.walletAddress || !appState.blockchainId) {
        return null;
      }

      const { walletAddress, blockchainId } = appState;
      
      try {
        // Check cache first for recent data
        const userCacheKey = `user-${walletAddress}-${blockchainId}`;
        const cachedUserData = getCached(userCacheKey, 60 * 1000); // 1 minute cache
        
        const userData = cachedUserData || await apiCall(`${BASE_API_URL}/user/wallet/${walletAddress}/${blockchainId}`);
        const user = userData.data || userData;
        
        if (!user) {
          throw new Error('User not found');
        }

        // Cache the raw user data
        if (!cachedUserData) {
          setCache(userCacheKey, userData);
        }

        // Extract plan name
        let planName: string;
        let primaryWalletInfo = null;
        
        if (user.source === 'primary') {
          planName = extractPlanName(user.Plan) || user.planName || 'Free';
        } else if (user.source === 'crosschain') {
          planName = user.planName || extractPlanName(user.User?.Plan) || 'Free';
          
          if (user.User?.walletAddress && user.User?.blockchainId) {
            primaryWalletInfo = {
              walletAddress: user.User.walletAddress,
              blockchainId: user.User.blockchainId
            };
          }
        } else {
          planName = 'Free';
        }

        // Fetch query usage
        let queriesUsed = 0;
        let queriesLimit = getPlanConfig(planName).queryLimit;
        
        try {
          const userId = user.source === 'primary' ? user.id : user.mainUserId || user.userId;
          
          if (userId) {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            
            const queryUsageResponse = await apiCall(
              `${BASE_API_URL}/query-usage/${userId}/${currentMonth}/${currentYear}`
            );
            
            if (queryUsageResponse.success && queryUsageResponse.data) {
              queriesUsed = queryUsageResponse.data.used || 0;
            } else {
              queriesUsed = user.queryCount || user.queriesUsed || 0;
            }
          } else {
            queriesUsed = user.queryCount || user.queriesUsed || 0;
          }
        } catch (usageError) {
          console.warn('Failed to fetch query usage:', usageError);
          queriesUsed = user.queryCount || user.queriesUsed || 0;
        }

        // Fetch transaction limits
        const transactionLimits = await getTransactionLimits(walletAddress, blockchainId, planName, {
          ...user,
          primaryWalletInfo
        });

        // Correct user data inconsistencies
        const correctedUser = getCorrectUserData({
          ...user,
          queriesUsed,
          queriesLimit
        }, planName);

        // Fetch wallet limits for primary users
        let walletLimits = null;
        if (user.source === 'primary' && user.id) {
          try {
            const walletLimitsResult = await apiCall(`${BASE_API_URL}/user/wallet-limits/${user.id}`);
            walletLimits = walletLimitsResult.data || walletLimitsResult;
          } catch (error) {
            console.warn('Failed to fetch wallet limits:', error);
          }
        }

        // Create final user object with proper typing - FIXED: Removed duplicate planDetails
        const finalUser: User = {
          id: user.id || user.crossChainIdentityId || `${walletAddress}-${blockchainId}`,
          walletAddress,
          blockchainId,
          bns: user.bns || user.metadataURI || '',
          crossChainAddress: user.crossChainAddress || (user.source === 'crosschain' ? walletAddress : ''),
          metadataUri: user.metadataURI || user.metadataUri || '',
          creditScore: user.creditScore || 0,
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
          Plan: { name: planName },
          planSource: user.source === 'crosschain' && user.parentUserId ? 'inherited' : 'individual',
          source: user.source || 'primary',
          walletSource: user.source || 'primary',
          crossChainIdentityId: user.crossChainIdentityId || user.id,
          parentUserId: user.mainUserId || user.userId || (user.source === 'crosschain' ? user.User?.id : undefined),
          isPrimary: user.source === 'primary',
          isCurrentUser: true,
          blockchainName: user.source === 'crosschain' ? 'Cross-Chain Wallet' : 'Primary Wallet',
          walletLimits,
          trialActive: planName === 'Free' ? !user.trialUsed || isTrialActive(user.trialStartDate) : false,
          trialDaysRemaining: planName === 'Free' ? getTrialDaysRemaining(user.trialStartDate) : 0,
          subscriptionActive: planName !== 'Free',
          transactionLimits,
          isLoadingTransactionLimits: false,
          queriesUsed,
          queriesLimit,
          primaryWalletAddress: user.primaryWalletAddress,
          primaryBlockchainId: user.primaryBlockchainId,
          trialStartDate: user.trialStartDate,
          trialUsed: user.trialUsed,
          subscriptionEndDate: user.subscriptionEndDate,
          subscriptionStartDate: user.subscriptionStartDate,
          queryResetDate: user.queryResetDate,
          lastQueryReset: user.lastQueryReset,
          planDetails: getPlanConfig(planName), // FIXED: Only one planDetails declaration
          isLoadingPlan: false,
          isLoadingQueryUsage: false,
        };
        
        // Cache successful user data
        setCachedUser(finalUser);
        
        return finalUser;
      } catch (error: any) {
        console.error('Failed to fetch user data:', error);
        throw error;
      }
    },
    enabled: shouldEnableQueries,
    staleTime: 2 * 60 * 1000,  // Reduced from 5 minutes
    gcTime: 5 * 60 * 1000,     // Reduced from 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,   // Enable for better UX
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('Rate limit exceeded') || 
          error?.message?.includes('429')) {
        return false;
      }
      return failureCount < 2;  // Reduced retry attempts
    },
  });

  // Optimized effective current user
  const effectiveCurrentUser: User | null = useMemo(() => {
    if (currentUser) return currentUser;
    if (cachedUser && !appState.isRateLimited) return cachedUser;
    
    // If rate limited and no cached user, create fallback
    if (appState.isRateLimited && appState.walletConnected && fallbackUser) {
      return fallbackUser;
    }
    
    return null;
  }, [currentUser, cachedUser, appState.isRateLimited, appState.walletConnected, fallbackUser]);

  // Optimized users query
  const {
    data: users = [],
    isLoading: usersLoading,
  } = useQuery({
    queryKey: ['users', effectiveCurrentUser?.id, effectiveCurrentUser?.parentUserId, effectiveCurrentUser?.source],
    queryFn: async (): Promise<User[]> => {
      if (!effectiveCurrentUser) return [];

      // Early return for cross-chain users
      if (effectiveCurrentUser.source === 'crosschain' || 
          effectiveCurrentUser.planSource === 'inherited') {
        const users = [effectiveCurrentUser];
        setCachedUsers(users);
        return users;
      }

      const allUsers: User[] = [effectiveCurrentUser];
      
      try {
        const primaryUserId = effectiveCurrentUser.source === 'crosschain' && effectiveCurrentUser.parentUserId 
          ? effectiveCurrentUser.parentUserId 
          : effectiveCurrentUser.id;
        
        const walletLimitsResponse = await apiCall(`${BASE_API_URL}/user/wallet-limits/${primaryUserId}`);
        const walletLimits = walletLimitsResponse.data || walletLimitsResponse;
        
        if (walletLimits?.walletDetails?.length > 0) {
          // Process wallet details in parallel for better performance
          const walletPromises = walletLimits.walletDetails
            .filter((wallet: any) => {
              const walletKey = `${wallet.walletAddress}-${wallet.blockchainId}`;
              const currentKey = `${effectiveCurrentUser.walletAddress}-${effectiveCurrentUser.blockchainId}`;
              return walletKey !== currentKey;
            })
            .map(async (wallet: any) => {
              const walletTransactionLimits = await getTransactionLimits(
                wallet.walletAddress, 
                wallet.blockchainId, 
                effectiveCurrentUser.Plan?.name || 'Free',
                wallet
              );

              // Create proper User object with all required fields
              const userWallet: User = {
                id: wallet.id || `${wallet.walletAddress}-${wallet.blockchainId}`,
                walletAddress: wallet.walletAddress || '',
                blockchainId: wallet.blockchainId || '',
                bns: wallet.bns || '',
                crossChainAddress: wallet.crossChainAddress || '',
                metadataUri: wallet.metadataUri || '',
                creditScore: wallet.creditScore || 0,
                createdAt: wallet.createdAt || new Date().toISOString(),
                updatedAt: wallet.updatedAt || new Date().toISOString(),
                Plan: effectiveCurrentUser.Plan,
                planSource: 'inherited',
                trialStartDate: effectiveCurrentUser.trialStartDate,
                trialUsed: effectiveCurrentUser.trialUsed,
                queriesUsed: effectiveCurrentUser.queriesUsed,
                queriesLimit: effectiveCurrentUser.queriesLimit,
                trialDaysRemaining: effectiveCurrentUser.trialDaysRemaining,
                trialActive: effectiveCurrentUser.trialActive,
                subscriptionEndDate: effectiveCurrentUser.subscriptionEndDate,
                subscriptionStartDate: effectiveCurrentUser.subscriptionStartDate,
                subscriptionActive: effectiveCurrentUser.subscriptionActive,
                isPrimary: wallet.isPrimary || false,
                source: wallet.isPrimary ? 'primary' : 'crosschain',
                parentUserId: effectiveCurrentUser.parentUserId,
                blockchainName: wallet.blockchainName || (wallet.isPrimary ? 'Primary Wallet' : 'Sub-Wallet'),
                isCurrentUser: false,
                walletSource: wallet.isPrimary ? 'primary' : 'crosschain',
                crossChainIdentityId: wallet.crossChainIdentityId,
                queryResetDate: effectiveCurrentUser.queryResetDate,
                lastQueryReset: effectiveCurrentUser.lastQueryReset,
                transactionLimits: walletTransactionLimits,
                walletLimits: effectiveCurrentUser.walletLimits,
                planDetails: effectiveCurrentUser.planDetails,
                isLoadingPlan: false,
                isLoadingQueryUsage: false,
                isLoadingTransactionLimits: false,
                primaryWalletAddress: effectiveCurrentUser.primaryWalletAddress,
                primaryBlockchainId: effectiveCurrentUser.primaryBlockchainId,
              };

              return userWallet;
            });

          const additionalWallets = await Promise.all(walletPromises);
          allUsers.push(...additionalWallets);
        }
      } catch (error) {
        console.warn('Failed to fetch additional wallets:', error);
        if (cachedUsers.length > 0) {
          return cachedUsers;
        }
      }
      
      // Respect plan limits
      const planConfig = getPlanConfig(effectiveCurrentUser.Plan?.name || 'Free');
      const finalUsers = allUsers.slice(0, planConfig.maxWallets);
      setCachedUsers(finalUsers);
      return finalUsers;
    },
    enabled: !!effectiveCurrentUser && !appState.isRateLimited,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('Rate limit exceeded') || 
          error?.message?.includes('429')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Effective users with fallback
  const effectiveUsers = useMemo(() => {
    if (users.length > 0) return users;
    if (cachedUsers.length > 0) return cachedUsers;
    if (effectiveCurrentUser) return [effectiveCurrentUser];
    return [];
  }, [users, cachedUsers, effectiveCurrentUser]);

  // Optimized computed values
  const isCurrentUserCrossChain = useMemo(() => {
    if (!effectiveCurrentUser) return false;
    
    return !!(
      (effectiveCurrentUser.source === 'crosschain') ||
      (effectiveCurrentUser.walletSource === 'crosschain') ||
      (effectiveCurrentUser.planSource === 'inherited' && effectiveCurrentUser.parentUserId)
    );
  }, [effectiveCurrentUser]);

  const planConfig = useMemo(() => {
    return getPlanConfig(effectiveCurrentUser?.Plan?.name || 'Free');
  }, [effectiveCurrentUser?.Plan?.name]);

  const canViewOtherUsers = useMemo(() => {
    if (!effectiveCurrentUser || isCurrentUserCrossChain) return false;
    return planConfig.canViewOthers || effectiveCurrentUser.source === 'primary';
  }, [planConfig.canViewOthers, effectiveCurrentUser, isCurrentUserCrossChain]);

  // Optimized filtered users with debounced search
  const filteredUsers = useMemo(() => {
    if (!debouncedSearchTerm) return effectiveUsers;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return effectiveUsers.filter(user =>
      user.walletAddress?.toLowerCase().includes(searchLower) ||
      user.blockchainId?.toLowerCase().includes(searchLower) ||
      user.bns?.toLowerCase().includes(searchLower) ||
      user.blockchainName?.toLowerCase().includes(searchLower)
    );
  }, [effectiveUsers, debouncedSearchTerm]);

  // Optimized plan info
  const getCurrentPlanInfo = useMemo(() => {
    if (!effectiveCurrentUser) {
      const freePlanConfig = getPlanConfig('Free');
      return {
        name: 'Free Plan (Free)',
        queries: freePlanConfig.queryLimit,
        features: getPlanDescription('Free'),
        isAtLimit: false,
        usagePercentage: 0,
        canUpgrade: true
      };
    }

    const planName = effectiveCurrentUser.Plan?.name || 'Free';
    const currentPlanConfig = getPlanConfig(planName);
    
    const queryLimit = effectiveCurrentUser.queriesLimit ?? currentPlanConfig.queryLimit;
    const queryUsed = effectiveCurrentUser.queriesUsed ?? 0;
    
    const isAtLimit = queryUsed >= queryLimit;
    const usagePercentage = queryLimit > 0 ? Math.min((queryUsed / queryLimit) * 100, 100) : 0;
      
    const displayName = isCurrentUserCrossChain
      ? `${planName} Plan (Inherited from Primary)`
      : `${planName} Plan (${getFormattedPlanPrice(planName)})`;
    
    return {
      name: displayName,
      queries: queryLimit,
      features: getPlanDescription(planName),
      isAtLimit,
      usagePercentage,
      canUpgrade: planName !== 'Premium'
    };
  }, [effectiveCurrentUser, isCurrentUserCrossChain]);

  const shouldShowUpgradeMessage = useMemo(() => {
    if (!effectiveCurrentUser) return false;
    return hasExceededQueryLimits(effectiveCurrentUser);
  }, [effectiveCurrentUser, hasExceededQueryLimits]);

  const isFreeUserExceededLimits = useMemo(() => {
    if (!effectiveCurrentUser) return false;
    const planName = effectiveCurrentUser.Plan?.name || 'Free';
    return planName === 'Free' && hasExceededQueryLimits(effectiveCurrentUser);
  }, [effectiveCurrentUser, hasExceededQueryLimits]);

  // Optimized event handlers using mutations
  const refreshMutation = useMutation({
    mutationFn: async () => {
      // Clear all caches
      setAppState(prev => ({ ...prev, isRateLimited: false, error: null }));
      setCachedUser(null);
      setCachedUsers([]);
      
      // Force refresh queries
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onSuccess: () => {
      console.log('Data refreshed successfully');
    },
    onError: (error) => {
      console.error('Failed to refresh data:', error);
    },
  });

  const handlePaymentSuccess = useCallback((subscriptionId: string) => {
    localStorage.setItem('paymentCompleted', 'true');
    refreshMutation.mutate();
  }, [refreshMutation]);

  const handleManualRefresh = useCallback(() => {
    refreshMutation.mutate();
  }, [refreshMutation]);

  // Optimized effects
  useEffect(() => {
    checkWalletConnection();
    // Reduced polling frequency
    const interval = setInterval(checkWalletConnection, 30000); // 30 seconds instead of 10
    return () => clearInterval(interval);
  }, [checkWalletConnection]);

  // Memoized helper functions
  const formatWalletAddress = useCallback((address: string) => 
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No Address', []);
  
  const formatDate = useCallback((dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  }, []);

  const getCreditScoreColor = useCallback((score: number) => 
    score >= 700 ? 'text-green-600' : score >= 500 ? 'text-yellow-600' : 'text-red-600', []);

  const getCreditScoreLabel = useCallback((score: number) => 
    score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor', []);

  // Optimized loading and error states
  const isLoading = userLoading && !effectiveCurrentUser;
  const hasError = appState.error?.hasError && !userLoading && !effectiveCurrentUser && !appState.isRateLimited;

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users Dashboard</h1>
            <div className="flex items-center mt-2">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isLoading ? 'bg-yellow-400 animate-pulse' : 
                hasError ? 'bg-red-400' : 
                appState.isRateLimited ? 'bg-orange-400' :
                shouldShowUpgradeMessage ? 'bg-red-400' :
                'bg-green-400'
              }`} />
              <p className="text-gray-500">
                {isLoading ? 'Loading wallet data...' : 
                 appState.isRateLimited ? 'Query limit reached - showing upgrade options' :
                 shouldShowUpgradeMessage ? 'Query limit exceeded - upgrade required' :
                 hasError ? 'Connection issue - using cached data' :
                 effectiveCurrentUser ? `${getCurrentPlanInfo.name.split(' (')[0]} • ${effectiveUsers.length} wallet(s)` :
                 'Connect wallet to access dashboard'}
              </p>
            </div>
          </div>
        </div>

        {/* Rate limit section */}
        {appState.isRateLimited && (
          <div className="mb-8">
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Upgrade Your Plan</h3>
              {effectiveCurrentUser ? (
                <UpgradePlans
                  currentUser={effectiveCurrentUser}
                  trialEndDate={effectiveCurrentUser.subscriptionEndDate || ''}
                  currentPlanExpiry={effectiveCurrentUser.subscriptionEndDate || ''}
                  onApprove={handlePaymentSuccess}
                  onError={(error) => console.error('Payment error:', error)}
                  onCancel={() => console.log('Payment cancelled')}
                />
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Unable to load user data for upgrade options.</p>
                  <p className="text-gray-500 text-sm">Please refresh the page and try again.</p>
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshMutation.isPending}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {refreshMutation.isPending ? '🔄 Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <RefreshCw className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-yellow-800">Connection Issue</h3>
                  <p className="text-yellow-700 mt-1">
                    {appState.error?.message?.includes('broken') 
                      ? 'Cross-chain identity needs repair. Please contact support.' 
                      : effectiveCurrentUser 
                      ? 'Using cached data. Click refresh to try loading fresh data.'
                      : appState.error?.message || 'Please refresh the page manually'}
                  </p>
                </div>
              </div>
              {(effectiveCurrentUser || appState.error?.retryable) && (
                <button
                  onClick={handleManualRefresh}
                  disabled={refreshMutation.isPending}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium disabled:opacity-50"
                >
                  {refreshMutation.isPending ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* No wallet connected */}
        {!appState.walletConnected && !isLoading && (
          <div className="mb-8 p-12 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">No Wallet Connected</h2>
            <p className="text-gray-600 text-lg">Please connect your wallet to view your dashboard</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <RefreshCw className="w-6 h-6 text-blue-500 mr-3 animate-spin" />
              <div>
                <h3 className="text-lg font-medium text-blue-800">Loading Dashboard</h3>
                <p className="text-blue-700 mt-1">Fetching your wallet information...</p>
              </div>
            </div>
          </div>
        )}

        {/* Main content - only show when not rate limited */}
        {appState.walletConnected && effectiveCurrentUser && !appState.isRateLimited && (
          <>
            {/* Free Plan Limit Exceeded Message */}
            {isFreeUserExceededLimits && !isCurrentUserCrossChain && (
              <div className="mb-8 p-10 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 border-2 border-red-200 rounded-2xl shadow-lg">
                <div className="text-center">
                  <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-12 h-12 text-red-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-red-800 mb-4">Query Limit Reached!</h2>
                  <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 mb-6">
                    <p className="text-red-700 text-xl mb-2">
                      You've used <span className="font-bold text-2xl text-red-800">{effectiveCurrentUser.queriesUsed ?? 0}</span> of <span className="font-bold text-2xl text-red-800">{effectiveCurrentUser.queriesLimit ?? planConfig.queryLimit}</span> queries
                    </p>
                    <p className="text-red-600 text-lg">
                      Your Free plan trial period has reached its limit. Upgrade now to continue using our services!
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">🚫</div>
                      <p className="text-sm text-red-700">Service Limited</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">💎</div>
                      <p className="text-sm text-green-700">Upgrade Available</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">🚀</div>
                      <p className="text-sm text-blue-700">Instant Access</p>
                    </div>
                  </div>
                  
                  <p className="text-red-600 text-lg mb-8 font-medium">
                    Choose a premium plan below to unlock unlimited queries and advanced features!
                  </p>
                  
                  <div className="bg-white p-8 rounded-xl shadow-lg">
                    <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Upgrade Your Plan</h3>
                    <UpgradePlans
                      currentUser={effectiveCurrentUser}
                      trialEndDate={effectiveCurrentUser.subscriptionEndDate || ''}
                      currentPlanExpiry={effectiveCurrentUser.subscriptionEndDate || ''}
                      onApprove={handlePaymentSuccess}
                      onError={(error) => console.error('Payment error:', error)}
                      onCancel={() => console.log('Payment cancelled')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Regular Query Limit Exceeded Warning */}
            {shouldShowUpgradeMessage && !isFreeUserExceededLimits && !isCurrentUserCrossChain && (
              <div className="mb-8 p-8 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg">
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-red-800 mb-3">Query Limit Exceeded</h2>
                  <p className="text-red-700 text-lg mb-6">
                    You've used <strong>{effectiveCurrentUser.queriesUsed ?? 0}</strong> of <strong>{effectiveCurrentUser.queriesLimit ?? planConfig.queryLimit}</strong> queries 
                    {effectiveCurrentUser.Plan?.name === 'Free' ? ' in your trial period' : ' this month'}.
                  </p>
                  <p className="text-red-600 mb-8">
                    Upgrade your plan to continue using our services and unlock more features.
                  </p>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <UpgradePlans
                      currentUser={effectiveCurrentUser}
                      trialEndDate={effectiveCurrentUser.subscriptionEndDate || ''}
                      currentPlanExpiry={effectiveCurrentUser.subscriptionEndDate || ''}
                      onApprove={handlePaymentSuccess}
                      onError={(error) => console.error('Payment error:', error)}
                      onCancel={() => console.log('Payment cancelled')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cross-chain upgrade notice */}
            {shouldShowUpgradeMessage && isCurrentUserCrossChain && (
              <div className="mb-8 p-8 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-orange-800 mb-3">Query Limit Exceeded</h2>
                  <p className="text-orange-700 text-lg mb-6">
                    You've used <strong>{effectiveCurrentUser.queriesUsed ?? 0}</strong> of <strong>{effectiveCurrentUser.queriesLimit ?? planConfig.queryLimit}</strong> queries 
                    (shared with your primary wallet).
                  </p>
                  <p className="text-orange-600 mb-4">
                    To upgrade your plan, please use your <strong>primary wallet account</strong>. 
                    Plan changes will automatically apply to all your connected wallets.
                  </p>
                  {effectiveCurrentUser.parentUserId && (
                    <p className="text-orange-600 text-sm">
                      Primary Account: {effectiveCurrentUser.parentUserId.slice(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Data source indicator */}
            {effectiveCurrentUser === cachedUser && effectiveCurrentUser !== currentUser && (
              <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <Info className="w-5 h-5 text-blue-600 mr-3" />
                  <div>
                    <h3 className="text-md font-medium text-blue-800">Using Cached Data</h3>
                    <p className="text-blue-700 text-sm mt-1">
                      API requests are paused due to query limits. 
                      Showing your last successfully loaded data.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cross-chain transaction limits info */}
            {isCurrentUserCrossChain && effectiveCurrentUser.primaryWalletAddress && (
              <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <Info className="w-5 h-5 text-blue-600 mr-3" />
                  <div>
                    <h3 className="text-md font-medium text-blue-800">Transaction Limits Info</h3>
                    <p className="text-blue-700 text-sm mt-1">
                      Transaction limits displayed are from your primary wallet ({formatWalletAddress(effectiveCurrentUser.primaryWalletAddress)}) 
                      as cross-chain wallets share the same limits.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Plan Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <PlanCard
                planInfo={getCurrentPlanInfo}
                trialActive={effectiveCurrentUser.trialActive || false}
                trialDaysRemaining={effectiveCurrentUser.trialDaysRemaining || 0}
                subscriptionEndDate={effectiveCurrentUser.subscriptionEndDate}
                isCurrentPlan={effectiveCurrentUser.Plan?.name !== 'Free'}
              />
              
              <PlanUsageStats
                used={effectiveCurrentUser.queriesUsed ?? 0}
                limit={effectiveCurrentUser.queriesLimit ?? planConfig.queryLimit}
                usagePercentage={getCurrentPlanInfo.usagePercentage}
                resetDate={effectiveCurrentUser.queryResetDate}
              />
              
              <TransactionLimits
                walletAddress={effectiveCurrentUser.walletAddress}
                blockchainId={effectiveCurrentUser.blockchainId}
                transactionLimits={effectiveCurrentUser.transactionLimits}
                isLoading={userLoading && !effectiveCurrentUser.transactionLimits}
                currentPlanName={effectiveCurrentUser.Plan?.name || 'Free'}  
              />
            </div>

            {/* Limited access notice */}
            {!canViewOtherUsers && isCurrentUserCrossChain && (
              <div className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Lock className="w-6 h-6 text-gray-400 mr-3" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-700">Limited Access</h3>
                      <p className="text-gray-600 mt-1">
                        Your {effectiveCurrentUser.Plan?.name} plan allows viewing your own wallet only
                        {isCurrentUserCrossChain && ' (inherited from primary account)'}
                      </p>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-700">{effectiveCurrentUser.Plan?.name}</div>
                </div>
              </div>
            )}

            {/* Upgrade plans for users who haven't exceeded limits */}
            {!shouldShowUpgradeMessage && (effectiveCurrentUser.Plan?.name === 'Free' || !effectiveCurrentUser.subscriptionActive) && !isCurrentUserCrossChain && (
              <div className="mb-8">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-blue-800 mb-2">
                      {effectiveCurrentUser.Plan?.name === 'Free' ? 'Unlock Premium Features' : 'Reactivate Your Subscription'}
                    </h3>
                    <p className="text-blue-700 mb-4">
                      {effectiveCurrentUser.Plan?.name === 'Free' 
                        ? 'Upgrade to get more queries, higher transaction limits, and advanced features.'
                        : 'Renew your subscription to continue enjoying premium features.'}
                    </p>
                  </div>
                </div>
                
                <UpgradePlans
                  currentUser={effectiveCurrentUser}
                  trialEndDate={effectiveCurrentUser.subscriptionEndDate || ''}
                  currentPlanExpiry={effectiveCurrentUser.subscriptionEndDate || ''}
                  onApprove={handlePaymentSuccess}
                  onError={(error) => console.error('Payment error:', error)}
                  onCancel={() => console.log('Payment cancelled')}
                />
              </div>
            )}

            {/* Users table */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search wallets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center space-x-6 text-sm text-gray-600">
                  <span>Total: <strong>{effectiveUsers.length}</strong></span>
                  <span>Filtered: <strong>{filteredUsers.length}</strong></span>
                  <span>Plan: <strong>
                    {effectiveCurrentUser.Plan?.name} ({planConfig.maxWallets} wallet limit)
                    {isCurrentUserCrossChain && ' - Inherited'}
                  </strong></span>
                  {isFreeUserExceededLimits && (
                    <span className="text-red-600 font-semibold">
                      ⚠️ Limits Exceeded
                    </span>
                  )}
                  {effectiveCurrentUser === cachedUser && effectiveCurrentUser !== currentUser && (
                    <span className="text-blue-600 font-semibold">
                      📋 Cached Data
                    </span>
                  )}
                </div>
              </div>

              {/* Table content */}
              <div className="overflow-x-auto">
                {usersLoading && !effectiveUsers.length ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin inline" />
                    Loading wallet data...
                  </div>
                ) : filteredUsers.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blockchain</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-indigo-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 font-mono">
                                  {formatWalletAddress(user.walletAddress)}
                                </div>
                                <div className="text-sm text-gray-500 font-mono flex items-center">
                                  ID: {user.id.slice(0, 8)}...
                                  {user.isPrimary ? (
                                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Primary</span>
                                  ) : (
                                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Sub-Wallet</span>
                                  )}
                                  {user.isCurrentUser && (
                                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Current</span>
                                  )}
                                  {user.source === 'crosschain' && (
                                    <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Cross-Chain</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium">{user.blockchainName || user.bns || 'N/A'}</div>
                              <div className="text-xs text-gray-500 font-mono">
                                {user.blockchainId?.slice(0, 12)}...
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className={`font-bold text-lg ${getCreditScoreColor(user.creditScore || 0)}`}>
                                {user.creditScore || 0}
                              </div>
                              <div className="text-xs text-gray-500">
                                {getCreditScoreLabel(user.creditScore || 0)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col space-y-1">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {user.Plan?.name || 'Free'}
                              </span>
                              {user.planSource === 'inherited' && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                                  Inherited
                                </span>
                              )}
                              {isFreeUserExceededLimits && user.isCurrentUser && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                  Limit Exceeded
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{formatDate(user.createdAt)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12">
                    <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-500">No wallet data found</p>
                    <p className="text-sm text-gray-400 mt-2">Your wallet data will appear here when available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Call-to-action for Free Users */}
            {isFreeUserExceededLimits && !isCurrentUserCrossChain && (
              <div className="mt-8 p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-center">
                <h3 className="text-2xl font-bold mb-3">Ready to Upgrade?</h3>
                <p className="text-lg mb-4">
                  Join thousands of users who've upgraded to unlock unlimited potential!
                </p>
                <div className="flex justify-center space-x-4 text-sm">
                  <span>✅ Unlimited Queries</span>
                  <span>✅ Higher Transaction Limits</span>
                  <span>✅ Priority Support</span>
                  <span>✅ Advanced Features</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Fallback for no user data */}
        {appState.walletConnected && !effectiveCurrentUser && !isLoading && !hasError && !appState.isRateLimited && (
          <div className="mb-8 p-12 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-yellow-800 mb-3">No User Data Found</h2>
            <p className="text-yellow-700 text-lg mb-4">
              Your wallet is connected but we couldn't find any user data.
            </p>
            <p className="text-yellow-600 mb-6">
              This might be a new wallet. Please try refreshing the page or contact support if the issue persists.
            </p>
            <button
              onClick={handleManualRefresh}
              disabled={refreshMutation.isPending}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium disabled:opacity-50"
            >
              {refreshMutation.isPending ? '🔄 Refreshing...' : '🔄 Refresh Data'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UsersPage;
