// src/pages/Dashboard.tsx - Fixed Trial Banner and Navigation
import React, { useState, useEffect, useCallback } from 'react';
import CreditScoreViewer from '../components/CreditScoreViewer';
import ProfileCard from '../components/ProfileCard';
import { BarChart3, Users, FileText, Network, Wallet, AlertTriangle, Lock, Crown, Clock, Calendar } from 'lucide-react';
import { BASE_API_URL } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';
import { getPlanConfig } from '../utils/planConfig';
import { useNavigate } from 'react-router-dom';
import { isTrialActive, getTrialDaysRemaining } from '../utils/isTrialActive';

interface UserStats {
  totalUsers: number;
  totalInvoices: number;
  totalBlockchains: number;
  averageCreditScore: number;
  crossChainWallets?: number;
  queryUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
  planInfo: {
    name: string;
    type?: string;
    features: string[];
  };
}

interface UserInfo {
  id: string;
  name?: string;
  email?: string;
  walletAddress: string;
  blockchainId: string;
  creditScore: number;
  ubid?: string;
  Plan?: { name?: string };
  trialStartDate?: string;
  trialUsed?: boolean;
  subscriptionEndDate?: string;
  createdAt: string;
  queriesUsed?: number;
  queriesLimit?: number;
  trialDaysUsed?: number;
  trialDaysLeft?: number;
  [key: string]: any;
}

interface Activity {
  id: string;
  type: string;
  description?: string;
  details?: string;
  timestamp: string;
  userId?: string;
}

interface RateLimitState {
  isRateLimited: boolean;
  retryAfter?: number;
}

interface TrialInfo {
  isTrialExpired: boolean;
  isTrialActive: boolean;
  daysUsed: number;
  daysRemaining: number;
  totalTrialDays: number;
  isWarning: boolean;
  isBlocked: boolean;
  trialStartDate?: string;
}

const TRIAL_DAYS = 5;

