// src/utils/getPayPalAccessToken.ts - PRODUCTION READY
import axios from "axios";

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
  }

  // Clean credentials of any whitespace
  const cleanClientId = clientId.trim();
  const cleanClientSecret = clientSecret.trim();
  
  const auth = Buffer.from(`${cleanClientId}:${cleanClientSecret}`).toString("base64");
  const baseUrl = mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

  try {
    console.log(`🔄 Authenticating with PayPal ${mode} environment...`);
    
    const response = await axios({
      method: 'POST',
      url: `${baseUrl}/v1/oauth2/token`,
      data: 'grant_type=client_credentials',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Accept-Language': 'en_US'
      },
      timeout: 30000
    });

    if (response.data && response.data.access_token) {
      console.log('✅ PayPal authentication successful');
      return response.data.access_token;
    } else {
      throw new Error('No access token in PayPal response');
    }

  } catch (error: any) {
    console.error("❌ PayPal Authentication Failed:");
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
      
      if (error.response.status === 401) {
        const suggestions = [
          "1. Verify credentials are from the correct environment (sandbox vs live)",
          "2. Ensure PayPal app is active in developer dashboard",
          "3. Check that 'Accept payments' feature is enabled",
          "4. Try creating a new PayPal sandbox app with fresh credentials"
        ];
        console.error("💡 Suggestions to fix 401 error:");
        suggestions.forEach(s => console.error(`   ${s}`));
      }
    }
    
    const errorMessage = error?.response?.data?.error_description || 
                        error?.response?.data?.error || 
                        error?.message || 
                        'PayPal authentication failed';
    
    throw new Error(`PayPal authentication failed: ${errorMessage}`);
  }
}
