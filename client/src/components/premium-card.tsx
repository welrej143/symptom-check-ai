import { Shield, LineChart, Loader, AlertCircle, ArrowRight, Calendar, CreditCard, AlertTriangle } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import PayPalButton from "./PayPalButton";

// Initialize Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error("Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY");
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Define the price data type
interface PriceData {
  id: string;
  amount: number;
  currency: string;
  interval: string;
  intervalCount: number;
  formattedPrice: string;
  productName: string;
  productDescription: string;
}

// Note: We've removed the SUBSCRIPTION_PRICE constant as we now get dynamic pricing from Stripe

// Stripe Checkout Form Component
function StripeCheckoutForm({ clientSecret, subscriptionId }: { clientSecret: string, subscriptionId?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, refreshSubscriptionStatus } = useAuth();
  
  // Fetch price information from Stripe
  const { data: priceData, isLoading: isPriceLoading, error: priceError } = useQuery<PriceData>({
    queryKey: ['/api/pricing'],
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

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
        // Handle specific Stripe errors
        setError(result.error.message || "Something went wrong with the payment");
        toast({
          title: "Payment Failed",
          description: result.error.message || "An error occurred during payment",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      if (!result.paymentIntent) {
        setError("No payment confirmation received from Stripe");
        toast({
          title: "Payment Not Confirmed",
          description: "We couldn't confirm your payment status. Please contact support.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Payment successful, update subscription status
      try {
        const response = await apiRequest("POST", "/api/update-premium-status", {
          paymentIntentId: result.paymentIntent.id,
          subscriptionId: subscriptionId || undefined,
        });
        
        if (!response.ok) {
          // Server error handling
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Server couldn't process the subscription");
        }
        
        // Refresh auth context to update premium status
        await refreshSubscriptionStatus();
        
        toast({
          title: "Payment Successful",
          description: "Your subscription is being processed. You'll have access to premium features soon.",
          variant: "default",
        });
        
        // Reload the page to reflect changes after a short delay to let the user see the success message
        setTimeout(() => {
          window.location.href = window.location.origin + "/account"; // Redirect to account page
        }, 1500);
      } catch (serverError) {
        console.error("Server error:", serverError);
        setError("Payment was processed but subscription couldn't be activated. Please contact support.");
        toast({
          title: "Subscription Error",
          description: "Payment succeeded but we couldn't activate your subscription. Please contact support.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError("An unexpected error occurred. Please try again or contact support.");
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
          `Subscribe for ${isPriceLoading ? '...' : priceData?.formattedPrice || '$9.99'}/${isPriceLoading ? '...' : priceData?.interval || 'month'}`
        )}
      </button>
    </form>
  );
}

// PayPal Payment component (replacing Stripe Checkout)
function PayPalPaymentOptions() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<{
    amount: string;
    currency: string;
    subscriptionType: string;
  } | null>(null);
  const { toast } = useToast();
  const { refreshSubscriptionStatus } = useAuth();
  
  useEffect(() => {
    const getPaymentInfo = async () => {
      try {
        const response = await apiRequest("POST", "/api/create-subscription", {
          subscriptionType: "monthly" // Default to monthly subscription
        });
        
        if (!response.ok) {
          // Handle specific HTTP error statuses
          if (response.status === 401) {
            throw new Error("You must be logged in to subscribe.");
          } else if (response.status === 403) {
            throw new Error("You already have an active subscription.");
          } else if (response.status >= 500) {
            throw new Error("Our payment server is experiencing issues. Please try again later.");
          }
          
          // Parse error response for more details
          try {
            const errorData = await response.json();
            throw new Error(errorData.message || "Could not create subscription");
          } catch (parseError) {
            throw new Error("Could not process payment request. Please try again.");
          }
        }
        
        const data = await response.json();
        
        if (!data.amount || !data.currency) {
          throw new Error("Invalid payment information received");
        }
        
        setPaymentInfo({
          amount: data.amount,
          currency: data.currency,
          subscriptionType: data.subscriptionType || "monthly"
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error setting up payment:", err);
        setError(err instanceof Error ? err.message : "Could not initialize payment. Please try again.");
        toast({
          title: "Payment Setup Failed",
          description: err instanceof Error ? err.message : "Could not initialize payment form. Please try again later.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };
    
    getPaymentInfo();
  }, [toast]);
  
  const handlePaymentSuccess = async (data: any) => {
    try {
      // Process successful PayPal payment
      const response = await apiRequest("POST", "/api/process-paypal-payment", {
        orderId: data.id,
        payerId: data.payer?.payer_id,
        subscriptionType: paymentInfo?.subscriptionType || "monthly"
      });
      
      if (!response.ok) {
        throw new Error("Failed to process payment");
      }
      
      const result = await response.json();
      
      // Refresh subscription status
      await refreshSubscriptionStatus();
      
      toast({
        title: "Payment Successful",
        description: "Your subscription has been activated successfully!",
        variant: "default",
      });
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Error processing PayPal payment:", err);
      toast({
        title: "Payment Processing Error",
        description: "Your payment was received but we couldn't activate your subscription. Please contact support.",
        variant: "destructive",
      });
    }
  };
  
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
  
  return (
    <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Premium Subscription</h3>
      <p className="text-sm text-gray-600 mb-5">You will be charged ${paymentInfo?.amount || '9.99'} per {paymentInfo?.subscriptionType === 'yearly' ? 'year' : 'month'}</p>
      
      {/* Temporarily disabled Stripe message */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">Note:</span> Stripe payments are temporarily unavailable. Please use PayPal for now.
          </p>
        </div>
      </div>
      
      {/* PayPal Button */}
      {paymentInfo && (
        <div className="mt-4">
          <PayPalButton 
            amount={paymentInfo.amount}
            currency={paymentInfo.currency}
            intent="CAPTURE"
            onSuccess={handlePaymentSuccess}
          />
        </div>
      )}
      
      <div className="flex justify-center mt-4">
        <button
          onClick={() => window.location.reload()}
          className="text-gray-600 text-sm hover:text-gray-900 underline"
        >
          Refresh Payment Options
        </button>
      </div>
    </div>
  );
}



// Main premium card component
export default function PremiumCard() {
  const { user, refreshSubscriptionStatus } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  
  // Handle successful PayPal payment
  const handlePaymentSuccess = async (data: any, subscriptionType: string) => {
    try {
      setIsVerifying(true);
      
      // Process successful PayPal payment
      const response = await apiRequest("POST", "/api/process-paypal-payment", {
        orderId: data.id,
        payerId: data.payer?.payer_id,
        subscriptionType: subscriptionType
      });
      
      if (!response.ok) {
        throw new Error("Failed to process payment");
      }
      
      // Refresh subscription status
      await refreshSubscriptionStatus();
      
      setIsSuccess(true);
      setIsVerifying(false);
      setIsUpgrading(false);
      
      toast({
        title: "Payment Successful",
        description: "Your subscription has been activated successfully!",
        variant: "default",
      });
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Error processing PayPal payment:", err);
      setIsVerifying(false);
      
      toast({
        title: "Payment Processing Error",
        description: "Your payment was received but we couldn't activate your subscription. Please contact support.",
        variant: "destructive",
      });
    }
  };
  
  // Check for Stripe redirect parameters
  useEffect(() => {
    const checkStripeRedirect = async () => {
      // Get URL search params
      const searchParams = new URLSearchParams(window.location.search);
      const isSuccess = searchParams.get('success') === 'true';
      const isCanceled = searchParams.get('canceled') === 'true';
      const sessionId = searchParams.get('session_id');
      
      // Clear URL params after reading
      if (isSuccess || isCanceled) {
        const currentUrl = new URL(window.location.href);
        currentUrl.search = '';
        window.history.replaceState({}, '', currentUrl.toString());
      }
      
      // If successful payment with session ID, verify with backend
      if (isSuccess && sessionId) {
        try {
          setIsVerifying(true);
          const response = await apiRequest("GET", `/api/verify-checkout-session?session_id=${sessionId}`);
          
          if (!response.ok) {
            throw new Error("Failed to verify payment");
          }
          
          const data = await response.json();
          
          // Refresh subscription status to reflect changes
          await refreshSubscriptionStatus();
          
          setIsSuccess(true);
          toast({
            title: "Payment Successful",
            description: "Your subscription has been activated successfully!",
            variant: "default",
          });
          
          // Force reload after a short delay to show the updated UI
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (err) {
          console.error("Error verifying checkout:", err);
          toast({
            title: "Verification Failed",
            description: "We couldn't verify your payment. Please contact support.",
            variant: "destructive",
          });
        } finally {
          setIsVerifying(false);
        }
      } else if (isCanceled) {
        toast({
          title: "Payment Canceled",
          description: "Your payment was canceled. No charges were made.",
          variant: "default",
        });
      }
    };
    
    checkStripeRedirect();
  }, [toast, refreshSubscriptionStatus]);
  
  // Fetch price information from Stripe
  const { data: priceData, isLoading: isPriceLoading } = useQuery<PriceData>({
    queryKey: ['/api/pricing'],
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });
  
  // Check if user has an active subscription or with a specific status other than "inactive" or "incomplete"
  if (user?.isPremium || (user?.subscriptionStatus && user.subscriptionStatus !== "" && 
      user.subscriptionStatus !== "inactive" && user.subscriptionStatus !== "incomplete")) {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg shadow-md overflow-hidden border border-primary-200">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-primary-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                {user.subscriptionStatus === "incomplete" ? "Premium (Processing)" : 
                 user.subscriptionStatus === "past_due" ? "Premium (Payment Required)" :
                 user.subscriptionStatus === "canceled" ? "Premium (Canceled)" :
                 user.subscriptionStatus === "inactive" ? "Premium (Inactive)" :
                 "Premium Member"}
              </h3>
            </div>
            
            <p className="text-sm text-gray-700">
              {user.subscriptionStatus === "active" ? (
                "You're enjoying all premium benefits including unlimited symptom analyses and complete health tracking."
              ) : user.subscriptionStatus === "incomplete" ? (
                "Your subscription payment is being processed. Premium features will be available once completed."
              ) : user.subscriptionStatus === "past_due" ? (
                "Your subscription payment has failed. Please update your payment method to continue using premium features."
              ) : user.subscriptionStatus === "canceled" ? (
                "Your subscription is canceled. You'll have access until the end of your billing period."
              ) : user.subscriptionStatus === "inactive" ? (
                "Your subscription is inactive. Please update your payment method to reactivate your premium features."
              ) : (
                "You've subscribed to premium. Enjoy unlimited symptom analyses and complete health tracking."
              )}
            </p>
            
            {/* Status badge - only show this simple indicator */}
            <div className="mt-4 inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm">
              <span className={`w-2 h-2 rounded-full mr-2 ${
                user.subscriptionStatus === "active" ? "bg-green-500" : 
                user.subscriptionStatus === "canceled" ? "bg-orange-500" : 
                user.subscriptionStatus === "incomplete" ? "bg-amber-500" :
                user.subscriptionStatus === "past_due" ? "bg-red-500" :
                user.subscriptionStatus === "inactive" ? "bg-blue-500" :
                "bg-gray-500"
              }`}></span>
              <span className={`text-xs font-medium ${
                user.subscriptionStatus === "active" ? "text-green-700" : 
                user.subscriptionStatus === "canceled" ? "text-orange-700" : 
                user.subscriptionStatus === "incomplete" ? "text-amber-700" :
                user.subscriptionStatus === "past_due" ? "text-red-700" :
                user.subscriptionStatus === "inactive" ? "text-blue-700" :
                "text-gray-700"
              }`}>
                {user.subscriptionStatus === "active" ? "Active" : 
                user.subscriptionStatus === "canceled" ? "Canceled" :
                user.subscriptionStatus === "incomplete" ? "Incomplete" :
                user.subscriptionStatus === "past_due" ? "Past Due" :
                user.subscriptionStatus === "inactive" ? "Inactive" :
                user.subscriptionStatus || "Unknown"}
              </span>
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
        title: "Payment Successful (Demo)",
        description: "Your subscription is being processed. You'll have access to premium features soon.",
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
  
  // Show loading state when verifying checkout session
  if (isVerifying) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 flex flex-col items-center justify-center py-10">
          <Loader className="h-10 w-10 animate-spin text-primary-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Verifying Your Payment</h3>
          <p className="text-sm text-gray-600 text-center">
            We're confirming your subscription payment with our payment provider.
            This should only take a moment...
          </p>
        </div>
      </div>
    );
  }
  
  // Show success message after verification
  if (isSuccess) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h3>
          <p className="text-sm text-gray-600 text-center max-w-md mb-4">
            Thank you for subscribing to Premium! Your payment has been processed successfully. 
            You now have unlimited access to all premium features.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Show special message for incomplete subscription
  if (user?.subscriptionStatus === "incomplete") {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="h-6 w-6 text-amber-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Incomplete Subscription</h3>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
              Your subscription payment is incomplete. You need to add a payment method to complete your subscription.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="mt-4">
              <button 
                onClick={() => setIsUpgrading(true)}
                className="bg-blue-600 text-white py-2.5 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center justify-center w-full"
              >
                Complete Payment
                <CreditCard className="ml-2 h-4 w-4" />
              </button>
            </div>
            
            <div className="flex items-center justify-center mt-2">
              <button 
                onClick={() => window.location.reload()}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Refresh status
              </button>
            </div>
          </div>
        </div>
        
        {isUpgrading && (
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-medium text-gray-900">Complete Your Payment</h4>
              <button 
                onClick={() => setIsUpgrading(false)}
                className="text-gray-600 text-sm hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
            
            <div className="mt-4">
              {/* Monthly Subscription Option */}
              <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-900">Monthly Subscription</h3>
                  <span className="font-semibold text-primary-900">$9.99/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Get unlimited symptom analyses and health tracking. Cancel anytime.</p>
                <PayPalButton 
                  amount="9.99"
                  currency="USD"
                  intent="CAPTURE"
                  onSuccess={(data) => handlePaymentSuccess(data, "monthly")}
                />
              </div>
              
              {/* Yearly Subscription Option */}
              <div className="p-4 border border-primary-200 rounded-lg bg-primary-50">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">Yearly Subscription</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">
                      Save 16%
                    </span>
                  </div>
                  <span className="font-semibold text-primary-900">$50.00/year</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Best value! Get unlimited symptom analyses and health tracking for a full year.</p>
                <PayPalButton 
                  amount="50.00"
                  currency="USD"
                  intent="CAPTURE"
                  onSuccess={(data) => handlePaymentSuccess(data, "yearly")}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        {isUpgrading ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-medium text-gray-900">Complete Your Payment</h4>
              <button 
                onClick={() => setIsUpgrading(false)}
                className="text-gray-600 text-sm hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
            
            {/* PayPal Payment Options */}
            <div className="mt-4">
              {/* Payment options heading */}
              <div className="mb-4">
                <h3 className="text-base font-medium text-gray-800">Choose your payment method</h3>
                <div className="mt-2 flex">
                  <div className="px-3 py-1.5 bg-blue-50 rounded-l-md border border-blue-200 border-r-0 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 33" width="82" height="22" className="mr-1">
                      <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.694-1.746-4.985-1.746z" fill="#003087"/>
                      <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.694-1.746-4.985-1.746z" fill="#003087"/>
                      <path d="M53.867 13.417c-.377 2.208-2.276 3.695-4.674 3.695H47.42l.79-4.992h1.657c1.234 0 2.4.34 2.761 1.529.165.596.126 1.1-.76 1.768z" fill="#3086C8"/>
                      <path d="M53.867 13.417c-.377 2.208-2.276 3.695-4.674 3.695H47.42l.79-4.992h1.657c1.234 0 2.4.34 2.761 1.529.165.596.126 1.1-.76 1.768z" fill="#3086C8"/>
                      <path d="M95.863 5.858h-4.066c-.276 0-.514.199-.558.47l-1.642 10.378-.48.303-1.903-10.367a.949.949 0 0 0-.938-.784h-4c-.482 0-.802.505-.692.96l3.272 17.61c.097.52.562.898 1.088.898H90.8c.276 0 .514-.199.558-.47l3.288-20.844a.567.567 0 0 0-.783-.154z" fill="#003087"/>
                      <path d="M106.732 6.182a8.05 8.05 0 0 0-4.15-1.15c-4.662 0-7.95 3.57-7.950 7.95 0 3.683 2.713 5.17 4.794 6.275l.999.584c1.665.95 2.218 1.55 1.81 2.696-.38 1.096-1.526 1.825-3.048 1.825-1.974 0-2.835-.657-4.418-2.236a.955.955 0 0 0-1.338.073l-1.513 1.703a.75.75 0 0 0 .006 1.06c1.61 1.805 3.817 2.887 7.22 2.887 4.764 0 8.177-3.539 8.177-8.011 0-3.046-1.77-5.117-5.253-6.978l-1.317-.713c-1.537-.823-2.16-1.354-1.88-2.444.264-1.016 1.26-1.728 2.814-1.728 1.491 0 2.617.654 3.556 1.936a.957.957 0 0 0 1.318.267l1.68-1.03a.75.75 0 0 0 .25-1.003 9.29 9.29 0 0 0-1.757-1.973z" fill="#003087"/>
                      <path d="M37.059 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.97-1.142-2.692-1.746-4.983-1.746z" fill="#009cde"/>
                      <path d="M37.059 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.97-1.142-2.692-1.746-4.983-1.746z" fill="#009cde"/>
                      <path d="M44.717 13.417c-.377 2.208-2.278 3.695-4.675 3.695h-1.773l.788-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#012169"/>
                      <path d="M44.717 13.417c-.377 2.208-2.278 3.695-4.675 3.695h-1.773l.788-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#012169"/>
                      <path d="M39.322 19.466a.626.626 0 0 0 .618-.443l.143-.674.101-.466.071.381c.106.573.587.989 1.17.989h.692c.9 0 1.667-.676 1.764-1.569a.626.626 0 0 0-.619-.753h-.62a.625.625 0 0 0-.618.443l-.115.529-.025-.118c-.088-.42-.507-.854-1.196-.854h-.58c-.863 0-1.58.648-1.666 1.518a.626.626 0 0 0 .62.753l.86.264z" fill="#001e53"/>
                      <path d="M13.439 18.187l-.76 4.826a.57.57 0 0 0 .563.658h2.85c.47 0 .87-.343.94-.806l.748-4.727a.57.57 0 0 0-.562-.659h-3.214a.57.57 0 0 0-.565.708z" fill="#001c64"/>
                      <path d="M20.979 6.749h-6.84a.95.95 0 0 0-.939.802l-2.766 17.537a.569.569 0 0 0 .563.658h3.513a.95.95 0 0 0 .94-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.692-1.746-4.982-1.746z" fill="#001e63"/>
                      <path d="M20.979 6.749h-6.84a.95.95 0 0 0-.939.802l-2.766 17.537a.569.569 0 0 0 .563.658h3.513a.95.95 0 0 0 .94-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.692-1.746-4.982-1.746z" fill="#001e63"/>
                      <path d="M28.635 13.417c-.377 2.208-2.276 3.695-4.675 3.695h-1.772l.787-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#00aae1"/>
                      <path d="M28.635 13.417c-.377 2.208-2.276 3.695-4.675 3.695h-1.772l.787-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#00aae1"/>
                      <path d="M82.351 5.908c-.453-.52-1.21-.774-2.242-.774h-6.022a1.23 1.23 0 0 0-1.213 1.016l-1.723 10.908a.744.744 0 0 0 .733.85h3.017c.36 0 .576-.18.633-.36.01-.033 1.702-10.778 1.702-10.778h2.324c.633 0 .814.256.773.633-.41.383-.453 2.05-.453 2.05h2.097c1.773 0 2.833-.754 3.106-2.39.18-1.106-.032-1.62-.732-2.155zm25.131.182a4.985 4.985 0 0 0-4.982 4.982 4.153 4.153 0 0 0 4.152 4.152 4.414 4.414 0 0 0 3.986-6.271 5.117 5.117 0 0 0-3.156-2.863zm1.109 5.4a1.681 1.681 0 0 1-1.681 1.681 1.982 1.982 0 0 1-1.982-1.982 1.681 1.681 0 0 1 1.681-1.681 1.982 1.982 0 0 1 1.982 1.982zm-12.52-5.582h-3.194a.95.95 0 0 0-.938.802l-2.766 17.537a.57.57 0 0 0 .563.658h3.148a.665.665 0 0 0 .656-.562l.748-4.742a.949.949 0 0 1 .937-.802h1.012c3.984 0 6.279-1.93 6.874-5.75.275-1.67.01-2.983-.77-3.91-.853-1.01-2.367-1.543-4.27-1.543v.312zm.593 5.72c-.331 2.185-1.99 2.185-3.596 2.185h-.915l.644-4.086a.57.57 0 0 1 .562-.486h.42c1.093 0 2.122 0 2.654.622.318.37.415.917.23 1.765zm-58.096-.138c-.453-.52-1.21-.774-2.242-.774h-6.022a1.23 1.23 0 0 0-1.213 1.016l-1.723 10.908a.744.744 0 0 0 .733.85h2.858c.423 0 .784-.308.85-.727l.83-5.256a.95.95 0 0 1 .937-.802h1.904c3.984 0 6.28-1.93 6.874-5.75.275-1.67.01-2.983-.77-3.91-.853-1.01-2.367-1.543-4.27-1.543h-4.982a1.23 1.23 0 0 0-1.213 1.016l-1.723 10.908a.744.744 0 0 0 .733.85h2.858c.423 0 .784-.308.85-.727l.83-5.256a.95.95 0 0 1 .937-.802h1.904c3.984 0 6.28-1.93 6.874-5.75.275-1.67.01-2.983-.77-3.91-.853-1.01-2.367-1.543-4.27-1.543h.02zm.593 5.72c-.331 2.185-1.99 2.185-3.596 2.185h-.915l.644-4.086a.57.57 0 0 1 .562-.486h.42c1.093 0 2.122 0 2.654.622.318.37.415.917.23 1.765zm14.353-5.72c-.453-.52-1.21-.774-2.242-.774h-6.022a1.23 1.23 0 0 0-1.213 1.016l-1.723 10.908a.744.744 0 0 0 .733.85h2.858c.423 0 .784-.308.85-.727l.83-5.256a.95.95 0 0 1 .937-.802h1.904c3.984 0 6.28-1.93 6.874-5.75.275-1.67.01-2.983-.77-3.91-.853-1.01-2.367-1.543-4.27-1.543h-4.982a1.23 1.23 0 0 0-1.213 1.016l-1.723 10.908a.744.744 0 0 0 .733.85h2.858c.423 0 .784-.308.85-.727l.83-5.256a.95.95 0 0 1 .937-.802h1.904c3.984 0 6.28-1.93 6.874-5.75.275-1.67.01-2.983-.77-3.91-.853-1.01-2.367-1.543-4.27-1.543h.02zm.593 5.72c-.331 2.185-1.99 2.185-3.596 2.185h-.915l.644-4.086a.57.57 0 0 1 .562-.486h.42c1.093 0 2.122 0 2.654.622.318.37.415.917.23 1.765z" fill="#001c64"/>
                    </svg>
                  </div>
                  <div 
                    className="px-3 py-1.5 bg-gray-100 rounded-r-md border border-gray-200 flex items-center cursor-pointer"
                    onClick={() => {
                      toast({
                        title: "Stripe Coming Soon",
                        description: "Credit card payments with Stripe will be available soon. Please use PayPal for now.",
                        variant: "default",
                      });
                    }}
                  >
                    <svg width="60" height="25" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 mr-1">
                      <path fillRule="evenodd" clipRule="evenodd" d="M59.5569 10.6422C59.5569 7.18793 57.4066 4.49722 54.3608 4.49722C51.3033 4.49722 49.1529 7.18793 49.1529 10.6306C49.1529 14.701 51.8379 16.7758 54.9652 16.7758C56.6512 16.7758 57.9602 16.344 58.9016 15.6995V12.6975C57.9602 13.2592 56.8 13.6209 55.4911 13.6209C54.0124 13.6209 52.7446 13.0708 52.5677 11.6325H59.5338C59.5338 11.4402 59.5569 10.9367 59.5569 10.6422ZM52.5331 8.95309C52.5331 7.51482 53.5322 7.0113 54.3493 7.0113C55.1432 7.0113 56.0731 7.51482 56.0731 8.95309H52.5331Z" fill="#6772E5"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M44.111 4.49722C42.5719 4.49722 41.5381 5.22487 40.9683 5.68995L40.7914 4.72833H38.2147V20.6076L41.1617 19.9167L41.1733 15.7925C41.755 16.1889 42.63 16.5738 43.7787 16.5738C46.0674 16.5738 48.0655 14.8163 48.0655 10.4615C48.0539 6.57644 46.0327 4.49722 44.111 4.49722ZM43.2965 13.6093C42.4218 13.6093 41.8636 13.3611 41.5034 13.0666L41.4918 8.05988C41.8752 7.73071 42.4449 7.49414 43.2965 7.49414C44.5246 7.49414 45.2148 8.73649 45.2148 10.5429C45.2148 12.3957 44.5361 13.6093 43.2965 13.6093Z" fill="#6772E5"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M35.0533 2.15642L31.9612 2.82415V16.3603H35.0533V2.15642Z" fill="#6772E5"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M27.8891 7.14809L27.666 4.7168H24.8971V16.3487H27.9814V9.03622C28.724 7.98621 30.1326 8.15539 30.6332 8.31298V4.7168C30.1211 4.54761 28.6659 4.28637 27.8891 7.14809Z" fill="#6772E5"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M20.7827 1.72461L17.7715 2.40393L17.760 16.3602H20.7827V1.72461Z" fill="#6772E5"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M14.8988 7.04886C14.8988 6.48715 15.3675 6.2506 16.0808 6.2506C17.0684 6.2506 18.36 6.61292 19.3592 7.23043V4.2663C18.2799 3.83438 17.2116 3.62094 16.0808 3.62094C13.6042 3.62094 11.7823 5.08236 11.7823 7.22887C11.7823 10.501 16.1154 9.94086 16.1154 11.6289C16.1154 12.2836 15.5109 12.5318 14.7516 12.5318C13.6734 12.5318 12.2178 11.9701 11.1153 11.2675V14.2665C12.3434 14.8166 13.5946 15.0764 14.7516 15.0764C17.294 15.0764 19.2343 13.6382 19.2343 11.466C19.2343 7.89787 14.8988 8.58877 14.8988 7.04886Z" fill="#6772E5"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M3.85161 10.6422C3.85161 7.18793 6.00197 4.49722 9.04781 4.49722C12.1052 4.49722 14.2556 7.18793 14.2556 10.6306C14.2556 14.701 11.5706 16.7758 8.44329 16.7758C6.75732 16.7758 5.44828 16.344 4.50693 15.6995V12.6975C5.44828 13.2592 6.60846 13.6209 7.91749 13.6209C9.39618 13.6209 10.6639 13.0708 10.8408 11.6325H3.87474C3.87474 11.4402 3.85161 10.9367 3.85161 10.6422ZM10.8754 8.95309C10.8754 7.51482 9.87631 7.0113 9.05937 7.0113C8.26541 7.0113 7.33562 7.51482 7.33562 8.95309H10.8754Z" fill="#6772E5"/>
                      <path d="M59.5569 10.6422C59.5569 7.18793 57.4066 4.49722 54.3608 4.49722C51.3033 4.49722 49.1529 7.18793 49.1529 10.6306C49.1529 14.701 51.8379 16.7758 54.9652 16.7758C56.6512 16.7758 57.9602 16.344 58.9016 15.6995V12.6975C57.9602 13.2592 56.8 13.6209 55.4911 13.6209C54.0124 13.6209 52.7446 13.0708 52.5677 11.6325H59.5338C59.5338 11.4402 59.5569 10.9367 59.5569 10.6422ZM52.5331 8.95309C52.5331 7.51482 53.5322 7.0113 54.3493 7.0113C55.1432 7.0113 56.0731 7.51482 56.0731 8.95309H52.5331Z" stroke="#6772E5" strokeWidth="0.497327"/>
                    </svg>
                    <span className="text-sm text-gray-500">Stripe (Soon)</span>
                  </div>
                </div>
              </div>
              
              {/* Monthly Subscription Option */}
              <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-900">Monthly Subscription</h3>
                  <span className="font-semibold text-primary-900">$9.99/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Get unlimited symptom analyses and health tracking. Cancel anytime.</p>
                <PayPalButton 
                  amount="9.99"
                  currency="USD"
                  intent="CAPTURE"
                  onSuccess={(data) => handlePaymentSuccess(data, "monthly")}
                />
              </div>
              
              {/* Yearly Subscription Option */}
              <div className="p-4 border border-primary-200 rounded-lg bg-primary-50">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">Yearly Subscription</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">
                      Save 16%
                    </span>
                  </div>
                  <span className="font-semibold text-primary-900">$50.00/year</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Best value! Get unlimited symptom analyses and health tracking for a full year.</p>
                <PayPalButton 
                  amount="50.00"
                  currency="USD"
                  intent="CAPTURE"
                  onSuccess={(data) => handlePaymentSuccess(data, "yearly")}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Explore Premium Features</h3>
            
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
                <span className="text-primary-900 font-semibold">$9.99/month <span className="text-gray-500 text-xs">or $50/year</span></span>
              </div>
            </div>
            
            {/* Upgrade message with PayPal vs Stripe info */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Note:</span> Stripe payments are temporarily unavailable. Please use PayPal for now.
                </p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* PayPal Button - Primary Option */}
              <button 
                onClick={() => setIsUpgrading(true)}
                className="bg-blue-600 text-white py-2.5 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center justify-center w-full"
                disabled={isUpgrading}
              >
                {isUpgrading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Preparing Checkout...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 33" width="62" height="16" className="mr-2">
                      <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.694-1.746-4.985-1.746z" fill="#ffffff"/>
                      <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.694-1.746-4.985-1.746z" fill="#ffffff"/>
                      <path d="M53.867 13.417c-.377 2.208-2.276 3.695-4.674 3.695H47.42l.79-4.992h1.657c1.234 0 2.4.34 2.761 1.529.165.596.126 1.1-.76 1.768z" fill="#ffffff"/>
                      <path d="M53.867 13.417c-.377 2.208-2.276 3.695-4.674 3.695H47.42l.79-4.992h1.657c1.234 0 2.4.34 2.761 1.529.165.596.126 1.1-.76 1.768z" fill="#ffffff"/>
                      <path d="M95.863 5.858h-4.066c-.276 0-.514.199-.558.47l-1.642 10.378-.48.303-1.903-10.367a.949.949 0 0 0-.938-.784h-4c-.482 0-.802.505-.692.96l3.272 17.61c.097.52.562.898 1.088.898H90.8c.276 0 .514-.199.558-.47l3.288-20.844a.567.567 0 0 0-.783-.154z" fill="#ffffff"/>
                      <path d="M106.732 6.182a8.05 8.05 0 0 0-4.15-1.15c-4.662 0-7.95 3.57-7.950 7.95 0 3.683 2.713 5.17 4.794 6.275l.999.584c1.665.95 2.218 1.55 1.81 2.696-.38 1.096-1.526 1.825-3.048 1.825-1.974 0-2.835-.657-4.418-2.236a.955.955 0 0 0-1.338.073l-1.513 1.703a.75.75 0 0 0 .006 1.06c1.61 1.805 3.817 2.887 7.22 2.887 4.764 0 8.177-3.539 8.177-8.011 0-3.046-1.77-5.117-5.253-6.978l-1.317-.713c-1.537-.823-2.16-1.354-1.88-2.444.264-1.016 1.26-1.728 2.814-1.728 1.491 0 2.617.654 3.556 1.936a.957.957 0 0 0 1.318.267l1.68-1.03a.75.75 0 0 0 .25-1.003 9.29 9.29 0 0 0-1.757-1.973z" fill="#ffffff"/>
                      <path d="M37.059 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.97-1.142-2.692-1.746-4.983-1.746z" fill="#ffffff"/>
                      <path d="M37.059 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.97-1.142-2.692-1.746-4.983-1.746z" fill="#ffffff"/>
                      <path d="M44.717 13.417c-.377 2.208-2.278 3.695-4.675 3.695h-1.773l.788-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#ffffff"/>
                      <path d="M44.717 13.417c-.377 2.208-2.278 3.695-4.675 3.695h-1.773l.788-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#ffffff"/>
                      <path d="M20.979 6.749h-6.84a.95.95 0 0 0-.939.802l-2.766 17.537a.569.569 0 0 0 .563.658h3.513a.95.95 0 0 0 .94-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.692-1.746-4.982-1.746z" fill="#ffffff"/>
                      <path d="M20.979 6.749h-6.84a.95.95 0 0 0-.939.802l-2.766 17.537a.569.569 0 0 0 .563.658h3.513a.95.95 0 0 0 .94-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.692-1.746-4.982-1.746z" fill="#ffffff"/>
                      <path d="M28.635 13.417c-.377 2.208-2.276 3.695-4.675 3.695h-1.772l.787-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#ffffff"/>
                      <path d="M28.635 13.417c-.377 2.208-2.276 3.695-4.675 3.695h-1.772l.787-4.992h1.658c1.234 0 2.4.34 2.762 1.529.16.596.12 1.1-.76 1.768z" fill="#ffffff"/>
                    </svg>
                    Pay with PayPal
                  </>
                )}
              </button>
              
              {/* Stripe Button - Greyed Out with Popup */}
              <button 
                onClick={() => {
                  toast({
                    title: "Stripe Coming Soon",
                    description: "Credit card payments with Stripe will be available soon. Please use PayPal for now.",
                    variant: "default",
                  });
                }}
                className="bg-gray-200 text-gray-600 py-2.5 px-4 rounded-md font-medium hover:bg-gray-300 transition-colors flex items-center justify-center w-full relative"
              >
                <svg width="40" height="16" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 mr-1">
                  <path fillRule="evenodd" clipRule="evenodd" d="M59.5569 10.6422C59.5569 7.18793 57.4066 4.49722 54.3608 4.49722C51.3033 4.49722 49.1529 7.18793 49.1529 10.6306C49.1529 14.701 51.8379 16.7758 54.9652 16.7758C56.6512 16.7758 57.9602 16.344 58.9016 15.6995V12.6975C57.9602 13.2592 56.8 13.6209 55.4911 13.6209C54.0124 13.6209 52.7446 13.0708 52.5677 11.6325H59.5338C59.5338 11.4402 59.5569 10.9367 59.5569 10.6422ZM52.5331 8.95309C52.5331 7.51482 53.5322 7.0113 54.3493 7.0113C55.1432 7.0113 56.0731 7.51482 56.0731 8.95309H52.5331Z" fill="#6B7280"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M44.111 4.49722C42.5719 4.49722 41.5381 5.22487 40.9683 5.68995L40.7914 4.72833H38.2147V20.6076L41.1617 19.9167L41.1733 15.7925C41.755 16.1889 42.63 16.5738 43.7787 16.5738C46.0674 16.5738 48.0655 14.8163 48.0655 10.4615C48.0539 6.57644 46.0327 4.49722 44.111 4.49722ZM43.2965 13.6093C42.4218 13.6093 41.8636 13.3611 41.5034 13.0666L41.4918 8.05988C41.8752 7.73071 42.4449 7.49414 43.2965 7.49414C44.5246 7.49414 45.2148 8.73649 45.2148 10.5429C45.2148 12.3957 44.5361 13.6093 43.2965 13.6093Z" fill="#6B7280"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M35.0533 2.15642L31.9612 2.82415V16.3603H35.0533V2.15642Z" fill="#6B7280"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M27.8891 7.14809L27.666 4.7168H24.8971V16.3487H27.9814V9.03622C28.724 7.98621 30.1326 8.15539 30.6332 8.31298V4.7168C30.1211 4.54761 28.6659 4.28637 27.8891 7.14809Z" fill="#6B7280"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M20.7827 1.72461L17.7715 2.40393L17.760 16.3602H20.7827V1.72461Z" fill="#6B7280"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M14.8988 7.04886C14.8988 6.48715 15.3675 6.2506 16.0808 6.2506C17.0684 6.2506 18.36 6.61292 19.3592 7.23043V4.2663C18.2799 3.83438 17.2116 3.62094 16.0808 3.62094C13.6042 3.62094 11.7823 5.08236 11.7823 7.22887C11.7823 10.501 16.1154 9.94086 16.1154 11.6289C16.1154 12.2836 15.5109 12.5318 14.7516 12.5318C13.6734 12.5318 12.2178 11.9701 11.1153 11.2675V14.2665C12.3434 14.8166 13.5946 15.0764 14.7516 15.0764C17.294 15.0764 19.2343 13.6382 19.2343 11.466C19.2343 7.89787 14.8988 8.58877 14.8988 7.04886Z" fill="#6B7280"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.85161 10.6422C3.85161 7.18793 6.00197 4.49722 9.04781 4.49722C12.1052 4.49722 14.2556 7.18793 14.2556 10.6306C14.2556 14.701 11.5706 16.7758 8.44329 16.7758C6.75732 16.7758 5.44828 16.344 4.50693 15.6995V12.6975C5.44828 13.2592 6.60846 13.6209 7.91749 13.6209C9.39618 13.6209 10.6639 13.0708 10.8408 11.6325H3.87474C3.87474 11.4402 3.85161 10.9367 3.85161 10.6422ZM10.8754 8.95309C10.8754 7.51482 9.87631 7.0113 9.05937 7.0113C8.26541 7.0113 7.33562 7.51482 7.33562 8.95309H10.8754Z" fill="#6B7280"/>
                  <path d="M59.5569 10.6422C59.5569 7.18793 57.4066 4.49722 54.3608 4.49722C51.3033 4.49722 49.1529 7.18793 49.1529 10.6306C49.1529 14.701 51.8379 16.7758 54.9652 16.7758C56.6512 16.7758 57.9602 16.344 58.9016 15.6995V12.6975C57.9602 13.2592 56.8 13.6209 55.4911 13.6209C54.0124 13.6209 52.7446 13.0708 52.5677 11.6325H59.5338C59.5338 11.4402 59.5569 10.9367 59.5569 10.6422ZM52.5331 8.95309C52.5331 7.51482 53.5322 7.0113 54.3493 7.0113C55.1432 7.0113 56.0731 7.51482 56.0731 8.95309H52.5331Z" stroke="#6B7280" strokeWidth="0.497327"/>
                </svg>
                Pay with Stripe
                <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}