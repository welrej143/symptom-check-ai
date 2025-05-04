import { Shield, LineChart, Loader, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import {
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

// Stripe Checkout Form Component
function StripeCheckoutForm({ clientSecret }: { clientSecret: string }) {
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
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
          payment_method_data: {
            billing_details: {
              name: user?.username || "",
              email: user?.email || "",
            },
          },
        },
        redirect: "if_required"
      });
      
      if (result.error) {
        setError(result.error.message || "Something went wrong");
        toast({
          title: "Payment Failed",
          description: result.error.message || "An error occurred during payment",
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
        // Payment successful, update premium status
        const response = await apiRequest("POST", "/api/update-premium-status", {
          paymentIntentId: result.paymentIntent.id,
        });
        
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
      console.error("Payment error:", err);
      setError("An error occurred. Please try again.");
      toast({
        title: "Payment Failed",
        description: "An error occurred during payment processing",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: {
            type: "tabs",
            defaultCollapsed: false,
          }
        }}
      />
      
      {error && (
        <div className="mt-3 text-red-600 text-sm flex items-center">
          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      <button 
        type="submit" 
        disabled={!stripe || isLoading}
        className="w-full mt-4 bg-primary-600 text-white py-2 px-4 rounded-md font-medium hover:bg-primary-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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

// Wrapper component that fetches client secret and displays Stripe Elements
function StripePaymentOptions() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const getClientSecret = async () => {
      try {
        const response = await apiRequest("POST", "/api/create-subscription");
        const data = await response.json();
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error("No client secret returned");
        }
      } catch (err) {
        console.error("Error getting client secret:", err);
        setError("Could not initialize payment. Please try again.");
        toast({
          title: "Payment Setup Failed",
          description: "Could not initialize the payment form. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    getClientSecret();
  }, [toast]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-red-600 text-sm flex items-center justify-center py-6">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }
  
  if (!clientSecret) {
    return (
      <div className="text-red-600 text-sm flex items-center justify-center py-6">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>Could not connect to payment provider. Please try again later.</span>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Premium Monthly</h3>
      <p className="text-sm text-gray-600 mb-5">You will be charged ${SUBSCRIPTION_PRICE} monthly</p>
      
      <Elements stripe={stripePromise} options={{ 
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#4f46e5",
          }
        }
      }}>
        <StripeCheckoutForm clientSecret={clientSecret} />
      </Elements>
    </div>
  );
}

// Main premium card component
export default function PremiumCard() {
  const { user, refreshSubscriptionStatus } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { toast } = useToast();
  
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
  
  // For temporary demo purposes - quick upgrade button
  const handleQuickUpgrade = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upgrade to premium",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await apiRequest("POST", "/api/update-premium-status", {
        paymentIntentId: "pi_simulated_" + Date.now(),
        paymentMethod: "card"
      });
      
      await refreshSubscriptionStatus();
      
      toast({
        title: "Welcome to Premium!",
        description: "Your subscription has been activated successfully. (Demo Mode)",
        variant: "default",
      });
      
      // Reload to show premium features
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error("Error updating premium status:", err);
      toast({
        title: "Upgrade Failed",
        description: "Could not upgrade to premium. Please try again.",
        variant: "destructive",
      });
    }
  };
  
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <button 
              onClick={() => setIsUpgrading(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 px-4 rounded-md font-medium hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center"
            >
              Upgrade with Stripe
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            
            <button 
              onClick={handleQuickUpgrade}
              className="bg-primary-600 text-white py-2.5 px-4 rounded-md font-medium hover:bg-primary-700 transition-colors flex items-center justify-center"
            >
              Quick Upgrade (Demo)
            </button>
          </div>
        </div>
        
        {isUpgrading && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-medium text-gray-900">Complete Your Subscription</h4>
              <button 
                onClick={() => setIsUpgrading(false)}
                className="text-gray-600 text-sm hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
            
            <StripePaymentOptions />
          </div>
        )}
      </div>
    </div>
  );
}