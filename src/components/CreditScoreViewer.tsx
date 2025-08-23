import React, { useEffect, useState, useRef } from 'react';
import { ethers } from 'ethers';
import { BASE_API_URL } from '../utils/constants';

interface QueryUsage {
  used: number;
  limit: number;
  remaining?: number;
  trialDaysRemaining?: number;
  trialActive?: boolean;
  period?: {
    month: number;
    year: number;
  };
  plan?: {
    name: string;
    limit: number;
  };
}

interface CreditScoreData {
  creditScore: number;
  source: 'primary' | 'crosschain';
  userId: string;
  crossChainIdentityId?: string;
  walletAddress: string;
  blockchainId: string;
}

const CreditScoreViewer = () => {
  const [creditScoreData, setCreditScoreData] = useState<CreditScoreData | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [blockchainId, setBlockchainId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [queryUsage, setQueryUsage] = useState<QueryUsage | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const isFetchingRef = useRef(false);

  const fetchScore = async () => {
    // ✅ Check cache first
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION && creditScoreData !== null) {
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      setErrorCode(null);

      if (!window.ethereum) {
        setError("Please install MetaMask!");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);
      if (accounts.length === 0) {
        await provider.send("eth_requestAccounts", []);
      }

      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      setWallet(userAddress);

      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      setBlockchainId(chainId);

      // Store wallet info in localStorage for consistency
      window.localStorage.setItem('walletAddress', userAddress);
      window.localStorage.setItem('blockchainId', chainId);

      // ✅ FIXED: Use the correct wallet-based credit score endpoint
      const creditResponse = await fetch(`${BASE_API_URL}/credit-score/wallet/${userAddress}/${chainId}`);

      if (!creditResponse.ok) {
        let errorData;
        try {
          errorData = await creditResponse.json();
        } catch (parseError) {
          errorData = { error: `HTTP ${creditResponse.status}: ${creditResponse.statusText}` };
        }
        
        if (creditResponse.status === 404) {
          setCreditScoreData(null);
          setError("Wallet not registered. Please register first to get a credit score.");
          setErrorCode('WALLET_NOT_REGISTERED');
          return;
        }
        
        if (creditResponse.status === 403) {
          setCreditScoreData(null);
          if (errorData.code === "TRIAL_EXPIRED") {
            setError("Your free trial has expired. Please upgrade your plan to continue accessing your credit score.");
            setErrorCode("TRIAL_EXPIRED");
          } else if (errorData.code === "QUERY_LIMIT_EXCEEDED") {
            setError("You've reached your monthly query limit. Please upgrade your plan.");
            setErrorCode("QUERY_LIMIT_EXCEEDED");
          } else {
            setError(errorData.error || "Access denied");
          }
          return;
        }
        
        if (creditResponse.status === 429) {
          setCreditScoreData(null);
          if (errorData.code === "TRIAL_LIMIT_EXCEEDED" || errorData.code === "QUERY_LIMIT_EXCEEDED") {
            setError("You've reached your query limit (100/100). Please upgrade your plan to continue.");
            setErrorCode("QUERY_LIMIT_EXCEEDED");
          } else {
            setError("Too many requests. Please try again later.");
          }
          return;
        }

        throw new Error(`Failed to fetch credit score: ${creditResponse.status} - ${errorData.error || creditResponse.statusText}`);
      }

      // Only read JSON if response is ok
      const creditData = await creditResponse.json();

      if (creditData.success && creditData.creditScore !== undefined) {
        setCreditScoreData({
          creditScore: creditData.creditScore,
          source: creditData.source, // 'primary' or 'crosschain'
          userId: creditData.userId,
          crossChainIdentityId: creditData.crossChainIdentityId,
          walletAddress: creditData.walletAddress,
          blockchainId: creditData.blockchainId
        });
      } else {
        setCreditScoreData(null);
        setError("Invalid credit score data received");
      }

      // Fetch query usage data (if user is registered)
      if (creditData.success) {
        try {
          const usageResponse = await fetch(`${BASE_API_URL}/query/usage/${userAddress}/${chainId}`);

          if (usageResponse.ok) {
            const usageData = await usageResponse.json();
            
            if (usageData.success && usageData.data) {
              setQueryUsage({
                used: usageData.data.queriesUsed || 0,        
                limit: usageData.data.queriesLimit || 0,      
                remaining: usageData.data.queriesRemaining || 0,
                trialDaysRemaining: usageData.data.trialDaysRemaining,
                trialActive: usageData.data.trialActive,
                period: usageData.data.period,
                plan: {
                  name: usageData.data.plan || 'Free',        
                  limit: usageData.data.queriesLimit || 0
                }
              });
            }
          }
        } catch (usageError) {
          // Silent fail for usage data
        }
      }

      // ✅ Update cache timestamp after successful fetch
      setLastFetchTime(now);

    } catch (err: any) {
      setCreditScoreData(null);
      setError(err.message || "Failed to load credit score");
      setQueryUsage(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // ✅ Add manual refresh function that bypasses cache
  const refreshScore = async () => {
    setLastFetchTime(0); // Reset cache
    await fetchScore();
  };

  useEffect(() => {
    fetchScore();
  }, []);

  const getUsagePercentage = () => {
    if (!queryUsage || queryUsage.limit === 0) return 0;
    return Math.round((queryUsage.used / queryUsage.limit) * 100);
  };

  // ✅ Helper function to get wallet type display
  const getWalletTypeDisplay = () => {
    if (!creditScoreData) return '';
    return creditScoreData.source === 'primary' ? '🏛️ Primary Wallet' : '🔗 Cross-Chain Wallet';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Web3 Credit Score</h2>
        
        {/* ✅ Cache Status & Refresh Button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={refreshScore}
            className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
            disabled={loading}
            title="Refresh data (will consume a query)"
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      {/* ✅ REMOVED: Wallet and Chain ID display - already shown in ProfileCard */}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading credit score...</span>
        </div>
      ) : error ? (
        <div className="space-y-4">
          {/* Main Error Message */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-amber-800 font-medium">{error}</p>
                {errorCode === 'WALLET_NOT_REGISTERED' && (
                  <p className="text-sm text-amber-700 mt-1">
                    This wallet is not registered in the system. Please register it first to get your credit score.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Registration Required Section */}
          {errorCode === 'WALLET_NOT_REGISTERED' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-lg">📝</span>
                <h3 className="text-blue-800 font-semibold">Registration Required</h3>
              </div>
              <p className="text-blue-700 text-sm mb-4">
                Register your wallet to start building your Web3 credit score.
              </p>
              <button
                onClick={() => window.location.href = '/user-registry'}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Register Wallet
              </button>
            </div>
          )}

          {/* Failed to Fetch Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-lg">❌</span>
              <h3 className="text-slate-800 font-semibold">Failed to fetch credit score</h3>
            </div>
            <p className="text-slate-700 text-sm mb-4">
              Note: This will consume a query from your limit
            </p>
            <button
              onClick={refreshScore}
              className="w-full py-2 px-4 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 font-medium"
              disabled={loading}
            >
              {loading ? 'Retrying...' : 'Retry'}
            </button>
          </div>

          {/* Trial/Limit Exceeded Sections */}
          {(errorCode === "TRIAL_EXPIRED" || errorCode === "QUERY_LIMIT_EXCEEDED") && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-lg">🚫</span>
                <h3 className="text-orange-800 font-semibold">
                  {errorCode === "TRIAL_EXPIRED" ? "Trial Expired" : "Query Limit Exceeded"}
                </h3>
              </div>
              <p className="text-orange-700 text-sm mb-4">
                {errorCode === "TRIAL_EXPIRED" 
                  ? "Your free trial has ended. Upgrade to a paid plan to continue accessing credit score features."
                  : "You've reached your monthly limit. Upgrade your plan to continue accessing your credit score."}
              </p>
              <button
                onClick={() => window.location.href = '/users'}
                className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Upgrade Plan
              </button>
            </div>
          )}
        </div>
      ) : creditScoreData ? (
        <div className="space-y-6">
          {/* Main Credit Score Display */}
          <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-800 font-semibold text-lg mb-2">
                  Your Credit Score
                </p>
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-emerald-900">{creditScoreData.creditScore}</span>
                  <span className="text-lg text-emerald-600 ml-2">/ 1000</span>
                </div>
                
                {/* Wallet Type Display */}
                <div className="mt-3 flex items-center">
                  <span className="text-sm text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                    {getWalletTypeDisplay()}
                  </span>
                </div>
              </div>
            </div>
            
            {/* ✅ CrossChain info */}
            {creditScoreData.source === 'crosschain' && creditScoreData.crossChainIdentityId && (
              <div className="mt-4 pt-4 border-t border-emerald-200">
                <p className="text-xs text-emerald-700">
                  <strong>CrossChain Identity ID:</strong> {creditScoreData.crossChainIdentityId.slice(0, 8)}...
                </p>
              </div>
            )}
          </div>

          {/* Credit Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-700">
                {creditScoreData.creditScore >= 800 ? 'Excellent' :
                 creditScoreData.creditScore >= 700 ? 'Good' :
                 creditScoreData.creditScore >= 600 ? 'Fair' : 'Poor'}
              </div>
              <p className="text-sm text-gray-600 mt-1">Credit Rating</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-700">
                {Math.round((creditScoreData.creditScore / 1000) * 100)}%
              </div>
              <p className="text-sm text-gray-600 mt-1">Score Percentage</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-700">
                {creditScoreData.source === 'primary' ? 'Primary' : 'Cross-Chain'}
              </div>
              <p className="text-sm text-gray-600 mt-1">Account Type</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-gray-600">No credit score available</p>
        </div>
      )}

      {/* ✅ Show query usage for registered users */}
      {queryUsage && (
        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <p className="text-indigo-800 text-sm font-semibold">API Query Usage</p>
            <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
              {queryUsage.plan?.name || 'Free'} Plan
            </span>
          </div>
          
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-indigo-700">
              {queryUsage.used} / {queryUsage.limit} queries used
            </span>
            <span className="text-xs text-indigo-600 font-medium">
              ({getUsagePercentage()}%)
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-indigo-100 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(getUsagePercentage(), 100)}%` }}
            ></div>
          </div>
          
          {queryUsage.remaining !== undefined && (
            <p className="text-xs text-indigo-600 mt-2">
              {queryUsage.remaining} queries remaining this month
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CreditScoreViewer;
