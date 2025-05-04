import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Shield, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

// Define the price data interface
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

export default function PremiumUpgrade() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, refreshSubscriptionStatus } = useAuth();
  const [, navigate] = useLocation();
  
  // Fetch price information from Stripe
  const { data: priceData, isLoading: isPriceLoading } = useQuery<PriceData>({
    queryKey: ['/api/pricing'],
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });
  
  const handleUpgrade = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upgrade to premium",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Redirect to Stripe checkout
      const response = await apiRequest("POST", "/api/create-subscription");
      
      if (response.ok) {
        const data = await response.json();
        // Redirect to the Stripe checkout page
        window.location.href = data.url;
      } else {
        const errorData = await response.json();
        toast({
          title: "Upgrade Failed",
          description: errorData.message || "Could not start the upgrade process. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting upgrade:", error);
      toast({
        title: "Upgrade Failed",
        description: "There was a problem initiating the upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Upgrade to Premium</h1>
        <p className="text-gray-600 mb-8">Get unlimited symptom analyses and full access to all features</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Premium Plan</h2>
              <p className="text-gray-600">Unlock the full potential of SymptomCheck AI</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">Unlimited analyses</h3>
                  <p className="text-sm text-gray-600">Analyze your symptoms as many times as you need</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">Complete health tracker</h3>
                  <p className="text-sm text-gray-600">Track your symptoms and health metrics over time</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">Detailed condition information</h3>
                  <p className="text-sm text-gray-600">Get comprehensive insights about potential conditions</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">Cancel anytime</h3>
                  <p className="text-sm text-gray-600">No long-term commitment required</p>
                </div>
              </div>
            </div>
            
            <div className="mb-6 pt-4 border-t border-gray-100">
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-gray-900">
                  {isPriceLoading ? "..." : priceData?.formattedPrice || "$9.99"}
                </span>
                <span className="text-gray-600 ml-2">/ {isPriceLoading ? "month" : priceData?.interval || "month"}</span>
              </div>
            </div>
            
            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Subscribe Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Why Choose Premium?</h2>
            
            <div className="space-y-6">
              <div className="bg-white rounded-md p-4 shadow-sm">
                <h3 className="font-medium text-gray-900 mb-2">Free Plan Limitations</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                    Limited to 3 symptom analyses per month
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                    Basic symptom tracking functionality
                  </li>
                </ul>
              </div>
              
              <div className="bg-white rounded-md p-4 shadow-sm">
                <h3 className="font-medium text-gray-900 mb-2">Premium Benefits</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    Unlimited symptom analyses
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    Advanced health metrics and visualization
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    Personalized health insights and recommendations
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    Full access to all current and future features
                  </li>
                </ul>
              </div>
              
              <div className="bg-white rounded-md p-4 shadow-sm">
                <div className="flex items-center text-gray-600 text-sm">
                  <Shield className="h-4 w-4 text-blue-500 mr-2" />
                  <span>Secure payment processing with Stripe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}