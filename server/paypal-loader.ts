// PayPal configuration helper that safely loads PayPal mode from db

/**
 * Safely get the PayPal mode without causing initialization errors
 * This avoids importing storage during the initial module loading phase
 */
export async function getPayPalMode(): Promise<'sandbox' | 'live'> {
  try {
    // Try getting from environment variable first (safe)
    if (process.env.PAYPAL_MODE === 'live') {
      return 'live';
    }
    
    // Try getting from database
    try {
      // Only dynamically import storage when needed
      const { storage } = await import('./storage');
      const dbMode = await storage.getSetting('paypal_mode');
      
      if (dbMode === 'live') {
        return 'live';
      }
    } catch (dbError) {
      // Silently fail and use defaults if db isn't ready
      console.warn("Couldn't check database for PayPal mode, using defaults");
    }
    
    // Default for production environment
    if (process.env.NODE_ENV === 'production') {
      return 'live'; 
    }
  } catch (error) {
    console.error("Error determining PayPal mode:", error);
  }
  
  // Default to sandbox as safest option
  return 'sandbox';
}

/**
 * Update PayPal mode in environment variables
 */
export function updatePayPalMode(mode: 'sandbox' | 'live'): void {
  process.env.PAYPAL_MODE = mode;
  console.log(`PayPal mode updated to: ${mode}`);
}

/**
 * Get the SDK URL for client-side loading based on mode
 */
export function getPayPalSdkUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'live' 
    ? 'https://www.paypal.com/web-sdk/v6/core'
    : 'https://www.sandbox.paypal.com/web-sdk/v6/core';
}