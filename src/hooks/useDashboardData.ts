// frontend/src/hooks/useDashboardData.ts
import { useState, useEffect, useCallback } from 'react';
import { BASE_API_URL } from '../utils/constants';

interface UserInfo {
  id: string;
  name?: string;
  email?: string;
  walletAddress: string;
  blockchainId: string;
  ubid?: string;
  creditScore: number;
  Plan?: { name?: string };
  trialStartDate?: string;
  trialUsed?: boolean;
  subscriptionEndDate?: string;
  createdAt: string;
}

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

interface Activity {
  id: string;
  type: string;
  description?: string;
  details?: string;
  timestamp: string;
  userId?: string;
}

export const useDashboardData = (walletAddress: string | null, blockchainId: string | null) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
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
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimized parallel data fetching
  const fetchDashboardData = useCallback(async () => {
    if (!walletAddress || !blockchainId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel for better performance
      const [userInfoResponse, userStatsResponse, activityResponse] = await Promise.all([
        fetch(`${BASE_API_URL}/user/wallet/${walletAddress}/${blockchainId}`),
        fetch(`${BASE_API_URL}/dashboard/user-stats/${walletAddress}/${blockchainId}`),
        fetch(`${BASE_API_URL}/dashboard/user-activity/${walletAddress}/${blockchainId}`)
      ]);

      // Handle user info
      if (!userInfoResponse.ok) {
        if (userInfoResponse.status === 404) {
          throw new Error('User not registered. Please register your wallet first.');
        }
        throw new Error(`Failed to fetch user info: ${userInfoResponse.status}`);
      }

      const userInfoData = await userInfoResponse.json();
      if (userInfoData.success) {
        setUserInfo(userInfoData.data);
      }

      // Handle user stats
      if (userStatsResponse.ok) {
        const statsData = await userStatsResponse.json();
        if (statsData.success) {
          setUserStats({
            totalUsers: 1,
            totalInvoices: statsData.data.totalInvoices || 0,
            totalBlockchains: 1,
            averageCreditScore: statsData.data.creditScore || 0,
            crossChainWallets: statsData.data.crossChainWallets || 0,
            queryUsage: {
              used: statsData.data.queryUsage?.used || 0,
              limit: statsData.data.queryUsage?.limit || 0,
              remaining: statsData.data.queryUsage?.remaining || 0,
            },
            planInfo: {
              name: statsData.data.planInfo?.name || 'Free',
              type: statsData.data.planInfo?.type || 'FREE',
              features: statsData.data.planInfo?.features || [],
            },
          });
        }
      }

      // Handle activity
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        if (activityData.success && Array.isArray(activityData.data)) {
          setRecentActivity(activityData.data);
        } else {
          setRecentActivity([]);
        }
      } else {
        setRecentActivity([]);
      }

    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, blockchainId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const refresh = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    userInfo,
    userStats,
    recentActivity,
    loading,
    error,
    refresh
  };
};
