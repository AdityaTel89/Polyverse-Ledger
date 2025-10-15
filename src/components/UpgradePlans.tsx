// src/components/UpgradePlans.tsx
import React from 'react';
import PayPalSubscription from './PayPalSubscription';
import { BASE_API_URL } from '../utils/constants';

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
}

interface UpgradePlansProps {
  currentUser: User;
  trialEndDate: string;
  currentPlanExpiry: string | null;
  onApprove: (subscriptionId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

// ✅ PRODUCTION READY PLANS with your existing PayPal Plan IDs
const plans = [
  {
    name: 'Basic Plan',
    description: 'Small businesses & individuals',
    price: 149,
    bg: 'bg-blue-100',
    bulletColor: 'bg-blue-500',
    features: [
      '1,000 queries per month',
      'Credit scoring features',
      '$10,000 transaction limit',
      'Single user access',
    ],
    containerId: 'paypal-basic-plan',
    planId: 'P-7WV44462TF966624XNB2PKXA', // Your existing PayPal plan ID
    prismaPlanId: 'f3aba82b-061e-4314-ae28-8dbc91ccb835',
    planType: 'Basic',
  },
  {
    name: 'Pro Plan',
    description: 'Medium businesses & DeFi protocols',
    price: 699,
    bg: 'bg-indigo-100',
    bulletColor: 'bg-indigo-500',
    features: [
      '15,000 queries per month',
      'Full UBID access',
      'Complete credit scoring & invoicing',
      '$20,000 transaction limit',
      '3 users access',
    ],
    containerId: 'paypal-pro-plan',
    planId: 'P-1LC09938TF381221LNB2PLHQ', // Your existing PayPal plan ID
    prismaPlanId: '0376ffb5-f2b5-49c0-9732-613cdc5fa893',
    highlight: true,
    planType: 'Pro',
  },
  {
    name: 'Premium Plan',
    description: 'Financial institutions',
    price: 3699,
    bg: 'bg-yellow-100',
    bulletColor: 'bg-yellow-500',
    features: [
      '1M queries per month',
      'All platform features',
      'Unlimited transactions',
      'Institutional grade security',
      '5 users access',
    ],
    containerId: 'paypal-premium-plan',
    planId: 'P-7S343131C3165360FNB2PJ6A', // Your existing PayPal plan ID
    prismaPlanId: 'd0453ced-0be1-447e-a599-5f0fe660342d',
    planType: 'Premium',
  },
];

const UpgradePlans: React.FC<UpgradePlansProps> = ({
  currentUser,
  trialEndDate,
  currentPlanExpiry,
  onApprove,
  onError,
  onCancel,
}) => {
  const currentPlanName = currentUser.Plan?.name || 'Free';
  const trialActive = currentUser.trialActive || false;
  const trialUsed = currentUser.trialUsed || false;
  
  const planExpired = currentPlanName !== 'Free' && 
                     currentPlanExpiry && 
                     new Date(currentPlanExpiry) < new Date();

  const getAvailablePlans = () => {
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

  const getUpgradeTitle = () => {
    if (planExpired && currentPlanName !== 'Free') {
      return `Renew Your ${currentPlanName} Plan`;
    }
    
    switch (currentPlanName) {
      case 'Free':
        if (trialActive) {
          return 'Upgrade During Your Trial';
        } else if (trialUsed) {
          return 'Upgrade Your Plan';
        } else {
          return 'Choose Your Plan';
        }
      case 'Basic':
        return planExpired ? `Renew Your ${currentPlanName} Plan` : 'Upgrade to Pro or Premium';
      case 'Pro':
        return planExpired ? `Renew Your ${currentPlanName} Plan` : 'Upgrade to Premium';
      case 'Premium':
        return planExpired ? `Renew Your ${currentPlanName} Plan` : 'Your Premium Plan';
      default:
        return 'Choose Your Plan';
    }
  };

  const getUpgradeDescription = () => {
    const trialDaysLeft = currentUser.trialDaysRemaining || 0;
    
    if (planExpired && currentPlanName !== 'Free') {
      return `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`;
    }
    
    switch (currentPlanName) {
      case 'Free':
        if (trialActive && trialDaysLeft > 0) {
          return `🎉 Your ${trialDaysLeft}-day free trial is active! Upgrade anytime to keep all premium features beyond your trial period.`;
        } else if (trialUsed && !trialActive) {
          return 'Your free trial has ended. Upgrade to continue accessing premium features.';
        } else {
          return 'Upgrade to unlock premium features and advanced capabilities.';
        }
      case 'Basic':
        return planExpired 
          ? `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`
          : 'Unlock more queries, transaction limits, and team features with Pro or Premium.';
      case 'Pro':
        return planExpired 
          ? `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`
          : 'Get unlimited transactions and institutional features with Premium.';
      case 'Premium':
        return planExpired 
          ? `Your ${currentPlanName} plan has expired. Renew to continue accessing premium features.`
          : 'You have access to all premium features.';
      default:
        return 'Choose the plan that best fits your needs.';
    }
  };

  const availablePlans = getAvailablePlans();

  if (availablePlans.length === 0) {
    return (
      <div className="mb-8">
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            You're on the Premium Plan!
          </h2>
          <p className="text-gray-600">
            You have access to all features and capabilities.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {getUpgradeTitle()}
      </h2>
      <p className="text-gray-600 mb-6">
        {getUpgradeDescription()}
      </p>

      {/* Trial ended banner */}
      {currentPlanName === 'Free' && trialUsed && !trialActive && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-800 font-medium">
                ⏰ Free Trial Ended
              </p>
              <p className="text-red-600 text-sm mt-1">
                Your 5-day trial has expired. Upgrade to continue using premium features.
              </p>
            </div>
            <div className="text-right">
              <p className="text-red-800 font-semibold">
                {(currentUser.queriesUsed || 0).toLocaleString()} / {(currentUser.queriesLimit || 0).toLocaleString()}
              </p>
              <p className="text-red-600 text-sm">Queries Used</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan status banner for paid plans */}
      {currentPlanName !== 'Free' && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-800 font-medium">
                Current Plan: {currentPlanName} 
                {currentUser.planSource && ` (${currentUser.planSource})`}
              </p>
              {currentPlanExpiry && (
                <p className="text-blue-600 text-sm">
                  {new Date(currentPlanExpiry) > new Date() 
                    ? `Active until ${new Date(currentPlanExpiry).toLocaleDateString()}`
                    : `Expired on ${new Date(currentPlanExpiry).toLocaleDateString()}`
                  }
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-blue-800 font-semibold">
                {(currentUser.queriesUsed || 0).toLocaleString()} / {(currentUser.queriesLimit || 0).toLocaleString()}
              </p>
              <p className="text-blue-600 text-sm">Queries Used</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {availablePlans.map((plan, idx) => {
          const isCurrentPlan = plan.planType === currentPlanName;
          const hasExpiredPlan = currentPlanExpiry ? new Date(currentPlanExpiry) < new Date() : false;
          
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
          } else if (currentPlanName === 'Free') {
            if (trialActive) {
              buttonState = 'upgrade';
              buttonText = 'Upgrade Now';
              buttonClass = 'bg-green-600 hover:bg-green-700 text-white';
            } else if (trialUsed) {
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
              {/* Current plan badge */}
              {isCurrentPlan && !hasExpiredPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              {/* Expired badge */}
              {isCurrentPlan && hasExpiredPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                    Expired
                  </span>
                </div>
              )}

              {/* Trial active badge */}
              {trialActive && currentPlanName === 'Free' && plan.highlight && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                    🔥 Most Popular
                  </span>
                </div>
              )}

              {/* Trial expired badge */}
              {!trialActive && trialUsed && currentPlanName === 'Free' && plan.highlight && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                    ⚡ Upgrade Required
                  </span>
                </div>
              )}

              {/* Recommended badge for non-Free users or non-trial situations */}
              {plan.highlight && currentPlanName !== 'Free' && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-indigo-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center mb-4">
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-gray-500 text-sm">{plan.description}</p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-gray-500">/month</span>
                
                {trialActive && currentPlanName === 'Free' && (
                  <div className="text-sm text-green-600 font-medium mt-1">
                    Keep your trial features forever!
                  </div>
                )}
                
                {!trialActive && trialUsed && currentPlanName === 'Free' && (
                  <div className="text-sm text-red-600 font-medium mt-1">
                    Restore premium access now!
                  </div>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-700">
                    <div className={`w-1.5 h-1.5 ${plan.bulletColor} rounded-full mr-2`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Action button */}
              {showPayPal ? (
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
                    onApprove={onApprove}
                    onError={onError}
                    onCancel={onCancel}
                    apiBaseUrl={BASE_API_URL}
                  />
                </div>
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
    </div>
  );
};

export default UpgradePlans;
