import React, { useState } from 'react';
import { User, Wallet, Hash, Copy, Check, Shield, Calendar, Mail } from 'lucide-react';

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
  [key: string]: any;
}

interface ProfileCardProps {
  userInfo: UserInfo | null;
  walletAddress?: string;
  blockchainId?: string;
  ubid?: string;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ 
  userInfo, 
  walletAddress, 
  blockchainId, 
  ubid 
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatUbidShort = (ubid: string) => {
    if (!ubid) return '';
    return ubid.length > 16 ? `${ubid.slice(0, 16)}...` : ubid;
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const getPlanBadgeColor = (planName?: string) => {
    switch (planName?.toLowerCase()) {
      case 'premium':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'free':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCreditScoreGradient = (score: number) => {
    if (score >= 800) return 'from-emerald-500 to-teal-600';
    if (score >= 700) return 'from-blue-500 to-cyan-600';
    if (score >= 600) return 'from-amber-500 to-orange-500';
    return 'from-slate-500 to-gray-600'; // ✅ Changed from red to slate/gray
  };

  if (!userInfo && !walletAddress) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No profile information available</p>
            <p className="text-gray-400 text-sm mt-2">Connect your wallet to see profile details</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header Section with Gradient Background */}
      <div className={`bg-gradient-to-r ${getCreditScoreGradient(userInfo?.creditScore || 0)} p-6`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-gray-600" />
            </div>
            <div className="ml-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                {userInfo?.name || 'Unnamed User'}
              </h2>
              <div className="flex items-center text-white/80 text-sm mb-2">
                <Mail className="w-4 h-4 mr-2" />
                {userInfo?.email || 'No email provided'}
              </div>
              <div className="flex items-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30`}>
                  <Shield className="w-3 h-3 mr-1" />
                  {userInfo?.Plan?.name || 'Free'} Plan
                </span>
              </div>
            </div>
          </div>
          
          {/* Credit Score Display */}
          <div className="text-right text-white">
            <p className="text-sm text-white/80 mb-1">Credit Score</p>
            <p className="text-3xl font-bold">
              {userInfo?.creditScore || 0}
              <span className="text-lg text-white/80 font-normal">/1000</span>
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-6">
        {/* UBID Display - Prominent */}
        {ubid && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Hash className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-semibold text-blue-800 mb-1">Universal Blockchain ID</p>
                  <p className="text-lg font-mono text-blue-900 font-medium">
                    {formatUbidShort(ubid)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(ubid, 'ubid')}
                className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                {copiedField === 'ubid' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy UBID
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Wallet Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800">Wallet Address</p>
                  <p className="text-sm font-mono text-gray-600">
                    {formatWalletAddress(walletAddress || userInfo?.walletAddress || '')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(walletAddress || userInfo?.walletAddress || '', 'wallet')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {copiedField === 'wallet' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Hash className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800">Blockchain ID</p>
                  <p className="text-sm font-mono text-gray-600">
                    {blockchainId || userInfo?.blockchainId || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(blockchainId || userInfo?.blockchainId || '', 'blockchain')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {copiedField === 'blockchain' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Member since</p>
                <p className="text-sm font-medium text-gray-900">
                  {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Unknown'}
                </p>
              </div>
            </div>
            
            {userInfo?.Plan?.name === 'Free' && userInfo.trialStartDate && (
              <div className="flex items-center">
                <Shield className="w-5 h-5 text-amber-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Trial expires in</p>
                  <p className="text-sm font-medium text-amber-600">
                    {Math.max(
                      5 - Math.floor((Date.now() - new Date(userInfo.trialStartDate).getTime()) / (1000 * 60 * 60 * 24)),
                      0
                    )} days
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
