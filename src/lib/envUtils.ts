import { getCurrentEnvironment, getEnvironmentConfig } from "@/integrations/supabase/client";

// Cache for environment settings to avoid excessive API calls
let environmentCache: {
  currentEnv?: string;
  config?: any;
  lastFetched?: number;
} = {};

// Time in milliseconds after which we should refresh the environment cache
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current environment name (development or production)
 */
export const getEnvironment = async (): Promise<string> => {
  const now = Date.now();
  
  // If we have a cached value and it's not expired, use it
  if (environmentCache.currentEnv && environmentCache.lastFetched && 
      now - environmentCache.lastFetched < CACHE_EXPIRY) {
    return environmentCache.currentEnv;
  }
  
  // Otherwise fetch a fresh value
  const env = await getCurrentEnvironment();
  
  // Update cache
  environmentCache.currentEnv = env;
  environmentCache.lastFetched = now;
  
  return env;
};

/**
 * Get environment-specific configuration
 */
export const getConfig = async (): Promise<any> => {
  const now = Date.now();
  
  // If we have a cached config and it's not expired, use it
  if (environmentCache.config && environmentCache.lastFetched && 
      now - environmentCache.lastFetched < CACHE_EXPIRY) {
    return environmentCache.config;
  }
  
  // Otherwise fetch a fresh config
  const env = await getEnvironment();
  const config = await getEnvironmentConfig(env);
  
  // Update cache
  environmentCache.config = config;
  environmentCache.lastFetched = now;
  
  return config;
};

/**
 * Clear the environment cache to force a refresh on next call
 */
export const clearEnvironmentCache = () => {
  environmentCache = {};
};

/**
 * Switch the environment (development or production)
 * This would be used in an admin interface
 */
export const switchEnvironment = async (newEnv: 'development' | 'production'): Promise<boolean> => {
  try {
    // In a real implementation, you might want to update a user preference
    // in a database or localStorage
    
    // Clear the cache to force a refresh with the new environment
    clearEnvironmentCache();
    
    // Pre-populate the cache with the new environment
    environmentCache.currentEnv = newEnv;
    environmentCache.lastFetched = Date.now();
    
    // Fetch the config for the new environment
    const config = await getEnvironmentConfig(newEnv);
    environmentCache.config = config;
    
    console.log(`Switched to ${newEnv} environment`);
    return true;
  } catch (error) {
    console.error(`Error switching to ${newEnv} environment:`, error);
    return false;
  }
};

/**
 * Check if we're in production environment
 */
export const isProduction = async (): Promise<boolean> => {
  const env = await getEnvironment();
  return env === 'production';
};

/**
 * Check if we're in development environment
 */
export const isDevelopment = async (): Promise<boolean> => {
  const env = await getEnvironment();
  return env === 'development';
};
