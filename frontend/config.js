/**
 * API Configuration for RUD Frontend
 * Automatically uses environment variables if available
 */

// Determine API URL based on environment
const getApiUrl = () => {
  // For production builds (Vercel/Netlify)
  if (typeof window !== 'undefined') {
    // Try environment variable first
    if (window.ENV?.VITE_API_URL) {
      return window.ENV.VITE_API_URL;
    }
    
    // Try from import.meta (Vite)
    try {
      if (import.meta?.env?.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
      }
    } catch (e) {
      // import.meta not available in this context
    }
    
    // Auto-detect production backend
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://rud-backend.onrender.com'; // Update with your Render URL
    }
  }
  
  // Development fallback
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiUrl();

export const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};
