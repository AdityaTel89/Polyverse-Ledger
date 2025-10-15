// src/components/PayPalSubscription.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { BASE_API_URL } from "../utils/constants";

interface PayPalSubscriptionProps {
  planId: string;
  prismaPlanId: string;
  containerId: string;
  userId: string;
  blockchainId?: string;
  walletAddress?: string;
  amount?: number;
  dueDate?: string;
  onApprove?: (subscriptionId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  apiBaseUrl?: string;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: any) => {
        render: (selector: string) => Promise<void>;
      };
    };
  }
}

const PayPalSubscription = ({
  planId,
  prismaPlanId,
  containerId,
  userId,
  blockchainId,
  walletAddress,
  amount,
  dueDate,
  onApprove,
  onError,
  onCancel,
  apiBaseUrl
}: PayPalSubscriptionProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRendered = useRef(false);

  const API_BASE_URL = apiBaseUrl || BASE_API_URL;

  // ✅ Fetch config from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('🔄 Fetching PayPal config from:', `${BASE_API_URL}/paypal/config`);
        const response = await fetch(`${BASE_API_URL}/paypal/config`);
        
        if (response.ok) {
          const configData = await response.json();
          console.log('✅ PayPal config loaded:', configData);
          setConfig(configData);
          
          // Validate that we have a client ID
          if (!configData.paypalClientId) {
            setError('PayPal Client ID not configured on server');
          }
        } else {
          console.warn('⚠️ Config endpoint failed, using fallback');
          setConfig({
            paypalClientId: getLocalPayPalClientId()
          });
        }
      } catch (error) {
        console.warn('⚠️ Config fetch error, using fallback:', error);
        setConfig({
          paypalClientId: getLocalPayPalClientId()
        });
      }
    };

    fetchConfig();
  }, []);

  const getLocalPayPalClientId = () => {
    // Try different environment variable patterns
    if (typeof window !== 'undefined' && typeof import.meta !== 'undefined') {
      try {
        const env = (import.meta as any).env;
        return env?.VITE_PAYPAL_CLIENT_ID;
      } catch (e) {
        console.warn('Could not access import.meta.env');
      }
    }
    
    // ✅ PRODUCTION FALLBACK: Use your actual client ID
    return 'AVI8931riEwagyhfrXKvtS2lDc82_HliaiU__ySr8aL-2D0jCa2GAHaABg-6ox5nveBLHNZmtdtG4KMB';
  };

  const PAYPAL_CLIENT_ID = config?.paypalClientId;

  // Check if PayPal Client ID is available
  useEffect(() => {
    if (config && !PAYPAL_CLIENT_ID) {
      setError('PayPal Client ID is not configured. Please check your environment variables.');
    }
  }, [config, PAYPAL_CLIENT_ID]);

  // ✅ Load PayPal SDK
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || error) {
      return;
    }

    const loadPayPalSDK = () => {
      if (window.paypal) {
        console.log('✅ PayPal SDK already loaded');
        setSdkLoaded(true);
        return;
      }

      const existingScript = document.querySelector(`script[src*="paypal.com/sdk/js"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => setSdkLoaded(true));
        return;
      }

      console.log('🔄 Loading PayPal SDK with Client ID:', PAYPAL_CLIENT_ID.substring(0, 20) + '...');
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription&currency=USD&components=buttons`;
      script.setAttribute('data-sdk-integration-source', 'button-factory');
      
      script.onload = () => {
        console.log('✅ PayPal SDK loaded successfully');
        setSdkLoaded(true);
      };
      
      script.onerror = () => {
        console.error('❌ Failed to load PayPal SDK');
        setError('Failed to load PayPal SDK. Please check your internet connection.');
      };

      document.head.appendChild(script);
    };

    loadPayPalSDK();
  }, [PAYPAL_CLIENT_ID, error]);

  // ✅ Handle subscription creation via backend
  const handleSubscriptionCreation = useCallback(async (subscriptionId: string) => {
    try {
      setIsLoading(true);
      console.log('🔄 Processing subscription:', subscriptionId);

      const response = await axios.post(`${API_BASE_URL}/paypal/create-subscription`, {
        plan_id: planId,
        userId,
        prismaPlanId,
        subscriptionId
      }, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Subscription processed successfully:', response.data);
      setIsLoading(false);
      onApprove?.(subscriptionId);

    } catch (err: any) {
      console.error('❌ Subscription processing failed:', err);
      const errorMessage = err?.response?.data?.error || 
                          err?.response?.data?.details ||
                          err.message || 
                          'Subscription processing failed. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    }
  }, [userId, prismaPlanId, planId, onApprove, onError, API_BASE_URL]);

  // ✅ Render PayPal buttons
  useEffect(() => {
    if (!sdkLoaded || !window.paypal || buttonsRendered.current || !containerRef.current || error) {
      return;
    }

    // ✅ First verify the plan exists
    const verifyAndRenderButtons = async () => {
      try {
        console.log('🔄 Verifying PayPal plan:', planId);
        
        const verifyResponse = await fetch(`${BASE_API_URL}/paypal/verify-plan/${planId}`);
        const verifyData = await verifyResponse.json();
        
        if (!verifyData.success || !verifyData.planExists) {
          setError(`PayPal plan ${planId} does not exist. Please contact support.`);
          return;
        }
        
        console.log('✅ PayPal plan verified:', verifyData.planData);
        
        // Now render the buttons
        window.paypal.Buttons({
          style: {
            shape: 'pill',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe',
            height: 40,
          },
          createSubscription: function(data: any, actions: any) {
            console.log('🔄 Creating PayPal subscription for plan:', planId);
            return actions.subscription.create({
              plan_id: planId,
              application_context: {
                brand_name: "MythosNet",
                locale: "en-US",
                shipping_preference: "NO_SHIPPING",
                user_action: "SUBSCRIBE_NOW",
                payment_method: {
                  payer_selected: "PAYPAL",
                  payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
                },
                return_url: `${window.location.origin}/subscription-success`,
                cancel_url: `${window.location.origin}/subscription-cancelled`
              }
            });
          },
          onApprove: function(data: any, actions: any) {
            console.log('✅ PayPal subscription approved:', data.subscriptionID);
            handleSubscriptionCreation(data.subscriptionID);
          },
          onError: function(err: any) {
            console.error('❌ PayPal subscription error:', err);
            const errorMessage = err?.message || 'PayPal subscription failed. Please try again.';
            setError(errorMessage);
            onError?.(errorMessage);
          },
          onCancel: function(data: any) {
            console.log('⚠️ PayPal subscription cancelled:', data);
            onCancel?.();
          }
        }).render(`#${containerId}`);

        buttonsRendered.current = true;
        console.log('✅ PayPal buttons rendered successfully');

      } catch (renderError: any) {
        console.error('❌ Failed to render PayPal buttons:', renderError);
        setError('Failed to render PayPal buttons. Please refresh the page and try again.');
      }
    };

    verifyAndRenderButtons();
  }, [sdkLoaded, planId, containerId, handleSubscriptionCreation, onError, onCancel, error, BASE_API_URL]);

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const retrySubscription = useCallback(() => {
    setError(null);
    buttonsRendered.current = false;
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, []);

  // ✅ Loading states and error handling
  if (!config) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-3" />
          <div className="text-center">
            <p className="text-gray-700 text-sm font-medium">Loading Payment System</p>
            <p className="text-gray-600 text-xs mt-1">Initializing secure payment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-xs font-bold">!</span>
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-red-800 text-sm font-medium">Payment Error</p>
            <p className="text-red-700 text-xs mt-1 break-words">{error}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={retrySubscription}
                disabled={isLoading}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Retrying..." : "Try Again"}
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 bg-gray-500 text-white rounded text-xs font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-200 border-t-blue-600 mr-3" />
          <div className="text-center">
            <p className="text-blue-800 text-sm font-medium">Processing Subscription</p>
            <p className="text-blue-600 text-xs mt-1">Please wait while we set up your plan...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sdkLoaded) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-3" />
          <div className="text-center">
            <p className="text-gray-700 text-sm font-medium">Loading PayPal</p>
            <p className="text-gray-600 text-xs mt-1">Initializing secure payment...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="paypal-subscription-container">
      <div 
        ref={containerRef}
        id={containerId}
        className="paypal-button-container min-h-[50px] flex items-center justify-center"
      />
    </div>
  );
};

export default PayPalSubscription;
