// Replace your existing API URL configuration with this:
export const BASE_API_URL = (() => {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    return 'http://localhost:8080/api/v1';
  }
  
  // Check if running locally
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';
  
  if (isLocal) {
    return 'http://localhost:8080/api/v1';
  }
  
  // Production: use relative path (same domain)
  return '/api/v1';
})();
