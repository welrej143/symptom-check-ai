import { Shield, LineChart, Loader, AlertCircle, ArrowRight, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Subscription price in dollars
const SUBSCRIPTION_PRICE = 9.99;

// Simple direct checkout form that doesn't rely on Stripe Elements
function SimpleCheckoutForm() {
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvc, setCvc] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, refreshSubscriptionStatus } = useAuth();

  const formatCardNumber = (value: string) => {
    // Remove any non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // Format with spaces every 4 digits
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    // Limit to 19 characters (16 digits + 3 spaces)
    return formatted.slice(0, 19);
  };

  const formatExpiryDate = (value: string) => {
    // Remove any non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // Format as MM/YY
    if (cleaned.length > 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Basic validation
    if (!cardNumber || !expiryDate || !cvc) {
      setError("Please fill in all card details");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create payment intent
      const { clientSecret } = await apiRequest("POST", "/api/create-subscription")
        .then(res => res.json());
      
      // In a real app, this would use Stripe.js to confirm the payment
      // For this demo, we'll simulate a successful payment
      
      // Simulate a successful payment
      setTimeout(async () => {
        try {
          // Simulate update on backend
          const response = await apiRequest("POST", "/api/update-premium-status", {
            paymentIntentId: "pi_simulated_" + Date.now(),
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
        } catch (err) {
          console.error('Error updating premium status:', err);
          setError('An error occurred. Please try again.');
          toast({
            title: "Payment Failed",
            description: "An error occurred during payment processing",
            variant: "destructive",
          });
          setIsLoading(false);
        }
      }, 1500);
    } catch (err) {
      console.error('Payment error:', err);
      setError('An error occurred. Please try again.');
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
      <div className="mb-4 space-y-3">
        <div>
          <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Card Number
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              id="cardNumber"
              type="text" 
              value={formatCardNumber(cardNumber)}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              className="pl-9 w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              maxLength={19}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date
            </label>
            <input 
              id="expiryDate"
              type="text" 
              value={formatExpiryDate(expiryDate)}
              onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
              placeholder="MM/YY"
              className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              maxLength={5}
            />
          </div>
          <div>
            <label htmlFor="cvc" className="block text-sm font-medium text-gray-700 mb-1">
              CVC
            </label>
            <input 
              id="cvc"
              type="text" 
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="123"
              className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              maxLength={3}
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="nameOnCard" className="block text-sm font-medium text-gray-700 mb-1">
            Name on Card
          </label>
          <input 
            id="nameOnCard"
            type="text" 
            value={nameOnCard}
            onChange={(e) => setNameOnCard(e.target.value)}
            placeholder="John Smith"
            className="w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        {error && (
          <div className="mt-2 text-red-600 text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      
      <button 
        type="submit" 
        disabled={isLoading}
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
            <SimpleCheckoutForm />
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
