// src/pages/PlansPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Shield, Crown, ArrowLeft, CheckCircle, AlertTriangle, Clock, Calendar, Wallet } from 'lucide-react';
import PayPalSubscription from '../components/PayPalSubscription';
import { BASE_API_URL } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  walletAddress: string;
  blockchainId: string;
  Plan?: { name: string };
  planSource?: string;
  trialActive?: boolean;
  trialDaysRemaining?: number;
  trialUsed?: boolean;
  queriesUsed?: number;
  queriesLimit?: number;
  trialDaysUsed?: number;
  subscriptionEndDate?: string;
  createdAt?: string;
}

// Plan configuration
const plans = [
  {
    name: 'Basic Plan',
    description: 'Small businesses & individuals',
    price: 149,
    icon: <CreditCard className="w-5 h-5 text-blue-600" />,
    bg: 'bg-blue-100',
    bulletColor: 'bg-blue-500',
    features: [
      '1,000 queries per month',
      'Credit scoring features',
      '$10,000 transaction limit',
      'Single user access',
      'Basic support',
    ],
    containerId: 'paypal-basic-plan',
    planId: 'P-7WV44462TF966624XNB2PKXA', // PayPal plan ID
    prismaPlanId: 'a946852b-0e64-455b-90f4-6091e8f11ade', // Database Plan.id for Basic
    planType: 'Basic',
  },
  {
    name: 'Pro Plan',
    description: 'Medium businesses & DeFi protocols',
    price: 699,
    icon: <Shield className="w-5 h-5 text-indigo-600" />,
    bg: 'bg-indigo-100',
    bulletColor: 'bg-indigo-500',
    features: [
      '15,000 queries per month',
      'Full UBID access',
      'Complete credit scoring & invoicing',
      '$20,000 transaction limit',
      '3 users access',
      'Priority support',
    ],
    containerId: 'paypal-pro-plan',
    planId: 'P-1LC09938TF381221LNB2PLHQ', // PayPal plan ID
    prismaPlanId: 'e203a24f-bfba-471f-a8b8-58d513c42b7f', // Database Plan.id for Pro
    highlight: true,
    planType: 'Pro',
  },
  {
    name: 'Premium Plan',
    description: 'Financial institutions',
    price: 3699,
    icon: <Crown className="w-5 h-5 text-yellow-600" />,
    bg: 'bg-yellow-100',
    bulletColor: 'bg-yellow-500',
    features: [
      '1M queries per month',
      'All platform features',
      'Unlimited transactions',
      'Institutional grade security',
      '5 users access',
      '24/7 dedicated support',
    ],
    containerId: 'paypal-premium-plan',
    planId: 'P-7S343131C3165360FNB2PJ6A', // PayPal plan ID
    prismaPlanId: '76a4c4e2-b2b2-498d-ad18-91adccdcd3b0', // Database Plan.id for Premium
    planType: 'Premium',
  },
];

const TRIAL_DAYS = 5;

const PlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, walletAddress, blockchainId, login } = useAuth();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current user information
  useEffect(() => {
    if (isLoggedIn && walletAddress && blockchainId) {
      fetchUserInfo();
    }
  }, [isLoggedIn, walletAddress, blockchainId]);

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_API_URL}/user/wallet/${walletAddress}/${blockchainId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user information');
      }
      
      const data = await response.json();
      if (data.success) {
        // Add mock trial data for testing
        const userWithTrialData = {
          ...data.data,
          trialDaysUsed: data.data.trialDaysUsed || 0,
          trialDaysRemaining: Math.max(0, TRIAL_DAYS - (data.data.trialDaysUsed || 0)),
          trialActive: data.data.trialActive || false,
          trialUsed: data.data.trialUsed || false,
          queriesUsed: data.data.queriesUsed || 0,
          queriesLimit: data.data.queriesLimit || 1000,
        };
        setCurrentUser(userWithTrialData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate trial information
  const getTrialInfo = () => {
    if (!currentUser) return null;
    
    const planName = currentUser.Plan?.name || 'Free';
    const isFreeOrTrialPlan = planName === 'Free' || planName === 'Trial';
    const daysUsed = currentUser.trialDaysUsed || 0;
    const daysRemaining = Math.max(0, TRIAL_DAYS - daysUsed);
    const isTrialExpired = daysUsed >= TRIAL_DAYS && isFreeOrTrialPlan;
    const isWarning = daysRemaining <= 1 && daysRemaining > 0 && isFreeOrTrialPlan;
    
    return {
      isTrialExpired,
      daysUsed,
      daysRemaining,
      totalTrialDays: TRIAL_DAYS,
      isWarning,
      isActive: currentUser.trialActive || false,
    };
  };

  // Get available plans based on current plan
  const getAvailablePlans = () => {
    if (!currentUser) return plans;
    
    const currentPlanName = currentUser.Plan?.name || 'Free';
    const currentPlanExpiry = currentUser.subscriptionEndDate;
    const planExpired = currentPlanName !== 'Free' && 
                       currentPlanExpiry && 
                       new Date(currentPlanExpiry) < new Date();

    switch (currentPlanName) {
      case 'Free':
        return plans;
      case 'Basic':
        return plans;
      case 'Pro':
        return plans.filter(plan => 
          plan.planType === 'Pro' || 
          plan.planType === 'Premium'
        );
      case 'Premium':
        return planExpired ? 
          plans.filter(plan => plan.planType === 'Premium') : 
          [];
      default:
        return plans;
    }
  };

  // Get page title and description
  const getPageInfo = () => {
    if (!currentUser) {
      return {
        title: 'Choose Your Plan',
        description: 'Select the perfect plan for your blockchain identity needs'
      };
    }

    const currentPlanName = currentUser.Plan?.name || 'Free';
    const currentPlanExpiry = currentUser.subscriptionEndDate;
    const planExpired = currentPlanName !== 'Free' && 
                       currentPlanExpiry && 
                       new Date(currentPlanExpiry) < new Date();
    const trialInfo = getTrialInfo();

    if (planExpired && currentPlanName !== 'Free') {
      return {
        title: `Renew Your ${currentPlanName} Plan`,
        description: `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`
      };
    }

    switch (currentPlanName) {
      case 'Free':
        if (trialInfo?.isActive && trialInfo.daysRemaining > 0) {
          return {
            title: 'Upgrade During Your Trial',
            description: `🎉 Your ${trialInfo.daysRemaining}-day free trial is active! Upgrade anytime to keep all premium features beyond your trial period.`
          };
        } else if (trialInfo?.isTrialExpired) {
          return {
            title: 'Upgrade Your Plan',
            description: 'Your free trial has ended. Upgrade to continue accessing premium features.'
          };
        } else {
          return {
            title: 'Choose Your Plan',
            description: 'Upgrade to unlock premium features and advanced capabilities.'
          };
        }
      case 'Basic':
        return {
          title: planExpired ? `Renew Your ${currentPlanName} Plan` : 'Upgrade to Pro or Premium',
          description: planExpired 
            ? `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`
            : 'Unlock more queries, transaction limits, and team features with Pro or Premium.'
        };
      case 'Pro':
        return {
          title: planExpired ? `Renew Your ${currentPlanName} Plan` : 'Upgrade to Premium',
          description: planExpired 
            ? `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`
            : 'Get unlimited transactions and institutional features with Premium.'
        };
      case 'Premium':
        return {
          title: planExpired ? `Renew Your ${currentPlanName} Plan` : 'Your Premium Plan',
          description: planExpired 
            ? `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`
            : 'You have access to all premium features.'
        };
      default:
        return {
          title: 'Choose Your Plan',
          description: 'Choose the plan that best fits your needs.'
        };
    }
  };

  // Handle subscription events
  const handleApprove = (subscriptionId: string) => {
    setSuccess('🎉 Successfully subscribed! Your plan has been activated.');
    setError(null);
    // Refresh user info
    setTimeout(() => {
      fetchUserInfo();
      // Redirect to dashboard after successful upgrade
      setTimeout(() => navigate('/dashboard'), 2000);
    }, 1000);
  };

  const handleError = (error: string) => {
    setError(`Subscription failed: ${error}`);
    setSuccess(null);
  };

  const handleCancel = () => {
    setError('Subscription cancelled by user.');
    setSuccess(null);
  };

  const pageInfo = getPageInfo();
  const availablePlans = getAvailablePlans();
  const trialInfo = getTrialInfo();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading plans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mr-4"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{pageInfo.title}</h1>
                <p className="text-gray-600 mt-2">{pageInfo.description}</p>
              </div>
            </div>
            {!isLoggedIn && (
              <button
                onClick={login}
                className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Wallet className="w-5 h-5 mr-2" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
              <p className="text-green-800 font-medium">{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Connect wallet prompt for non-logged users */}
        {!isLoggedIn && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-center">
              <Wallet className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Connect Your Wallet</h3>
              <p className="text-blue-700 mb-4">
                Connect your wallet to see personalized plan recommendations and manage your subscription.
              </p>
              <button
                onClick={login}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Connect MetaMask Wallet
              </button>
            </div>
          </div>
        )}

        {/* Trial Status Banner */}
        {isLoggedIn && currentUser && trialInfo && (trialInfo.isTrialExpired || trialInfo.isWarning) && (
          <div className={`mb-8 p-6 rounded-xl shadow-sm ${
            trialInfo.isTrialExpired 
              ? 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-200' 
              : 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {trialInfo.isTrialExpired ? (
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                ) : (
                  <Clock className="w-8 h-8 text-yellow-600" />
                )}
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-xl font-bold ${
                    trialInfo.isTrialExpired ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    {trialInfo.isTrialExpired ? '🚨 Trial Period Expired' : '⚠️ Trial Ending Soon'}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Calendar className={`w-5 h-5 ${
                      trialInfo.isTrialExpired ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                    <span className={`font-semibold ${
                      trialInfo.isTrialExpired ? 'text-red-800' : 'text-yellow-800'
                    }`}>
                      {trialInfo.daysUsed}/{trialInfo.totalTrialDays} days used
                    </span>
                  </div>
                </div>
                
                <p className={`text-lg mb-4 ${
                  trialInfo.isTrialExpired ? 'text-red-800' : 'text-yellow-800'
                }`}>
                  {trialInfo.isTrialExpired 
                    ? `Your ${trialInfo.totalTrialDays}-day trial has ended. Upgrade to continue accessing premium features and dashboard analytics.`
                    : `Your trial expires in ${trialInfo.daysRemaining} day(s). Upgrade now to keep access to all features.`
                  }
                </p>

                {/* Trial Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`font-medium ${
                      trialInfo.isTrialExpired ? 'text-red-800' : 'text-yellow-800'
                    }`}>Trial Progress</span>
                    <span className={trialInfo.isTrialExpired ? 'text-red-800' : 'text-yellow-800'}>
                      {Math.round((trialInfo.daysUsed / trialInfo.totalTrialDays) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-white rounded-full h-3 shadow-inner">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        trialInfo.isTrialExpired ? 'bg-red-500' : 
                        trialInfo.daysRemaining <= 1 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, (trialInfo.daysUsed / trialInfo.totalTrialDays) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan Status */}
        {isLoggedIn && currentUser && (
          <div className="mb-8">
            {currentUser.Plan?.name === 'Free' ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-800 font-medium">Current Plan: Free</p>
                    <p className="text-blue-600 text-sm">
                      {trialInfo?.isActive && trialInfo.daysRemaining > 0
                        ? `Trial active with ${trialInfo.daysRemaining} day(s) remaining`
                        : trialInfo?.isTrialExpired
                        ? 'Trial period has ended'
                        : 'No active trial'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-800 font-semibold">
                      {(currentUser.queriesUsed || 0).toLocaleString()} / {(currentUser.queriesLimit || 0).toLocaleString()}
                    </p>
                    <p className="text-blue-600 text-sm">Queries Used</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-800 font-medium">
                      Current Plan: {currentUser.Plan?.name}
                      {currentUser.planSource && ` (${currentUser.planSource})`}
                    </p>
                    {currentUser.subscriptionEndDate && (
                      <p className="text-green-600 text-sm">
                        {new Date(currentUser.subscriptionEndDate) > new Date() 
                          ? `Active until ${new Date(currentUser.subscriptionEndDate).toLocaleDateString()}`
                          : `Expired on ${new Date(currentUser.subscriptionEndDate).toLocaleDateString()}`
                        }
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-green-800 font-semibold">
                      {(currentUser.queriesUsed || 0).toLocaleString()} / {(currentUser.queriesLimit || 0).toLocaleString()}
                    </p>
                    <p className="text-green-600 text-sm">Queries Used</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plans Grid */}
        {availablePlans.length === 0 ? (
          <div className="text-center py-12">
            <Crown className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              You're on the Premium Plan!
            </h2>
            <p className="text-gray-600 mb-6">
              You have access to all features and capabilities.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {availablePlans.map((plan, idx) => {
              const isCurrentPlan = currentUser && plan.planType === (currentUser.Plan?.name || 'Free');
              const hasExpiredPlan = currentUser?.subscriptionEndDate ? 
                new Date(currentUser.subscriptionEndDate) < new Date() : false;
              
              // Button logic
              let buttonState = 'upgrade';
              let buttonText = 'Subscribe Now';
              let buttonClass = 'bg-indigo-600 hover:bg-indigo-700 text-white';
              let showPayPal = true;

              if (isCurrentPlan && !hasExpiredPlan) {
                buttonState = 'current';
                buttonText = 'Current Plan';
                buttonClass = 'bg-green-100 text-green-800 border-green-200 border';
                showPayPal = false;
              } else if (isCurrentPlan && hasExpiredPlan) {
                buttonState = 'renew';
                buttonText = 'Renew Plan';
                buttonClass = 'bg-yellow-600 hover:bg-yellow-700 text-white';
                showPayPal = true;
              } else if (currentUser?.Plan?.name === 'Free') {
                if (trialInfo?.isActive) {
                  buttonState = 'upgrade';
                  buttonText = 'Upgrade Now';
                  buttonClass = 'bg-green-600 hover:bg-green-700 text-white';
                } else if (trialInfo?.isTrialExpired) {
                  buttonState = 'upgrade';
                  buttonText = 'Upgrade Now';
                  buttonClass = 'bg-red-600 hover:bg-red-700 text-white';
                } else {
                  buttonState = 'upgrade';
                  buttonText = 'Choose Plan';
                  buttonClass = 'bg-blue-600 hover:bg-blue-700 text-white';
                }
                showPayPal = true;
              }

              return (
                <div
                  key={idx}
                  className={`relative bg-white rounded-xl shadow-lg border ${
                    isCurrentPlan && !hasExpiredPlan ? 'border-2 border-green-500' : 
                    plan.highlight && !isCurrentPlan ? 'border-2 border-indigo-500' : 'border-gray-200'
                  } p-6 hover:shadow-xl transition-shadow`}
                >
                  {/* Badges */}
                  {isCurrentPlan && !hasExpiredPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-green-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                        Current Plan
                      </span>
                    </div>
                  )}

                  {isCurrentPlan && hasExpiredPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                        Expired
                      </span>
                    </div>
                  )}

                  {trialInfo?.isActive && currentUser?.Plan?.name === 'Free' && plan.highlight && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-green-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                        🔥 Most Popular
                      </span>
                    </div>
                  )}

                  {!trialInfo?.isActive && trialInfo?.isTrialExpired && currentUser?.Plan?.name === 'Free' && plan.highlight && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                        ⚡ Upgrade Required
                      </span>
                    </div>
                  )}

                  {plan.highlight && currentUser?.Plan?.name !== 'Free' && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-indigo-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="flex items-center mb-6">
                    <div className={`w-12 h-12 ${plan.bg} rounded-full flex items-center justify-center`}>
                      {plan.icon}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-gray-500 text-sm">{plan.description}</p>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-500">/month</span>
                    
                    {trialInfo?.isActive && currentUser?.Plan?.name === 'Free' && (
                      <div className="text-sm text-green-600 font-medium mt-1">
                        Keep your trial features forever!
                      </div>
                    )}
                    
                    {!trialInfo?.isActive && trialInfo?.isTrialExpired && currentUser?.Plan?.name === 'Free' && (
                      <div className="text-sm text-red-600 font-medium mt-1">
                        Restore premium access now!
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-700">
                        <div className={`w-2 h-2 ${plan.bulletColor} rounded-full mr-3`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  {showPayPal && isLoggedIn && currentUser ? (
                    <div className="w-full">
                      <PayPalSubscription
                        planId={plan.planId}
                        prismaPlanId={plan.prismaPlanId}
                        containerId={plan.containerId}
                        userId={currentUser.id}
                        walletAddress={currentUser.walletAddress}
                        blockchainId={currentUser.blockchainId}
                        amount={plan.price}
                        dueDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
                        onApprove={handleApprove}
                        onError={handleError}
                        onCancel={handleCancel}
                        apiBaseUrl={BASE_API_URL}
                      />
                    </div>
                  ) : !isLoggedIn ? (
                    <button
                      onClick={login}
                      className="w-full py-3 px-4 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Connect Wallet to Subscribe
                    </button>
                  ) : (
                    <button
                      disabled={buttonState === 'current'}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${buttonClass}`}
                    >
                      {buttonText}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Feature Comparison Table */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">Compare Plans</h3>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-900">Features</th>
                  <th className="text-center p-4 font-semibold text-gray-900">Basic</th>
                  <th className="text-center p-4 font-semibold text-gray-900">Pro</th>
                  <th className="text-center p-4 font-semibold text-gray-900">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-4 font-medium text-gray-900">Monthly Queries</td>
                  <td className="p-4 text-center">1,000</td>
                  <td className="p-4 text-center">15,000</td>
                  <td className="p-4 text-center">1,000,000</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Transaction Limit</td>
                  <td className="p-4 text-center">$10,000</td>
                  <td className="p-4 text-center">$20,000</td>
                  <td className="p-4 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">User Access</td>
                  <td className="p-4 text-center">1 user</td>
                  <td className="p-4 text-center">3 users</td>
                  <td className="p-4 text-center">5 users</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Support Level</td>
                  <td className="p-4 text-center">Basic</td>
                  <td className="p-4 text-center">Priority</td>
                  <td className="p-4 text-center">24/7 Dedicated</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">UBID Access</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">✅</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Advanced Analytics</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">✅</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlansPage;
