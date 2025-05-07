import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader } from 'lucide-react';
import PayPalButton from './PayPalButton';

interface PayPalSubscriptionProps {
  onSuccess?: () => void;
}

export default function PayPalSubscription({ onSuccess }: PayPalSubscriptionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<{
    amount: string;
    currency: string;
    intent: string;
    paypalMode: 'sandbox' | 'live';
  } | null>(null);
  
  const { toast } = useToast();
  
  useEffect(() => {
    const initializePayPalSubscription = async () => {
      try {
        setLoading(true);
        const response = await apiRequest('POST', '/api/create-subscription', {
          paymentMethod: 'paypal'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to initialize PayPal subscription');
        }
        
        const data = await response.json();
        
        if (data.provider !== 'paypal') {
          throw new Error('Server did not return PayPal subscription data');
        }
        
        setSubscriptionData({
          amount: data.amount,
          currency: data.currency,
          intent: data.intent,
          paypalMode: data.paypalMode
        });
      } catch (err) {
        console.error('Error initializing PayPal subscription:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        toast({
          title: 'PayPal Subscription Error',
          description: err instanceof Error ? err.message : 'Failed to initialize PayPal subscription',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    initializePayPalSubscription();
  }, [toast]);
  
  const handleSubscriptionSuccess = async (data: any) => {
    try {
      setLoading(true);
      
      // Extract subscription and order IDs from PayPal response
      const subscriptionId = data.subscriptionID || data.id;
      const orderId = data.orderID;
      
      if (!subscriptionId) {
        throw new Error('No subscription ID received from PayPal');
      }
      
      // Send subscription details to our backend
      const response = await apiRequest('POST', '/api/paypal-subscription-success', {
        subscriptionId,
        orderId
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process subscription');
      }
      
      // Show success message
      toast({
        title: 'Subscription Activated',
        description: 'Your premium subscription has been successfully activated!',
        variant: 'default'
      });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      } else {
        // Redirect to homepage with success parameter
        window.location.href = '/?subscription=success';
      }
    } catch (err) {
      console.error('Error processing PayPal subscription:', err);
      toast({
        title: 'Subscription Error',
        description: err instanceof Error ? err.message : 'Failed to activate your subscription',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <Loader className="h-10 w-10 text-primary-600 animate-spin" />
        <p className="text-gray-600">Preparing PayPal subscription...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 space-y-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-medium text-red-800">Subscription Error</h3>
        <p className="text-red-700">{error}</p>
        <button 
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }
  
  if (!subscriptionData) {
    return (
      <div className="p-6 space-y-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-medium text-yellow-800">Subscription Data Missing</h3>
        <p className="text-yellow-700">Unable to load PayPal subscription information. Please try again.</p>
        <button 
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Complete Your Subscription with PayPal</h3>
        <p className="text-gray-600">Click the PayPal button below to complete your monthly subscription.</p>
      </div>
      
      <div className="flex justify-center">
        <PayPalButton 
          amount={subscriptionData.amount} 
          currency={subscriptionData.currency}
          intent={subscriptionData.intent}
          onSuccess={handleSubscriptionSuccess}
        />
      </div>
      
      <div className="text-sm text-gray-500 text-center mt-4">
        <p>You will be charged ${subscriptionData.amount} {subscriptionData.currency} per month until you cancel.</p>
        <p className="mt-1">Your subscription can be managed from your account dashboard.</p>
      </div>
    </div>
  );
}