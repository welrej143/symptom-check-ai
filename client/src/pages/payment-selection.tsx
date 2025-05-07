import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Loader, CreditCard, AlertCircle } from 'lucide-react';
import PayPalSubscription from '@/components/PayPalSubscription';

// Import payment logos
import paypalLogo from "../assets/paypal_icon.png";
import stripeLogo from "../assets/stripe_logo.png";

export default function PaymentSelection() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | null>(null);
  const [enabledMethods, setEnabledMethods] = useState<{
    stripe: boolean;
    paypal: boolean;
  }>({ stripe: false, paypal: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Redirect to auth if not logged in
  useEffect(() => {
    if (user === null && !loading) {
      setLocation('/auth');
    }
  }, [user, loading, setLocation]);
  
  // Get available payment methods
  useEffect(() => {
    const getPaymentMethods = async () => {
      try {
        setLoading(true);
        const response = await apiRequest('GET', '/api/payment-methods');
        
        if (!response.ok) {
          throw new Error('Failed to fetch payment methods');
        }
        
        const data = await response.json();
        setEnabledMethods({
          stripe: data.stripe || false,
          paypal: data.paypal || false
        });
        
        // Default to Stripe if available
        if (data.stripe) {
          setPaymentMethod('stripe');
        } else if (data.paypal) {
          setPaymentMethod('paypal');
        }
      } catch (err) {
        console.error('Error fetching payment methods:', err);
        setError('Unable to load payment options. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    getPaymentMethods();
  }, []);
  
  const handleStripeSelection = async () => {
    try {
      setProcessing(true);
      
      // Create a Stripe Checkout session
      const response = await apiRequest('POST', '/api/create-subscription', {
        paymentMethod: 'stripe'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create Stripe checkout session');
      }
      
      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received from server');
      }
    } catch (err) {
      console.error('Error creating Stripe checkout:', err);
      toast({
        title: 'Payment Error',
        description: err instanceof Error ? err.message : 'Failed to set up payment',
        variant: 'destructive'
      });
      setProcessing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
        <Loader className="h-10 w-10 text-primary-600 animate-spin" />
        <p className="text-gray-600 mt-4">Loading payment options...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-800 mb-4">Payment Error</h2>
        <p className="text-red-700 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }
  
  // If no payment methods are enabled
  if (!enabledMethods.stripe && !enabledMethods.paypal) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="h-6 w-6 text-yellow-500 mr-3 mt-0.5" />
          <div>
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">Payment Methods Unavailable</h2>
            <p className="text-yellow-700 mb-4">
              Our payment system is currently unavailable. Please try again later or contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto my-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Select Payment Method</h1>
      
      {/* Payment method selection */}
      {enabledMethods.stripe && enabledMethods.paypal && (
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button
              onClick={() => setPaymentMethod('stripe')}
              className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === 'stripe'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center mb-3">
                <img src={stripeLogo} alt="Stripe" className="h-8" />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-gray-900">Credit Card</h3>
                <p className="text-sm text-gray-500 mt-1">Pay securely with your credit card</p>
              </div>
            </button>
            
            <button
              onClick={() => setPaymentMethod('paypal')}
              className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === 'paypal'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center mb-3">
                <img src={paypalLogo} alt="PayPal" className="h-8" />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-gray-900">PayPal</h3>
                <p className="text-sm text-gray-500 mt-1">Pay using your PayPal account</p>
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* Payment processing */}
      {paymentMethod === 'stripe' ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Credit Card Payment</h2>
            <p className="text-gray-600 mb-6">
              You'll be redirected to our secure payment processor to complete your subscription.
            </p>
            
            <button
              onClick={handleStripeSelection}
              disabled={processing}
              className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader className="inline-block w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="inline-block w-4 h-4 mr-2" />
                  Continue to Payment
                </>
              )}
            </button>
          </div>
        </div>
      ) : paymentMethod === 'paypal' ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <PayPalSubscription 
            onSuccess={() => {
              toast({
                title: 'Subscription Activated',
                description: 'Your premium subscription has been successfully activated!',
                variant: 'default'
              });
              
              // Redirect to homepage after successful subscription
              setTimeout(() => {
                setLocation('/');
              }, 1500);
            }}
          />
        </div>
      ) : (
        <div className="text-center text-gray-500">
          Please select a payment method to continue.
        </div>
      )}
    </div>
  );
}