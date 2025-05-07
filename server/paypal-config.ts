// PayPal configuration helper for both development and production environments
import * as paypal from './paypal';
import { storage } from './storage';

// Get current PayPal mode setting
export async function getPayPalMode(): Promise<'sandbox' | 'live'> {
  try {
    // First check database setting
    const dbMode = await storage.getSetting('paypal_mode');
    if (dbMode === 'live' || dbMode === 'sandbox') {
      return dbMode;
    }
    
    // Then check environment variable
    if (process.env.PAYPAL_MODE === 'live') {
      return 'live';
    }
    
    // Default based on environment
    if (process.env.NODE_ENV === 'production') {
      return 'live';
    }
  } catch (error) {
    console.error('Error determining PayPal mode:', error);
  }
  
  // Default to sandbox as safest option
  return 'sandbox';
}

// Get the PayPal SDK URL for client-side loading
export function getPayPalSdkUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'live' 
    ? 'https://www.paypal.com/web-sdk/v6/core'
    : 'https://www.sandbox.paypal.com/web-sdk/v6/core';
}

// Update payment settings including PayPal mode
export async function updatePaymentSettings(settings: { 
  stripe_enabled: boolean;
  paypal_enabled: boolean;
  paypal_mode: 'sandbox' | 'live';
}): Promise<void> {
  // Update each setting in the database
  await storage.setSetting('stripe_enabled', settings.stripe_enabled.toString());
  await storage.setSetting('paypal_enabled', settings.paypal_enabled.toString());
  await storage.setSetting('paypal_mode', settings.paypal_mode);
  
  console.log(`PayPal settings updated: Mode = ${settings.paypal_mode}, Enabled = ${settings.paypal_enabled}`);
}