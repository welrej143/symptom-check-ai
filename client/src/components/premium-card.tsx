import { Shield, LineChart, Loader, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import { 
  CardElement, 
  Elements, 
  useStripe, 
  useElements,
  PaymentElement
} from "@stripe/react-stripe-js";

// Initialize Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error("Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY");
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Subscription price in dollars
const SUBSCRIPTION_PRICE = 9.99;

// Wrapper component with client secret setup
function StripeSetup() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const getClientSecret = async () => {
      try {
        // Create payment intent
        const response = await apiRequest("POST", "/api/create-subscription");
        const data = await response.json();
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error("No client secret returned");
        }
      } catch (err) {
        console.error('Error getting client secret:', err);
        setError('Could not initialize payment. Please try again.');
        toast({
          title: "Payment Setup Failed",
          description: "Could not initialize the payment form. Please try again.",
          variant: "destructive",
        });
      }
    };
    
    getClientSecret();
  }, []);
  
  if (error) {
    return (
      <div className="text-red-600 text-sm flex items-center py-4">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }
  
  if (!clientSecret) {
    return (
      <div className="flex justify-center items-center py-6">
        <Loader className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }
  
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm clientSecret={clientSecret} />
    </Elements>
  );
}

// The checkout form component
function CheckoutForm({ clientSecret = "" }: { clientSecret?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, refreshSubscriptionStatus } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Confirm payment with Stripe
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: user?.username || '',
            email: user?.email || '',
          },
        },
      });
      
      if (result.error) {
        setError(result.error.message || 'Something went wrong');
        toast({
          title: "Payment Failed",
          description: result.error.message || 'An error occurred during payment',
          variant: "destructive",
        });
      } else if (result.paymentIntent) {
        // Payment successful, update premium status
        const response = await apiRequest("POST", "/api/update-premium-status", {
          paymentIntentId: result.paymentIntent.id,
        });
        
        const statusData = await response.json();
        
        // Refresh auth context to update premium status
        await refreshSubscriptionStatus();
        
        toast({
          title: "Welcome to Premium!",
          description: "Your subscription has been activated successfully.",
          variant: "default",
        });
        
        // Reload the page to reflect changes
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An error occurred. Please try again.');
      toast({
        title: "Payment Failed",
        description: "An error occurred during payment processing",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <div className="border border-gray-300 rounded-md p-3 bg-white">
          <CardElement 
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
        {error && (
          <div className="mt-2 text-red-600 text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            {error}
          </div>
        )}
      </div>
      
      <button 
        type="submit" 
        disabled={!stripe || isLoading}
        className="w-full bg-primary-600 text-white py-2 px-4 rounded-md font-medium hover:bg-primary-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <Loader className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </span>
        ) : (
          `Subscribe for $${SUBSCRIPTION_PRICE}/month`
        )}
      </button>
    </form>
  );
}

export default function PremiumCard() {
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  // If user already has premium, show different UI
  if (user?.isPremium) {
    return (
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg shadow-md overflow-hidden border border-primary-200">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Shield className="h-6 w-6 text-primary-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Premium Member</h3>
          </div>
          
          <p className="text-sm text-gray-700 mb-4">
            You're enjoying all premium benefits including unlimited symptom analyses and complete health tracking.
          </p>
          
          <div className="text-sm text-gray-600">
            <p>Subscription status: <span className="font-medium text-primary-700">Active</span></p>
            {user.subscriptionEndDate && (
              <p>Next billing date: {new Date(user.subscriptionEndDate).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Explore Premium Features</h3>
        
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Shield className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-3">
              <h4 className="text-base font-medium text-gray-900">Unlimited detailed analyses</h4>
              <p className="mt-1 text-sm text-gray-600">Get comprehensive health insights whenever you need them, with no monthly limits.</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <LineChart className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-3">
              <h4 className="text-base font-medium text-gray-900">Unlimited Symptoms Tracker</h4>
              <p className="mt-1 text-sm text-gray-600">Track your symptoms and health metrics with no limitations.</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Free tier</span>
              <span className="text-gray-900 font-medium">3 analyses/month</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Premium tier</span>
              <span className="text-primary-600 font-medium">Unlimited analyses</span>
            </div>
            <div className="mt-3 bg-gray-100 h-[1px]"></div>
            <div className="flex items-center justify-between text-sm mt-3">
              <span className="text-gray-600">Premium price</span>
              <span className="text-primary-900 font-semibold">${SUBSCRIPTION_PRICE}/month</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsUpgrading(true)}
            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 px-4 rounded-md font-medium hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center"
          >
            Upgrade to Premium
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
        
        {isUpgrading && (
          <div className="mt-6">
            <h4 className="text-base font-medium text-gray-900 mb-3">Complete Your Subscription</h4>
            <StripeSetup />
            <button 
              onClick={() => setIsUpgrading(false)}
              className="w-full mt-3 text-gray-600 text-sm hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
