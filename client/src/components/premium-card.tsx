import { Shield, LineChart, Loader, AlertCircle, ArrowRight, CreditCard } from "lucide-react";
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

// Payment options selection and checkout form
function PaymentOptions() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
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

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    setShowCardForm(method === 'card');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedMethod) {
      setError("Please select a payment method");
      return;
    }
    
    // For card payments, validate card details
    if (selectedMethod === 'card') {
      if (!cardNumber || !expiryDate || !cvc) {
        setError("Please fill in all card details");
        return;
      }
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create payment intent
      const { clientSecret } = await apiRequest("POST", "/api/create-subscription")
        .then(res => res.json());
      
      // Simulate a successful payment
      setTimeout(async () => {
        try {
          // Simulate update on backend
          const response = await apiRequest("POST", "/api/update-premium-status", {
            paymentIntentId: "pi_simulated_" + Date.now(),
            paymentMethod: selectedMethod
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
    <div className="bg-gray-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Premium Monthly</h3>
      <p className="text-sm text-gray-600 mb-5">You will be charged ${SUBSCRIPTION_PRICE} monthly</p>
      
      <form onSubmit={handleSubmit}>
        {/* Payment Method Selection */}
        <div className="space-y-3 mb-4">
          <div 
            className={`flex items-center p-3 border rounded-md cursor-pointer hover:border-primary-500 ${selectedMethod === 'card' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
            onClick={() => handleMethodSelect('card')}
          >
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
              <CreditCard className="h-4 w-4 text-gray-700" />
            </div>
            <span className="font-medium">Card</span>
          </div>
          
          <div 
            className={`flex items-center p-3 border rounded-md cursor-pointer hover:border-primary-500 ${selectedMethod === 'amazon_pay' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
            onClick={() => handleMethodSelect('amazon_pay')}
          >
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.256.19-.6.41-1.006.654-1.244.743-2.64 1.316-4.185 1.726a17.617 17.617 0 01-10.951-.577 17.88 17.88 0 01-5.43-3.35c-.1-.074-.151-.15-.151-.22 0-.047.021-.09.051-.13zm6.565-6.218c0-1.005.247-1.863.743-2.577.495-.71 1.17-1.25 2.04-1.615.796-.335 1.756-.575 2.912-.72.39-.046 1.033-.103 1.92-.174v-.37c0-.93-.105-1.558-.3-1.875-.302-.43-.812-.65-1.53-.65h-.15c-.48.046-.896.196-1.246.45-.354.253-.59.598-.713 1.027-.06.21-.206.313-.435.313l-2.578-.315c-.248-.03-.372-.18-.372-.45 0-.046.007-.09.022-.15.247-1.29.855-2.25 1.82-2.88.976-.616 2.1-.975 3.39-1.05h.54c1.65 0 2.957.434 3.888 1.29.135.15.27.314.405.494.12.174.224.36.283.55.075.21.135.42.165.645.03.21.05.57.056 1.04.008.478.004.865.004 1.17v5.37c0 .33.05.63.152.915.103.285.225.525.367.73.12.195.237.345.345.464.108.12.186.24.234.36.05.12.03.225-.043.315-.07.09-.168.124-.296.124-.15 0-.314-.07-.487-.21-.166-.143-.27-.224-.376-.243-.074-.017-.155-.008-.232.022-.088.045-.176.074-.284.105-.107.03-.244.07-.397.104-.152.037-.345.068-.566.09-.22.022-.45.034-.665.034-1.035 0-1.875-.18-2.512-.524-.652-.35-1.13-.86-1.447-1.518-.315-.66-.465-1.42-.465-2.28v-.125zm3.868-1.68V10.1c-.504.03-.96.12-1.358.27-.66.254-1.095.646-1.286 1.175-.183.527-.217 1.03-.157 1.51.012.12.05.25.106.396.057.145.15.27.277.368.127.09.292.138.488.138.396 0 .748-.144 1.06-.415.318-.278.55-.657.724-1.16.08-.237.124-.556.142-.992l.004-.062zm8.633 3.907a.89.89 0 00-.19-.245c-.074-.075-.172-.11-.297-.11-.074 0-.14.015-.211.045-.073.035-.107.1-.107.225 0 .09.017.155.056.21.04.054.12.135.24.24.12.104.234.195.345.285.111.09.235.195.375.33.313.3.54.57.661.8.124.23.186.574.186 1.02 0 .58-.166 1.05-.493 1.395-.33.345-.766.525-1.316.525-.5 0-.93-.102-1.305-.315-.37-.21-.633-.5-.78-.87-.05-.11-.08-.21-.08-.315s.03-.195.09-.27c.06-.08.155-.12.285-.12.1 0 .194.03.28.09.09.06.164.17.224.33.068.195.173.345.313.45.14.105.323.15.542.15.235 0 .43-.06.57-.21.144-.14.209-.335.209-.615 0-.28-.115-.515-.329-.705-.215-.19-.535-.42-.964-.69-.36-.243-.615-.435-.752-.605a1.34 1.34 0 01-.3-.57 2.157 2.157 0 01-.078-.57c0-.25.05-.475.147-.704a1.732 1.732 0 01.42-.614c.181-.175.395-.31.646-.415.25-.105.516-.15.8-.15.35 0 .663.053.934.16.27.107.49.25.648.434.16.18.26.334.29.465.03.13.044.24.044.334 0 .09-.026.176-.075.255-.05.075-.15.113-.286.113a.616.616 0 01-.275-.074 1.138 1.138 0 01-.33-.29c-.095-.133-.195-.24-.3-.33-.105-.09-.255-.135-.435-.135-.175 0-.325.045-.45.135a.425.425 0 00-.193.36c0 .15.052.285.157.395.105.105.3.24.602.39l.345.18c.12.06.256.15.405.27.145.12.29.25.421.4.133.15.24.32.325.51.085.19.135.41.135.65zm4.066-7.143l-2.603.02c-.053 0-.097.02-.14.06a.216.216 0 00-.07.14l-.02 14.737c0 .055.02.1.06.14.05.053.093.075.15.075l2.353.02c.053 0 .097-.02.14-.06a.22.22 0 00.07-.14l.01-7.164c.66.914 1.564 1.376 2.678 1.376.977 0 1.793-.27 2.457-.8.656-.546 1.09-1.16 1.325-1.87.234-.708.343-1.654.343-2.834 0-1.237-.233-2.203-.691-2.9-.455-.693-1.086-1.2-1.883-1.494-.797-.295-1.554-.302-2.307-.027-.876.32-1.576.907-2.13 1.77h-.03l-.06-1.01c0-.053-.024-.1-.06-.14-.042-.053-.09-.075-.13-.075l-.002.004zm2.274 2.813c.53 0 .966.17 1.316.48.35.307.584.738.72 1.288.143.55.224 1.198.224 1.915 0 .726-.066 1.34-.18 1.85-.12.507-.348.942-.69 1.288-.34.346-.81.516-1.394.516-.422 0-.804-.09-1.176-.277a1.926 1.926 0 01-.783-.79c-.186-.327-.303-.778-.382-1.348-.08-.57-.09-1.178-.045-1.826.045-.65.15-1.19.277-1.585.13-.395.361-.72.664-.93.308-.21.641-.3.99-.3l.459.72z" />
              </svg>
            </div>
            <span className="font-medium">Amazon Pay</span>
          </div>
          
          <div 
            className={`flex items-center p-3 border rounded-md cursor-pointer hover:border-primary-500 ${selectedMethod === 'cash_app' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
            onClick={() => handleMethodSelect('cash_app')}
          >
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded flex items-center justify-center mr-3">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-600">
                <path fill="currentColor" d="M22.5 12.6c0-4.8-3.9-8.7-8.7-8.7-4.8 0-8.7 3.9-8.7 8.7 0 4.8 3.9 8.7 8.7 8.7 4.8 0 8.7-3.9 8.7-8.7zm-5.3-3c.7 0 1.2.6 1.2 1.2 0 .7-.6 1.2-1.2 1.2-.7 0-1.2-.6-1.2-1.2.1-.6.6-1.2 1.2-1.2zm-6.7 0c.7 0 1.2.6 1.2 1.2 0 .7-.6 1.2-1.2 1.2-.7 0-1.2-.6-1.2-1.2.1-.6.6-1.2 1.2-1.2z" />
                <path fill="currentColor" d="M13.8 15.5l-3.4-3.4c-.3-.3-.3-.8 0-1.1l3.4-3.4c.3-.3.8-.3 1.1 0l3.4 3.4c.3.3.3.8 0 1.1L14.9 15.5c-.3.3-.8.3-1.1 0z" />
              </svg>
            </div>
            <span className="font-medium">Cash App Pay</span>
          </div>
        </div>
        
        {/* Card Details Form (conditional display) */}
        {showCardForm && (
          <div className="space-y-3 mt-4 border-t border-gray-200 pt-4">
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
          </div>
        )}
        
        {/* Error message display */}
        {error && (
          <div className="mt-3 text-red-600 text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Submit button */}
        <button 
          type="submit" 
          disabled={isLoading || !selectedMethod}
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
    </div>
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
            <div className="bg-gray-50 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Premium Monthly</h3>
              <p className="text-sm text-gray-600 mb-5">You will be charged ${SUBSCRIPTION_PRICE} monthly</p>
              
              {/* Payment Method Selection - Styled like Stripe */}
              <div className="mb-6 space-y-2">
                <div 
                  className="flex items-center p-4 border rounded-md cursor-pointer hover:border-primary-500 border-gray-300 bg-white"
                  onClick={() => {
                    // Simulate selecting card and opening form
                    setTimeout(async () => {
                      try {
                        // Simulate update on backend
                        const response = await apiRequest("POST", "/api/update-premium-status", {
                          paymentIntentId: "pi_simulated_" + Date.now(),
                          paymentMethod: 'card'
                        });
                        
                        if (user) {
                          // Refresh auth context
                          await refreshSubscriptionStatus();
                        }
                        
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
                      }
                    }, 1500);
                  }}
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
                    <CreditCard className="h-4 w-4 text-gray-700" />
                  </div>
                  <span className="font-medium">Card</span>
                </div>
                
                <div 
                  className="flex items-center p-4 border rounded-md cursor-pointer hover:border-primary-500 border-gray-300 bg-white"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.256.19-.6.41-1.006.654-1.244.743-2.64 1.316-4.185 1.726a17.617 17.617 0 01-10.951-.577 17.88 17.88 0 01-5.43-3.35c-.1-.074-.151-.15-.151-.22 0-.047.021-.09.051-.13zm6.565-6.218c0-1.005.247-1.863.743-2.577.495-.71 1.17-1.25 2.04-1.615.796-.335 1.756-.575 2.912-.72.39-.046 1.033-.103 1.92-.174v-.37c0-.93-.105-1.558-.3-1.875-.302-.43-.812-.65-1.53-.65h-.15c-.48.046-.896.196-1.246.45-.354.253-.59.598-.713 1.027-.06.21-.206.313-.435.313l-2.578-.315c-.248-.03-.372-.18-.372-.45 0-.046.007-.09.022-.15.247-1.29.855-2.25 1.82-2.88.976-.616 2.1-.975 3.39-1.05h.54c1.65 0 2.957.434 3.888 1.29.135.15.27.314.405.494.12.174.224.36.283.55.075.21.135.42.165.645.03.21.05.57.056 1.04.008.478.004.865.004 1.17v5.37c0 .33.05.63.152.915.103.285.225.525.367.73.12.195.237.345.345.464.108.12.186.24.234.36.05.12.03.225-.043.315-.07.09-.168.124-.296.124-.15 0-.314-.07-.487-.21-.166-.143-.27-.224-.376-.243-.074-.017-.155-.008-.232.022-.088.045-.176.074-.284.105-.107.03-.244.07-.397.104-.152.037-.345.068-.566.09-.22.022-.45.034-.665.034-1.035 0-1.875-.18-2.512-.524-.652-.35-1.13-.86-1.447-1.518-.315-.66-.465-1.42-.465-2.28v-.125zm3.868-1.68V10.1c-.504.03-.96.12-1.358.27-.66.254-1.095.646-1.286 1.175-.183.527-.217 1.03-.157 1.51.012.12.05.25.106.396.057.145.15.27.277.368.127.09.292.138.488.138.396 0 .748-.144 1.06-.415.318-.278.55-.657.724-1.16.08-.237.124-.556.142-.992l.004-.062zm8.633 3.907a.89.89 0 00-.19-.245c-.074-.075-.172-.11-.297-.11-.074 0-.14.015-.211.045-.073.035-.107.1-.107.225 0 .09.017.155.056.21.04.054.12.135.24.24.12.104.234.195.345.285.111.09.235.195.375.33.313.3.54.57.661.8.124.23.186.574.186 1.02 0 .58-.166 1.05-.493 1.395-.33.345-.766.525-1.316.525-.5 0-.93-.102-1.305-.315-.37-.21-.633-.5-.78-.87-.05-.11-.08-.21-.08-.315s.03-.195.09-.27c.06-.08.155-.12.285-.12.1 0 .194.03.28.09.09.06.164.17.224.33.068.195.173.345.313.45.14.105.323.15.542.15.235 0 .43-.06.57-.21.144-.14.209-.335.209-.615 0-.28-.115-.515-.329-.705-.215-.19-.535-.42-.964-.69-.36-.243-.615-.435-.752-.605a1.34 1.34 0 01-.3-.57 2.157 2.157 0 01-.078-.57c0-.25.05-.475.147-.704a1.732 1.732 0 01.42-.614c.181-.175.395-.31.646-.415.25-.105.516-.15.8-.15.35 0 .663.053.934.16.27.107.49.25.648.434.16.18.26.334.29.465.03.13.044.24.044.334 0 .09-.026.176-.075.255-.05.075-.15.113-.286.113a.616.616 0 01-.275-.074 1.138 1.138 0 01-.33-.29c-.095-.133-.195-.24-.3-.33-.105-.09-.255-.135-.435-.135-.175 0-.325.045-.45.135a.425.425 0 00-.193.36c0 .15.052.285.157.395.105.105.3.24.602.39l.345.18c.12.06.256.15.405.27.145.12.29.25.421.4.133.15.24.32.325.51.085.19.135.41.135.65z" />
                    </svg>
                  </div>
                  <span className="font-medium">Amazon Pay</span>
                </div>
                
                <div 
                  className="flex items-center p-4 border rounded-md cursor-pointer hover:border-primary-500 border-gray-300 bg-white"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded flex items-center justify-center mr-3">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-600">
                      <path fill="currentColor" d="M22.5 12.6c0-4.8-3.9-8.7-8.7-8.7-4.8 0-8.7 3.9-8.7 8.7 0 4.8 3.9 8.7 8.7 8.7 4.8 0 8.7-3.9 8.7-8.7zm-5.3-3c.7 0 1.2.6 1.2 1.2 0 .7-.6 1.2-1.2 1.2-.7 0-1.2-.6-1.2-1.2.1-.6.6-1.2 1.2-1.2zm-6.7 0c.7 0 1.2.6 1.2 1.2 0 .7-.6 1.2-1.2 1.2-.7 0-1.2-.6-1.2-1.2.1-.6.6-1.2 1.2-1.2z" />
                      <path fill="currentColor" d="M13.8 15.5l-3.4-3.4c-.3-.3-.3-.8 0-1.1l3.4-3.4c.3-.3.8-.3 1.1 0l3.4 3.4c.3.3.3.8 0 1.1L14.9 15.5c-.3.3-.8.3-1.1 0z" />
                    </svg>
                  </div>
                  <span className="font-medium">Cash App Pay</span>
                </div>
              </div>
            </div>
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
