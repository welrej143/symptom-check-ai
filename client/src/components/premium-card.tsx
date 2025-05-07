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

// Import payment logos
import paypalLogo from "../assets/paypal_icon.png";
import stripeLogo from "../assets/stripe_logo.png";

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
      <p className="text-sm text-gray-600 mb-5">You will be charged ${paymentInfo?.amount || '9.99'} per month</p>
      
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
  
  // Define payment methods type
  interface PaymentMethods {
    stripe: boolean;
    paypal: boolean;
    mode: 'sandbox' | 'live';
  }

  // Default payment methods state
  const defaultPaymentMethods: PaymentMethods = {
    stripe: false,
    paypal: true,
    mode: 'sandbox'
  };
  
  // Fetch available payment methods
  const { data: paymentMethods = defaultPaymentMethods } = useQuery<PaymentMethods>({
    queryKey: ['/api/payment-methods'],
    staleTime: 60000, // 1 minute cache
  });
  
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
  
  // Check if user has an active subscription
  if (user?.isPremium) {
    return <SubscriptionManager user={user} refreshSubscriptionStatus={refreshSubscriptionStatus} />;
  }
  
  // Show verification message if payment is being verified
  if (isVerifying) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-primary-100 p-6">
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
          <Loader className="h-10 w-10 animate-spin text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900 mt-4">Verifying Payment</h3>
          <p className="text-gray-600 max-w-md">
            We're processing your payment and activating your subscription. This might take a moment...
          </p>
        </div>
      </div>
    );
  }
  
  // Show success message if payment was successful
  if (isSuccess) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-green-100 p-6">
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
          <div className="bg-green-100 p-3 rounded-full">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mt-4">Payment Successful!</h3>
          <p className="text-gray-600 max-w-md">
            Your subscription has been activated successfully. You now have access to all premium features!
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        {isUpgrading ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Complete Subscription</h3>
              <button 
                onClick={() => setIsUpgrading(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
            
            {/* Payment method selection */}
            <div className="mb-6">
              {/* Payment options heading */}
              <div className="mb-4">
                <h3 className="text-base font-medium text-gray-800">Choose your payment method</h3>
                <div className="mt-2 flex">
                  {paymentMethods?.paypal ? (
                    <div className="px-3 py-1.5 bg-blue-50 rounded-l-md border border-blue-200 border-r-0 flex items-center">
                      <div className="h-6 w-6 mr-1.5 flex items-center justify-center">
                        <img src={paypalLogo} alt="PayPal" className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium text-blue-800">PayPal</span>
                      {paymentMethods?.mode === 'sandbox' && (
                        <span className="ml-1 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                          Test Mode
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-gray-100 rounded-l-md border border-gray-200 border-r-0 flex items-center opacity-50">
                      <div className="h-6 w-6 mr-1.5 flex items-center justify-center">
                        <img src={paypalLogo} alt="PayPal" className="h-5 w-5" />
                      </div>
                      <span className="text-sm text-gray-500">PayPal</span>
                    </div>
                  )}
                  
                  {paymentMethods?.stripe ? (
                    <div className="px-3 py-1.5 bg-purple-50 rounded-r-md border border-purple-200 flex items-center">
                      <img src={stripeLogo} alt="Stripe" className="h-5 w-5 mr-1.5" />
                      <span className="text-sm font-medium text-purple-800">Stripe</span>
                    </div>
                  ) : (
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
                      <img src={stripeLogo} alt="Stripe" className="h-5 w-5 mr-1.5" style={{ opacity: 0.7 }} />
                      <span className="text-sm text-gray-500">Stripe (Soon)</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Premium Subscription Option */}
              <div className="p-4 border border-primary-200 rounded-lg bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-900">Premium Subscription</h3>
                  <span className="font-semibold text-primary-900">$9.99/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Get unlimited symptom analyses and health tracking. Cancel anytime.</p>
                {paymentMethods?.paypal ? (
                  <PayPalButton 
                    amount="9.99"
                    currency="USD"
                    intent="CAPTURE"
                    onSuccess={(data) => handlePaymentSuccess(data, "monthly")}
                  />
                ) : (
                  <div className="p-3 text-center bg-gray-100 rounded-md text-gray-600 text-sm">
                    PayPal payments are currently unavailable. Please try again later.
                  </div>
                )}
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
                <span className="text-primary-900 font-semibold">$9.99/month</span>
              </div>
            </div>
            
            {/* Upgrade message based on payment methods */}
            {!paymentMethods?.paypal && !paymentMethods?.stripe && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Note:</span> All payment methods are currently unavailable. Please try again later.
                  </p>
                </div>
              </div>
            )}
            
            {paymentMethods?.paypal && !paymentMethods?.stripe && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Note:</span> Stripe payments are temporarily unavailable. Please use PayPal for now.
                  </p>
                </div>
              </div>
            )}
            
            {paymentMethods?.stripe && !paymentMethods?.paypal && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Note:</span> PayPal payments are temporarily unavailable. Please use Stripe for now.
                  </p>
                </div>
              </div>
            )}
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* PayPal Button - Only shows when enabled */}
              {paymentMethods?.paypal ? (
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
                      <div className="h-5 w-5 mr-2 bg-white rounded-sm flex items-center justify-center">
                        <img src={paypalLogo} alt="PayPal" className="h-4 w-4" />
                      </div>
                      Pay with PayPal
                      {paymentMethods.mode === 'sandbox' && (
                        <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                          Test
                        </span>
                      )}
                    </>
                  )}
                </button>
              ) : (
                <button 
                  className="bg-gray-200 text-gray-500 py-2.5 px-4 rounded-md font-medium flex items-center justify-center w-full opacity-60 cursor-not-allowed"
                  disabled={true}
                >
                  <div className="h-5 w-5 mr-2 bg-white rounded-sm flex items-center justify-center">
                    <img src={paypalLogo} alt="PayPal" className="h-4 w-4 opacity-50" />
                  </div>
                  PayPal Unavailable
                </button>
              )}
              
              {/* Stripe Button - Only shows when enabled */}
              {paymentMethods?.stripe ? (
                <button 
                  onClick={async () => {
                    toast({
                      title: "Stripe Checkout",
                      description: "Starting Stripe checkout process...",
                      variant: "default",
                    });
                    try {
                      setIsUpgrading(true);
                      // Create a checkout session on the server
                      const response = await apiRequest("POST", "/api/create-subscription", {
                        subscriptionType: "monthly"
                      });
                      
                      if (!response.ok) {
                        throw new Error("Failed to start checkout");
                      }
                      
                      const data = await response.json();
                      
                      if (!data.sessionId) {
                        throw new Error("Invalid response from server");
                      }
                      
                      // Redirect to Stripe Checkout
                      window.location.href = data.url;
                    } catch (error) {
                      console.error("Stripe checkout error:", error);
                      setIsUpgrading(false);
                      toast({
                        title: "Checkout Error",
                        description: error instanceof Error ? error.message : "Failed to start checkout process",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="bg-purple-600 text-white py-2.5 px-4 rounded-md font-medium hover:bg-purple-700 transition-colors flex items-center justify-center w-full"
                >
                  <img src={stripeLogo} alt="Stripe" className="h-5 w-5 mr-2 bg-white rounded-sm p-0.5" />
                  Pay with Stripe
                </button>
              ) : (
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
                  <img src={stripeLogo} alt="Stripe" className="h-5 w-5 mr-2" style={{ opacity: 0.7 }} />
                  Pay with Stripe
                  <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    Soon
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}