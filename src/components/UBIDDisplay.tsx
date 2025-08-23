// frontend/src/components/UBIDDisplay.tsx
import React, { useState } from 'react';
import { Copy, Check, Wallet, Shield, Calendar, Star } from 'lucide-react';

interface UBIDDisplayProps {
  ubid: string;
  showFullUBID?: boolean;
  className?: string;
  copyable?: boolean;
}

export const UBIDDisplay: React.FC<UBIDDisplayProps> = ({
  ubid,
  showFullUBID = false,
  className = "",
  copyable = true
}) => {
  const [copied, setCopied] = useState(false);

  const displayUBID = showFullUBID ? ubid : `${ubid.slice(0, 12)}...${ubid.slice(-4)}`;

  const handleCopy = async () => {
    if (!copyable) return;
    
    try {
      await navigator.clipboard.writeText(ubid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy UBID:', err);
    }
  };

  return (
    <div className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${className}`}>
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Blockchain Identity
        </p>
        <p className="text-sm font-mono text-gray-900 break-all">
          {displayUBID}
        </p>
      </div>
      
      {copyable && (
        <button
          onClick={handleCopy}
          className="ml-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Copy UBID"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
};

// User Profile Card Component
interface UserProfileCardProps {
  userInfo: {
    id: string;
    name?: string;
    walletAddress: string;
    blockchainId: string;
    ubid?: string;
    creditScore: number;
    Plan?: { name?: string };
    trialStartDate?: string;
    createdAt: string;
  };
  loading?: boolean;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userInfo,
  loading = false
}) => {
  const formatWallet = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 800) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 700) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 600) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 500) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const calculateTrialDaysRemaining = () => {
    if (!userInfo.trialStartDate) return 0;
    const trialStart = new Date(userInfo.trialStartDate);
    const now = new Date();
    const diffTime = (5 * 24 * 60 * 60 * 1000) - (now.getTime() - trialStart.getTime());
    return Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24)), 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  const trialDaysRemaining = calculateTrialDaysRemaining();

  return (
    <div className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {userInfo.name ? `Welcome, ${userInfo.name}!` : 'Welcome!'}
              </h3>
              <p className="text-sm text-gray-500">Web3 Identity Profile</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>Since {new Date(userInfo.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* UBID Display */}
        {userInfo.ubid && (
          <div className="mb-6">
            <UBIDDisplay ubid={userInfo.ubid} />
          </div>
        )}

        {/* Wallet & Chain Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Wallet</p>
            <p className="text-sm font-mono text-gray-900 mt-1">{formatWallet(userInfo.walletAddress)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chain</p>
            <p className="text-sm font-mono text-gray-900 mt-1">{userInfo.blockchainId}</p>
          </div>
        </div>

        {/* Credit Score */}
        <div className={`p-4 rounded-lg border ${getScoreColor(userInfo.creditScore)} mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5" />
              <div>
                <p className="text-xs font-medium opacity-75">Credit Score</p>
                <p className="text-2xl font-bold">{userInfo.creditScore}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">out of</p>
              <p className="text-lg font-semibold">1000</p>
            </div>
          </div>
        </div>

        {/* Plan Info */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {userInfo.Plan?.name || 'Free'} Plan
              </p>
              {userInfo.Plan?.name === 'Free' && trialDaysRemaining > 0 && (
                <p className="text-xs text-blue-700">
                  Trial expires in {trialDaysRemaining} days
                </p>
              )}
            </div>
          </div>
          {userInfo.Plan?.name === 'Free' && trialDaysRemaining <= 3 && trialDaysRemaining > 0 && (
            <button className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Upgrade
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UBIDDisplay;
