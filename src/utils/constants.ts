// Automatically detect environment
export const BASE_API_URL = (() => {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  if (isLocal) {
    return 'http://localhost:8080/api/v1';
  }
  
  // Production: use same domain
  return '/api/v1';
})();
