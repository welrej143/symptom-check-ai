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
import SubscriptionManager from "./subscription-manager";

// Initialize Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error("Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY");
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Subscription price in dollars
const SUBSCRIPTION_PRICE = 9.99;

// Stripe Checkout Form Component
function StripeCheckoutForm({ clientSecret, subscriptionId }: { clientSecret: string, subscriptionId?: string }) {
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
        // For real subscription, the payment intent is already associated with the subscription
        // We don't need to pass the payment ID, just confirm the subscription is active
        const response = await apiRequest("POST", "/api/update-premium-status", {
          paymentIntentId: result.paymentIntent.id,
          // include the subscription ID if it was passed
          subscriptionId: subscriptionId || undefined,
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
          layout: "tabs",
          paymentMethodOrder: ["card", "amazon_pay", "cashapp"],
          defaultValues: {
            billingDetails: {
              name: user?.username || "",
              email: user?.email || "",
            }
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
        className="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
        style={{ fontSize: '1rem', fontWeight: 600 }}
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
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
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
          
          // Store the subscription ID if it's returned
          if (data.subscriptionId) {
            setSubscriptionId(data.subscriptionId);
          }
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
    <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Premium Monthly</h3>
      <p className="text-sm text-gray-600 mb-5">You will be charged ${SUBSCRIPTION_PRICE} monthly</p>
      
      <Elements stripe={stripePromise} options={{ 
        clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#2563eb",
            colorBackground: "#f9fafb",
            colorText: "#18181b",
            colorDanger: "#ef4444",
            fontFamily: "system-ui, -apple-system, sans-serif",
            borderRadius: "6px",
            spacingUnit: '4px',
            spacingGridRow: '20px',
          },
          rules: {
            '.Tab': {
              border: '1px solid #e5e7eb',
              boxShadow: 'none',
              padding: '10px 16px',
            },
            '.Tab:hover': {
              border: '1px solid #c7c7c7',
            },
            '.Tab--selected': {
              borderColor: '#2563eb',
              boxShadow: '0 0 0 1px #2563eb',
            },
            '.Label': {
              fontWeight: '500',
              marginBottom: '8px',
            },
            '.Input': {
              padding: '10px 14px',
              border: '1px solid #e5e7eb',
            }
          }
        }
      }}>
        <StripeCheckoutForm 
          clientSecret={clientSecret} 
          subscriptionId={subscriptionId || undefined} 
        />
      </Elements>
    </div>
  );
}



// Main premium card component
export default function PremiumCard() {
  const { user, refreshSubscriptionStatus } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { toast } = useToast();
  
  // If user already has premium, show subscription management UI
  if (user?.isPremium) {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg shadow-md overflow-hidden border border-primary-200">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-primary-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Premium Member</h3>
            </div>
            
            <p className="text-sm text-gray-700 mb-4">
              You're enjoying all premium benefits including unlimited symptom analyses and complete health tracking.
            </p>
            
            <div className="flex flex-wrap gap-4 mt-2">
              <div className="bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200 text-sm">
                <span className="text-gray-500">Status:</span>{" "}
                <span className="font-medium text-green-600">
                  {user.subscriptionStatus === "active" ? "Active" : user.subscriptionStatus}
                </span>
              </div>
              
              {user.subscriptionEndDate && (
                <div className="bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200 text-sm">
                  <span className="text-gray-500">
                    {user.subscriptionStatus === "canceled" ? "Access until:" : "Next billing:"}
                  </span>{" "}
                  <span className="font-medium">
                    {new Date(user.subscriptionEndDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Subscription management section */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Your Subscription</h3>
          <SubscriptionManager user={user} refreshSubscriptionStatus={refreshSubscriptionStatus} />
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
          
          <div className="mt-4">
            <button 
              onClick={() => setIsUpgrading(true)}
              className="bg-blue-600 text-white py-2.5 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center justify-center w-full"
            >
              Upgrade with Stripe
              <ArrowRight className="ml-2 h-4 w-4" />
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