// Google Ads Conversion Tracking Utility

// Define window.gtag function for TypeScript
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Track a specific conversion event
export const trackConversion = (
  conversionId: string, 
  conversionLabel: string, 
  value?: number,
  currency?: string,
  transactionId?: string
) => {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('Google Ads tracking not available');
    return;
  }

  // Create conversion parameters
  const conversionParams: Record<string, any> = {
    'send_to': `AW-17064009210/${conversionLabel}`,
  };

  // Add optional parameters if they exist
  if (value !== undefined) {
    conversionParams.value = value;
  }
  
  if (currency) {
    conversionParams.currency = currency;
  }
  
  if (transactionId) {
    conversionParams.transaction_id = transactionId;
  }

  // Send conversion event to Google Ads
  window.gtag('event', 'conversion', conversionParams);
};

// Track a purchase conversion
export const trackPurchase = (
  value: number,
  currency: string = 'USD',
  transactionId?: string
) => {
  // Replace 'CONVERSION_LABEL' with your actual purchase conversion label from Google Ads
  trackConversion('17064009210', 'CONVERSION_LABEL', value, currency, transactionId);
};

// Track a signup conversion
export const trackSignup = () => {
  // Replace 'SIGNUP_LABEL' with your actual signup conversion label from Google Ads
  trackConversion('17064009210', 'SIGNUP_LABEL');
};

// Track a page view (normally handled automatically by the base tag, but useful for SPAs)
export const trackPageView = (pageTitle: string, pagePath: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', 'page_view', {
    page_title: pageTitle,
    page_path: pagePath,
    send_to: 'AW-17064009210'
  });
};