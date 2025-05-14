// Google Ads Conversion Tracking Utility

// Define window.gtag function for TypeScript
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * Track a page view conversion using the official Google Ads snippet
 * Use this for tracking conversions that happen when a user views a specific page
 * after completing a goal (like a thank you page)
 */
export const trackPageViewConversion = (
  value: number = 1.0,
  currency: string = 'USD'
) => {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('Google Ads tracking not available');
    return;
  }

  // This is the exact snippet provided by Google Ads
  window.gtag('event', 'conversion', {
    'send_to': 'AW-17064009210/nJjFCJzQ68caEPq74Mg_',
    'value': value,
    'currency': currency
  });
};

/**
 * Track a click conversion using the official Google Ads snippet and redirect
 * This function tracks a conversion when a user clicks a button or link
 * and optionally redirects them to a new URL
 */
export const trackClickConversion = (url?: string) => {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('Google Ads tracking not available');
    return false;
  }

  const callback = function() {
    if (typeof url !== 'undefined') {
      window.location = url as any;
    }
  };

  // This is the exact snippet provided by Google Ads
  window.gtag('event', 'conversion', {
    'send_to': 'AW-17064009210/nJjFCJzQ68caEPq74Mg_',
    'value': 1.0,
    'currency': 'USD',
    'event_callback': callback
  });
  
  return false;
};

/**
 * Track a purchase conversion
 * A wrapper around trackPageViewConversion to track subscription purchases
 */
export const trackPurchase = (
  value: number,
  currency: string = 'USD'
) => {
  trackPageViewConversion(value, currency);
};

/**
 * Track a basic conversion
 * A simplified function to track conversions with custom parameters
 */
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
    'send_to': `${conversionId}/${conversionLabel}`,
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

// Track a page view (normally handled automatically by the base tag, but useful for SPAs)
export const trackPageView = (pageTitle: string, pagePath: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', 'page_view', {
    page_title: pageTitle,
    page_path: pagePath,
    send_to: 'AW-17064009210'
  });
};