const Dashboard = () => {
  const { isLoggedIn, walletAddress, blockchainId, login } = useAuth();
  const navigate = useNavigate();
  
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    totalInvoices: 0,
    totalBlockchains: 0,
    averageCreditScore: 0,
    crossChainWallets: 0,
    queryUsage: {
      used: 0,
      limit: 0,
      remaining: 0,
    },
    planInfo: {
      name: 'Free',
      type: 'FREE',
      features: [],
    },
  });

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
  });
  const [trialInfo, setTrialInfo] = useState<TrialInfo>({
    isTrialExpired: false,
    isTrialActive: false,
    daysUsed: 0,
    daysRemaining: TRIAL_DAYS,
    totalTrialDays: TRIAL_DAYS,
    isWarning: false,
    isBlocked: false,
    trialStartDate: undefined,
  });

  // Enhanced API call with rate limiting detection
  const apiCall = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        setRateLimitState({
          isRateLimited: true,
          retryAfter: retryAfter ? parseInt(retryAfter) : undefined,
        });
        throw new Error('Rate limit exceeded');
      }
      
      // Clear rate limit state on successful request
      if (rateLimitState.isRateLimited) {
        setRateLimitState({ isRateLimited: false });
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error: any) {
      if (error.message === 'Rate limit exceeded') {
        throw error;
      }
      throw new Error(`Failed to fetch: ${error.message}`);
    }
  }, [rateLimitState.isRateLimited]);

  // Calculate trial information using utility functions
  const calculateTrialInfo = useCallback((user: UserInfo | null): TrialInfo => {
    if (!user) {
      return {
        isTrialExpired: false,
        isTrialActive: false,
        daysUsed: 0,
        daysRemaining: TRIAL_DAYS,
        totalTrialDays: TRIAL_DAYS,
        isWarning: false,
        isBlocked: false,
        trialStartDate: undefined,
      };
    }

    const planName = user.Plan?.name || 'Free';
    const isFreeOrTrialPlan = planName === 'Free' || planName === 'Trial';
    const trialStartDate = user.trialStartDate || null;
    
    // Use utility functions for proper trial calculation - handle undefined/null values
    const isActiveBasedOnDate = trialStartDate ? isTrialActive(trialStartDate) : false;
    const daysRemainingFromUtil = trialStartDate ? getTrialDaysRemaining(trialStartDate) : TRIAL_DAYS;
    const daysUsed = TRIAL_DAYS - daysRemainingFromUtil;
    
    // Calculate if trial has expired
    const isTrialExpired = !isActiveBasedOnDate && 
                          Boolean(trialStartDate) && 
                          isFreeOrTrialPlan && 
                          (user.trialUsed === true || daysRemainingFromUtil <= 0);
    
    // Calculate warning state - NOT USED for banner visibility anymore
    const isWarning = isActiveBasedOnDate && 
                     daysRemainingFromUtil <= 1 && 
                     daysRemainingFromUtil > 0 && 
                     isFreeOrTrialPlan;
    
    // User is blocked if trial expired or if they have no trial and are on Free plan with usage
    const isBlocked = isTrialExpired || 
                     (!isActiveBasedOnDate && 
                      !trialStartDate && 
                      isFreeOrTrialPlan && 
                      (user.trialUsed === true));

    const result: TrialInfo = {
      isTrialExpired,
      isTrialActive: isActiveBasedOnDate,
      daysUsed: Math.max(0, daysUsed),
      daysRemaining: Math.max(0, daysRemainingFromUtil),
      totalTrialDays: TRIAL_DAYS,
      isWarning,
      isBlocked,
      trialStartDate: trialStartDate || undefined,
    };

    console.log('Trial Info Debug:', {
      planName,
      isFreeOrTrialPlan,
      trialStartDate,
      isActiveBasedOnDate,
      daysRemainingFromUtil,
      isTrialExpired,
      result
    });

    return result;
  }, []);

  // Check if user has exceeded query limits
  const hasExceededQueryLimits = useCallback((user: UserInfo | null): boolean => {
    if (!user) return false;
    
    const planName = user.Plan?.name || 'Free';
    const planConfig = getPlanConfig(planName);
    const queryLimit = user.queriesLimit ?? planConfig.queryLimit;
    const queryUsed = user.queriesUsed ?? 0;
    
    return queryUsed >= queryLimit;
  }, []);

  // Check if user is blocked (trial expired or query limit exceeded)
  const isUserBlocked = useCallback((user: UserInfo | null): boolean => {
    if (!user) return false;
    
    const trialBlocked = calculateTrialInfo(user).isBlocked;
    const queryBlocked = hasExceededQueryLimits(user);
    
    return trialBlocked || queryBlocked;
  }, [calculateTrialInfo, hasExceededQueryLimits]);

  // Handle navigation to plans page
  const handleUpgradeClick = useCallback(() => {
    console.log('Navigating to plans page...');
    navigate('/plans');
  }, [navigate]);

  // Reset data when authentication state changes
  useEffect(() => {
    if (!isLoggedIn) {
      setUserStats({
        totalUsers: 0,
        totalInvoices: 0,
        totalBlockchains: 0,
        averageCreditScore: 0,
        crossChainWallets: 0,
        queryUsage: {
          used: 0,
          limit: 0,
          remaining: 0,
        },
        planInfo: {
          name: 'Free',
          type: 'FREE',
          features: [],
        },
      });
      setUserInfo(null);
      setRecentActivity([]);
      setActivityError(null);
      setError(null);
      setLoading(false);
      setInitialLoading(false);
      setRateLimitState({ isRateLimited: false });
      setTrialInfo({
        isTrialExpired: false,
        isTrialActive: false,
        daysUsed: 0,
        daysRemaining: TRIAL_DAYS,
        totalTrialDays: TRIAL_DAYS,
        isWarning: false,
        isBlocked: false,
        trialStartDate: undefined,
      });
    }
  }, [isLoggedIn]);

  // Fetch data when user is logged in
  useEffect(() => {
    if (!isLoggedIn || !walletAddress || !blockchainId) {
      setInitialLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, fetch user info to check limits
        const userInfoData = await apiCall(`${BASE_API_URL}/user/wallet/${walletAddress}/${blockchainId}`);
        
        if (!userInfoData.success) {
          if (userInfoData.message?.includes('not found')) {
            setError('User not registered. Please register your wallet first.');
            return;
          }
          throw new Error('Failed to fetch user information');
        }

        // Use actual API data instead of mock data
        const userWithUbid = { 
          ...userInfoData.data,
          // Only use mock data if not available from API
          trialStartDate: userInfoData.data.trialStartDate || userInfoData.data.createdAt,
          trialUsed: userInfoData.data.trialUsed ?? false,
          queriesUsed: userInfoData.data.queriesUsed ?? 0,
          queriesLimit: userInfoData.data.queriesLimit ?? 1000,
        };
        
        setUserInfo(userWithUbid);

        // Calculate trial information using utility functions
        const currentTrialInfo = calculateTrialInfo(userWithUbid);
        setTrialInfo(currentTrialInfo);

        // Check if user is blocked
        const userBlocked = isUserBlocked(userWithUbid);
        const queryExceeded = hasExceededQueryLimits(userWithUbid);
        
        console.log('User status:', {
          userBlocked,
          queryExceeded,
          trialExpired: currentTrialInfo.isTrialExpired,
          trialActive: currentTrialInfo.isTrialActive,
          daysUsed: currentTrialInfo.daysUsed,
          daysRemaining: currentTrialInfo.daysRemaining
        });

        if (userBlocked) {
          // If completely blocked, set basic stats and avoid additional API calls
          setUserStats({
            totalUsers: 1,
            totalInvoices: 0,
            totalBlockchains: 1,
            averageCreditScore: userWithUbid.creditScore || 0,
            crossChainWallets: 0,
            queryUsage: {
              used: userWithUbid.queriesUsed || 0,
              limit: userWithUbid.queriesLimit || getPlanConfig(userWithUbid.Plan?.name || 'Free').queryLimit,
              remaining: 0,
            },
            planInfo: {
              name: userWithUbid.Plan?.name || 'Free',
              type: 'FREE',
              features: [],
            },
          });
          
          setRecentActivity([]);
          if (currentTrialInfo.isTrialExpired) {
            setActivityError('Trial period expired. Upgrade your plan to access features.');
          } else if (queryExceeded) {
            setActivityError('Query limit exceeded. Upgrade your plan to access more features.');
          }
          return;
        }

        // Only make additional API calls if user isn't blocked
        try {
          // Fetch user-specific stats
          const userStatsResponse = await apiCall(`${BASE_API_URL}/dashboard/user-stats/${walletAddress}/${blockchainId}`);
          if (userStatsResponse.success) {
            setUserStats({
              totalUsers: 1,
              totalInvoices: userStatsResponse.data.totalInvoices || 0,
              totalBlockchains: 1,
              averageCreditScore: userStatsResponse.data.creditScore || 0,
              crossChainWallets: userStatsResponse.data.crossChainWallets || 0,
              queryUsage: {
                used: userStatsResponse.data.queryUsage?.used || 0,
                limit: userStatsResponse.data.queryUsage?.limit || 0,
                remaining: userStatsResponse.data.queryUsage?.remaining || 0,
              },
              planInfo: {
                name: userStatsResponse.data.planInfo?.name || 'Free',
                type: userStatsResponse.data.planInfo?.type || 'FREE',
                features: userStatsResponse.data.planInfo?.features || [],
              },
            });
          }
        } catch (statsError: any) {
          console.warn('Failed to fetch user stats:', statsError.message);
          // Set basic stats if API call fails
          setUserStats({
            totalUsers: 1,
            totalInvoices: 0,
            totalBlockchains: 1,
            averageCreditScore: userWithUbid.creditScore || 0,
            crossChainWallets: 0,
            queryUsage: {
              used: userWithUbid.queriesUsed || 0,
              limit: userWithUbid.queriesLimit || getPlanConfig(userWithUbid.Plan?.name || 'Free').queryLimit,
              remaining: Math.max(0, (userWithUbid.queriesLimit || getPlanConfig(userWithUbid.Plan?.name || 'Free').queryLimit) - (userWithUbid.queriesUsed || 0)),
            },
            planInfo: {
              name: userWithUbid.Plan?.name || 'Free',
              type: 'FREE',
              features: [],
            },
          });
        }

        // Fetch user-specific activity
        try {
          const activityResponse = await apiCall(`${BASE_API_URL}/dashboard/user-activity/${walletAddress}/${blockchainId}`);
          if (activityResponse.success && Array.isArray(activityResponse.data)) {
            setRecentActivity(activityResponse.data);
            setActivityError(null);
          } else {
            setRecentActivity([]);
            setActivityError('No recent activity found.');
          }
        } catch (activityError: any) {
          console.warn('Failed to fetch activity:', activityError.message);
          setRecentActivity([]);
          if (activityError.message === 'Rate limit exceeded') {
            setActivityError('Query limit reached. Recent activity unavailable.');
          } else {
            setActivityError('Unable to fetch recent activity.');
          }
        }

      } catch (error: any) {
        console.error('Failed to fetch user data:', error);
        
        if (error.message === 'Rate limit exceeded') {
          setError('Query limit exceeded. Please upgrade your plan or wait for limit reset.');
        } else if (error.message.includes('404')) {
          setError('User not registered. Please register your wallet first.');
        } else {
          setError(error.message || 'Failed to load dashboard data');
        }
        
        setRecentActivity([]);
        setActivityError('Failed to load activity data.');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };

    fetchUserData();
  }, [isLoggedIn, walletAddress, blockchainId, apiCall, hasExceededQueryLimits, calculateTrialInfo, isUserBlocked]);

  const cards = [
    { 
      title: 'Total Users and Crosschains', 
      value: userStats.totalUsers + (userStats.crossChainWallets || 0), 
      icon: Users, 
      color: 'bg-blue-500',
      subtitle: `${userStats.totalUsers} users + ${userStats.crossChainWallets || 0} crosschain`
    },
    { 
      title: 'Total Invoices', 
      value: userStats.totalInvoices, 
      icon: FileText, 
      color: 'bg-green-500'
    },
    { 
      title: 'Connected Blockchains', 
      value: userStats.totalBlockchains, 
      icon: Network, 
      color: 'bg-purple-500'
    },
    { 
      title: 'Average Credit Score', 
      value: userStats.averageCreditScore, 
      icon: BarChart3, 
      color: 'bg-yellow-500',
      suffix: '/1000'
    },
  ];

  const formatTimeAgo = (timestamp: string) => {
    if (!timestamp) return '';
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Check if user has exceeded limits for UI display
  const userExceededLimits = hasExceededQueryLimits(userInfo);
  const userBlocked = isUserBlocked(userInfo);

  // FIXED: Trial Status Banner - Only show when trial is EXPIRED
  const TrialStatusBanner = () => {
    // Only show banner when trial is expired, NOT when active
    if (!trialInfo.isTrialExpired) return null;

    return (
      <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-red-800">
                🚨 Trial Period Expired
              </h3>
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-800">
                  {trialInfo.daysUsed}/{trialInfo.totalTrialDays} days used
                </span>
              </div>
            </div>
            
            <p className="text-red-800 mb-4 text-lg">
              Your {trialInfo.totalTrialDays}-day trial has ended. Upgrade to continue accessing premium features and dashboard analytics.
            </p>

            {/* Trial Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-red-800">Trial Progress</span>
                <span className="text-red-800">
                  {Math.round((trialInfo.daysUsed / trialInfo.totalTrialDays) * 100)}%
                </span>
              </div>
              <div className="w-full bg-white rounded-full h-3 shadow-inner">
                <div 
                  className="h-3 rounded-full bg-red-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (trialInfo.daysUsed / trialInfo.totalTrialDays) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleUpgradeClick}
                className="flex items-center px-6 py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                <Crown className="w-5 h-5 mr-2" />
                Upgrade Plan Now
              </button>
              <button
                onClick={() => navigate('/user-registry')}
                className="px-6 py-3 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View Account Details
              </button>
            </div>

            <div className="mt-4 p-4 bg-white rounded-lg border border-red-200">
              <h4 className="font-semibold text-red-800 mb-2">🔒 Limited Access Mode</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Dashboard analytics are restricted</li>
                <li>• API calls are limited</li>
                <li>• Some features are unavailable</li>
                <li>• Upgrade to restore full access</li>
              </ul>
            </div>

            {/* Trial Start Date Info */}
            {trialInfo.trialStartDate && (
              <div className="mt-3 text-xs opacity-75">
                <span className="text-red-800">
                  Trial started: {new Date(trialInfo.trialStartDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Show skeleton loading during initial load
  if (initialLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
        </div>
        
        <div className="mb-6">
          <div className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-12 bg-gray-200 rounded animate-pulse mb-4"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
              <h2 className="text-lg font-semibold text-red-800">Dashboard Error</h2>
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            {error.includes('not registered') && (
              <button
                onClick={() => navigate('/user-registry')}
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Register Wallet
              </button>
            )}
            {error.includes('Query limit exceeded') && (
              <div className="mt-4">
                <p className="text-red-600 text-sm mb-3">
                  You've reached your query limit. Upgrade your plan to continue using the dashboard.
                </p>
                <button
                  onClick={handleUpgradeClick}
                  className="inline-block bg-orange-600 text-white px-6 py-2 rounded hover:bg-orange-700 transition-colors"
                >
                  Upgrade Plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500">Connect your wallet to view your personalized dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {cards.map(({ title, icon: Icon, color }) => (
            <div key={title} className="bg-white rounded-xl shadow-sm p-6 opacity-50">
              <div className="flex items-center justify-between mb-4">
                <div className={`${color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
              <p className="text-3xl font-bold text-gray-400 mt-1">0</p>
              <p className="text-xs text-gray-400 mt-1">Connect wallet to view data</p>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
            <Wallet className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Please connect your MetaMask wallet to view your personalized dashboard with real data.
            </p>
            <button
              onClick={login}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Connect MetaMask Wallet
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No activity available</p>
            <p className="text-sm text-gray-400 mt-1">
              Connect your wallet to see your activity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Logged in user dashboard with ProfileCard
  return (
    <div className="p-8">
      {/* Dashboard Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Personal Dashboard</h1>
        <p className="text-gray-600">Monitor your blockchain credit and activity</p>
      </div>

      {/* FIXED: Trial Status Banner - Only shows when trial is EXPIRED */}
      <TrialStatusBanner />

      {/* Query Limit Warning */}
      {userExceededLimits && !trialInfo.isTrialExpired && (
        <div className="mb-8 p-6 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-orange-600 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-orange-800">Query Limit Reached</h3>
              <p className="text-orange-700 mt-1">
                You've used {userInfo?.queriesUsed || 0} of {userInfo?.queriesLimit || 0} queries. 
                Some features may be limited until you upgrade your plan or your limit resets.
              </p>
              <div className="mt-3">
                <button
                  onClick={handleUpgradeClick}
                  className="inline-block bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors text-sm font-medium"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Limit Warning */}
      {rateLimitState.isRateLimited && (
        <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <Lock className="w-6 h-6 text-red-600 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-800">Service Temporarily Limited</h3>
              <p className="text-red-700 mt-1">
                You've exceeded the API rate limits. Dashboard features are temporarily restricted.
                {rateLimitState.retryAfter && ` Please wait ${rateLimitState.retryAfter} seconds before trying again.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Section */}
      <div className="mb-8">
        <ProfileCard 
          userInfo={userInfo}
          walletAddress={walletAddress || ''}
          blockchainId={blockchainId || ''}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map(({ title, value, icon: Icon, color, suffix, subtitle }) => (
          <div key={title} className={`bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow ${userBlocked ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${color} p-3 rounded-lg shadow-sm ${userBlocked ? 'opacity-75' : ''}`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              {userBlocked && (
                <Lock className="w-4 h-4 text-red-500" />
              )}
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {(value ?? 0).toLocaleString()}{suffix || ''}
            </p>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
            {userBlocked && (
              <p className="text-xs text-red-600 mt-1">
                {trialInfo.isTrialExpired ? 'Trial expired' : 'Limited access'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Credit Score Section */}
      <div className="mb-8">
        <CreditScoreViewer />
      </div>

      {/* Activity Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Your Recent Activity</h2>
          {userBlocked && (
            <div className="flex items-center text-red-600">
              <Lock className="w-4 h-4 mr-1" />
              <span className="text-sm">
                {trialInfo.isTrialExpired ? 'Trial Expired' : 'Limited'}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Loading activity...</span>
            </div>
          ) : activityError ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{activityError}</p>
              {userBlocked && (
                <div className="mt-4">
                  <p className="text-sm text-red-600 mb-3">
                    {trialInfo.isTrialExpired 
                      ? 'Your trial has expired. Upgrade to access full activity history.'
                      : 'Upgrade your plan to access full activity history.'
                    }
                  </p>
                  <button
                    onClick={handleUpgradeClick}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    Upgrade Plan
                  </button>
                </div>
              )}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">No recent activity found.</p>
              <p className="text-sm text-gray-400">
                Start using the platform to see your activity here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => {
                const Icon =
                  activity.type === 'user' || activity.type === 'registration'
                    ? Users
                    : activity.type === 'invoice'
                    ? FileText
                    : activity.type === 'blockchain' || activity.type === 'connection'
                    ? Network
                    : activity.type === 'credit'
                    ? BarChart3
                    : Users;

                return (
                  <div key={activity.id || index} className="flex items-center justify-between py-4 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description || 'Activity'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {activity.details || ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 font-medium">
                      {activity.timestamp ? formatTimeAgo(activity.timestamp) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
