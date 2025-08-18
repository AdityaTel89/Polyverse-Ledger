// src/lib/apiClient.ts

// API configuration interface
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// HTTP methods type
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Request options interface
interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  credentials?: RequestCredentials;
}

const API_BASE_URL = ''; // Empty for same-origin requests

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      method: options.method || 'GET',
      credentials: 'include', // Include cookies for auth
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as unknown as T;
      }
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Create and export the API client instance
export const apiClient = new ApiClient();

// Export API endpoints configuration
export const apiEndpoints = {
  // System endpoints
  health: '/health',
  ready: '/ready',
  
  // API endpoints
  dashboard: '/api/v1/dashboard',
  blockchain: '/api/v1/blockchain',
  user: '/api/v1/user',
  organization: '/api/v1/organization',
  invoices: '/api/v1/invoices',
  creditScore: '/api/v1/credit-score',
  crosschain: '/api/v1/crosschain',
  crossChainTransaction: '/api/v1/transaction/cross-chain',
  transaction: '/api/v1/transaction',
  plan: '/api/v1/plan',
  query: '/api/v1/query',
  paypal: '/paypal',
} as const;

// Export types for better type safety
export type ApiEndpoint = typeof apiEndpoints[keyof typeof apiEndpoints];

// Utility functions for common API patterns
export const apiUtils = {
  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      await apiClient.get(apiEndpoints.health);
      return true;
    } catch {
      return false;
    }
  },

  // Get health status
  async getHealthStatus(): Promise<any> {
    return apiClient.get(apiEndpoints.health);
  },

  // Common error handler
  handleApiError(error: Error): string {
    if (error.message.includes('404')) {
      return 'Resource not found';
    } else if (error.message.includes('401')) {
      return 'Unauthorized access';
    } else if (error.message.includes('500')) {
      return 'Server error occurred';
    } else {
      return 'An unexpected error occurred';
    }
  },
};

// Default export
export default apiClient;
