// Google Analytics and payment tracking utility functions

// Define the gtag function globally for TypeScript
declare global {
  interface Window {
    gtag: (
      command: string,
      action: string | Date,
      params?: {
        [key: string]: any;
      }
    ) => void;
    dataLayer: any[];
  }
}

/**
 * Track conversion event in Google Ads
 * @param conversionId - Conversion ID
 * @param conversionLabel - Conversion label for specific event
 * @param value - Conversion value
 */
export const trackConversion = (
  conversionId: string,
  conversionLabel: string,
  value?: number
) => {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('Google Analytics not initialized');
    return;
  }

  // Ensure proper format for conversion ID
  const formattedConversionId = conversionId.startsWith('AW-') 
    ? conversionId 
    : `AW-${conversionId}`;

  // Track the conversion
  window.gtag('event', 'conversion', {
    send_to: `${formattedConversionId}/${conversionLabel}`,
    value: value,
    currency: 'USD',
    transaction_id: '',
  });
  
  console.log(`Tracked conversion: ${formattedConversionId}/${conversionLabel}`);
};

/**
 * Track payment button click in the database and Google Analytics
 * @param method - Payment method (stripe or paypal)
 * @param userId - Optional user ID
 */
export const trackPaymentButtonClick = async (
  method: 'stripe' | 'paypal',
  userId?: number
) => {
  try {
    // Log the event to our analytics database
    await fetch('/api/track-payment-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method,
        event: 'button_click',
        userId
      }),
    });
    
    // Log in console for debugging
    console.log(`Tracked ${method} button click`);
    
    // Track in Google Analytics (if available)
    if (window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: 9.99,
        items: [{
          item_name: 'Premium Monthly Subscription',
          item_category: 'Subscription',
          price: 9.99,
          quantity: 1
        }],
        payment_method: method
      });
    }
  } catch (error) {
    console.error('Failed to track payment button click:', error);
  }
};

/**
 * Legacy function to track purchases - for backward compatibility
 * @param amount - Purchase amount
 * @param currency - Currency code (default: USD)
 */
export const trackPurchase = (amount: number, currency: string = 'USD') => {
  trackSuccessfulPayment('stripe', amount, currency);
};

/**
 * Track page view conversion
 * @param page - Page name or URL
 */
export const trackPageViewConversion = (page: string) => {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('Google Analytics not initialized');
    return;
  }
  
  window.gtag('event', 'page_view', {
    page_title: page,
    page_location: window.location.href,
    send_to: 'AW-17064009210'
  });
};

/**
 * Track successful payment in the database and Google Analytics
 * @param method - Payment method (stripe or paypal)
 * @param amount - Payment amount
 * @param currency - Payment currency (default: USD)
 * @param userId - Optional user ID
 * @param status - Payment status (default: completed)
 */
export const trackSuccessfulPayment = async (
  method: 'stripe' | 'paypal',
  amount: number,
  currency: string = 'USD',
  userId?: number,
  status: string = 'completed'
) => {
  try {
    // Log the event to our analytics database
    await fetch('/api/track-payment-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method,
        event: 'payment_success',
        userId,
        amount,
        currency,
        status
      }),
    });
    
    // Log in console for debugging
    console.log(`Tracked successful ${method} payment of ${amount} ${currency}`);
    
    // Track in Google Analytics (if available)
    if (window.gtag) {
      window.gtag('event', 'purchase', {
        transaction_id: new Date().getTime().toString(),
        value: amount,
        currency: currency,
        items: [{
          item_name: 'Premium Monthly Subscription',
          item_category: 'Subscription',
          price: amount,
          quantity: 1
        }],
        payment_method: method
      });
    }
    
    // Track Google Ads conversion specifically for premium subscriptions
    // Using the specific conversion ID provided: AW-17064009210
    trackConversion('AW-17064009210', 'premium_subscription', amount);
  } catch (error) {
    console.error('Failed to track successful payment:', error);
  }
};