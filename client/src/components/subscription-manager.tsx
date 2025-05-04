import { useState, useEffect } from "react";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  Calendar, 
  CalendarClock,
  CheckCircle2, 
  XCircle, 
  Loader, 
  RefreshCw, 
  AlertCircle
} from "lucide-react";

interface SubscriptionManagerProps {
  user: User;
  refreshSubscriptionStatus: () => Promise<void>;
}

export default function SubscriptionManager({ user, refreshSubscriptionStatus }: SubscriptionManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const { toast } = useToast();
  
  // Check URL parameters for payment_updated flag
  useEffect(() => {
    const checkUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentUpdated = urlParams.get('payment_updated');
      
      if (paymentUpdated === 'true') {
        // Remove the query parameter to prevent showing the message on refresh
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // Show success message
        toast({
          title: "Payment Method Updated",
          description: "Your payment method has been successfully updated. Your subscription status will be updated shortly.",
          variant: "default",
        });
        
        // Refresh subscription status to get the latest data
        await refreshSubscriptionStatus();
      } else if (paymentUpdated === 'false') {
        // Remove the query parameter
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // Show failure message
        toast({
          title: "Payment Update Canceled",
          description: "Payment method update was canceled. Your subscription status remains unchanged.",
          variant: "default",
        });
      }
    };
    
    checkUrlParams();
  }, [toast, refreshSubscriptionStatus]);
  
  // Format subscription end date
  const formattedEndDate = user.subscriptionEndDate 
    ? new Date(user.subscriptionEndDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Not available';
  
  // Format subscription start date - using account creation date as a fallback
  const formattedStartDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Not available';
    
  // Calculate days until renewal
  const daysUntilRenewal = user.subscriptionEndDate 
    ? Math.max(0, Math.ceil((new Date(user.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
    
  // Handle cancellation of subscription
  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll still have access until the end of your billing period.")) {
      return;
    }
    
    setIsCanceling(true);
    
    try {
      const response = await apiRequest("POST", "/api/cancel-subscription");
      
      if (response.ok) {
        const data = await response.json();
        await refreshSubscriptionStatus();
        toast({
          title: "Subscription Canceled",
          description: data.message || "Your subscription has been canceled. You'll have access until the end of your billing period.",
          variant: "default",
        });
      } else {
        // Parse error response
        let errorMessage = "Failed to cancel subscription";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          console.error("Error parsing response:", parseError);
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      // Network or other unexpected errors
      toast({
        title: "Connection Error",
        description: "Could not connect to subscription service. Please check your internet connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
    }
  };
  
  // Handle updating payment method
  const handleUpdatePaymentMethod = async () => {
    setIsLoading(true);
    try {
      // Request an update payment method link from the server
      const response = await apiRequest("GET", "/api/payment-method-update");
      
      if (!response.ok) {
        throw new Error("Failed to get payment update link");
      }
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe's hosted update payment form
        window.location.href = data.url;
      } else {
        toast({
          title: "Payment Update",
          description: "Cannot update payment method at this time. Please try again later.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error updating payment method:", error);
      toast({
        title: "Error",
        description: "Unable to update payment method at this time",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-primary-600" />
            Subscription Details
          </h3>
          
          {user.subscriptionStatus === "incomplete" && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Payment Processing:</strong> Your subscription payment is being processed. This may take a few moments to complete.
                  If your subscription remains in this state, you may need to update your payment method or complete the payment process.
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-1">
                  <AlertCircle className="h-4 w-4 mr-1.5 text-gray-500 flex-shrink-0" />
                  <div className="text-sm text-gray-500">Status</div>
                </div>
                <div className="font-medium flex items-center">
                  {user.subscriptionStatus === "active" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-green-700">Active</span>
                    </>
                  ) : user.subscriptionStatus === "canceled" ? (
                    <>
                      <XCircle className="h-4 w-4 text-orange-500 mr-1" />
                      <span className="text-orange-700">Canceled</span>
                    </>
                  ) : user.subscriptionStatus === "incomplete" ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-amber-500 mr-1" />
                      <span className="text-amber-700">Payment Processing</span>
                    </>
                  ) : user.subscriptionStatus === "past_due" ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                      <span className="text-red-700">Past Due - Payment Required</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-gray-500 mr-1" />
                      <span>{user.subscriptionStatus || "Unknown"}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-1">
                  <CreditCard className="h-4 w-4 mr-1.5 text-gray-500 flex-shrink-0" />
                  <div className="text-sm text-gray-500">Plan</div>
                </div>
                <div className="font-medium">
                  {user.planName || "Premium Monthly"}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-1">
                  <CalendarClock className="h-4 w-4 mr-1.5 text-gray-500 flex-shrink-0" />
                  <div className="text-sm text-gray-500">Start Date</div>
                </div>
                <div className="font-medium">{formattedStartDate}</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md relative">
                <div className="flex items-center mb-1">
                  <Calendar className="h-4 w-4 mr-1.5 text-gray-500 flex-shrink-0" />
                  <div className="text-sm text-gray-500">
                    {user.subscriptionStatus === "canceled" ? "Access Until" : "Next Billing Date"}
                  </div>
                </div>
                <div className="font-medium">
                  {new Date(user.subscriptionEndDate || new Date()).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>

              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleUpdatePaymentMethod}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {isLoading ? (
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Update Payment Method
                </button>
                
                {user.subscriptionStatus === "active" && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isCanceling}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    {isCanceling ? (
                      <Loader className="animate-spin h-4 w-4 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Cancel Subscription
                  </button>
                )}
                
                {user.subscriptionStatus === "canceled" && (
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        const response = await apiRequest("POST", "/api/reactivate-subscription");
                        
                        if (response.ok) {
                          const data = await response.json();
                          await refreshSubscriptionStatus();
                          toast({
                            title: "Subscription Reactivated",
                            description: data.message || "Your subscription has been successfully reactivated.",
                            variant: "default",
                          });
                        } else {
                          // Parse error response
                          let errorMessage = "Failed to reactivate subscription";
                          try {
                            const errorData = await response.json();
                            errorMessage = errorData.message || errorData.error || errorMessage;
                          } catch (parseError) {
                            console.error("Error parsing response:", parseError);
                          }
                          
                          toast({
                            title: "Error",
                            description: errorMessage,
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        // Network or other unexpected errors
                        toast({
                          title: "Connection Error",
                          description: "Could not connect to subscription service. Please check your internet connection and try again.",
                          variant: "destructive",
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {isLoading ? (
                      <Loader className="animate-spin h-4 w-4 mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reactivate Subscription
                  </button>
                )}
                
                {(user.subscriptionStatus === "incomplete" || user.subscriptionStatus === "past_due") && (
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        // Use our payment update endpoint to get a Stripe checkout URL
                        const response = await apiRequest("GET", "/api/payment-method-update");
                        
                        if (!response.ok) {
                          throw new Error("Failed to get payment update link");
                        }
                        
                        const data = await response.json();
                        
                        if (data.url) {
                          toast({
                            title: "Complete Payment",
                            description: "You'll be redirected to update your payment method.",
                            variant: "default",
                          });
                          
                          // Redirect to Stripe's hosted payment form
                          window.location.href = data.url;
                        } else {
                          throw new Error("No payment URL returned");
                        }
                      } catch (error) {
                        console.error("Error getting payment update URL:", error);
                        toast({
                          title: "Error",
                          description: "Unable to process payment request. Please try again later.",
                          variant: "destructive",
                        });
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    {isLoading ? (
                      <Loader className="animate-spin h-4 w-4 mr-2 text-white" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Complete Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
        <h4 className="text-sm font-medium text-blue-800">Need Help?</h4>
        <p className="mt-1 text-sm text-blue-700">
          If you have any questions about your subscription, please email our support team at support@symptomcheckapp.com
        </p>
      </div>
    </div>
  );
}