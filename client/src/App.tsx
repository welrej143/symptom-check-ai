import { Switch, Route, useLocation } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Results from "@/pages/results";
import Tracker from "@/pages/tracker";
import AuthPage from "@/pages/auth-page";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useState, useEffect } from "react";
import { AnalysisResponse } from "@shared/schema";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import LoadingAnalysis from "@/components/loading-analysis";
import { analyzeSymptoms } from "@/lib/openai";
import { useToast } from "@/hooks/use-toast";
import PremiumCard from "@/components/premium-card";
import { apiRequest } from "@/lib/queryClient";

// Payment verification component (must be defined outside App)
// This is a separate component that uses Auth context hooks
function PaymentVerificationWrapper({
  children,
  analysisResult,
  userSymptoms,
  setUserSymptoms,
  analyzeUserSymptoms
}: {
  children?: React.ReactNode,
  analysisResult: AnalysisResponse | null,
  userSymptoms: string,
  setUserSymptoms: (symptoms: string) => void,
  analyzeUserSymptoms: (symptoms: string) => Promise<void>
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { refreshSubscriptionStatus } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Create Home component wrapper to pass props
  const HomeWrapper = () => (
    <Home 
      setUserSymptoms={setUserSymptoms}
      initialSymptoms={userSymptoms}
      analyzeSymptoms={analyzeUserSymptoms}
    />
  );
  
  // Create Results component wrapper to pass props
  const ResultsWrapper = () => (
    <Results 
      analysisResult={analysisResult} 
      userSymptoms={userSymptoms}
      setUserSymptoms={setUserSymptoms}
    />
  );
  
  // Use effect to check for payment verification params
  useEffect(() => {
    const checkStripeRedirect = async () => {
      // Get URL search params
      const searchParams = new URLSearchParams(window.location.search);
      const isSuccess = searchParams.get('success') === 'true';
      const sessionId = searchParams.get('session_id');
      
      // If successful payment with session ID, verify with backend
      if (isSuccess && sessionId) {
        try {
          setIsProcessing(true);
          
          // Show toast about verification
          toast({
            title: "Verifying Your Payment",
            description: "We're confirming your subscription status...",
            variant: "default",
          });
          
          // Clear URL params
          const currentUrl = new URL(window.location.href);
          currentUrl.search = '';
          window.history.replaceState({}, '', currentUrl.toString());
          
          // Verify payment with backend
          const response = await apiRequest("GET", `/api/verify-checkout-session?session_id=${sessionId}`);
          
          if (!response.ok) {
            throw new Error("Failed to verify payment");
          }
          
          const data = await response.json();
          console.log("Verification successful:", data);
          
          // Refresh subscription status to reflect changes
          await refreshSubscriptionStatus();
          
          // Show success message
          toast({
            title: "Payment Successful!",
            description: "Your subscription has been activated. You now have access to all premium features!",
            variant: "default",
          });
          
        } catch (err) {
          console.error("Error verifying checkout:", err);
          toast({
            title: "Verification Failed",
            description: "We couldn't verify your payment. Please check your subscription status in the premium page.",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      }
    };
    
    checkStripeRedirect();
  }, [location, toast, refreshSubscriptionStatus]);
  
  // Show a processing indicator if it's verifying
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Verifying Your Payment</h2>
        <p className="text-gray-600 text-center max-w-md">
          We're confirming your subscription status with our payment provider.
          This should only take a moment...
        </p>
      </div>
    );
  }
  
  // Otherwise render the normal routes
  return (
    <Switch>
      <Route path="/" component={HomeWrapper} />
      <Route path="/results" component={ResultsWrapper} />
      <ProtectedRoute path="/tracker" component={Tracker} />
      <ProtectedRoute path="/premium" component={() => (
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-2xl font-bold mb-6">Premium Subscription</h1>
          <div className="max-w-md mx-auto">
            <PremiumCard />
          </div>
        </div>
      )} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [userSymptoms, setUserSymptoms] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Function to handle analyzing symptoms
  const analyzeUserSymptoms = async (symptoms: string) => {
    if (!symptoms.trim()) return;
    
    // Store the symptoms
    setUserSymptoms(symptoms);
    
    // Show loading state 
    setIsAnalyzing(true);
    setProgress(0);
    
    // Set up progress animation
    let progressTimer = setInterval(() => {
      setProgress(prev => prev < 90 ? prev + 5 : 90);
    }, 300);
    
    try {
      // Call API
      const result = await analyzeSymptoms(symptoms);
      
      // Update progress to 100%
      clearInterval(progressTimer);
      setProgress(100);
      
      // Set result
      setAnalysisResult(result);
      
      // Let user see 100% briefly, then navigate
      setTimeout(() => {
        setIsAnalyzing(false);
        navigate("/results");
      }, 500);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      clearInterval(progressTimer);
      setIsAnalyzing(false);
      
      // Check if it's a limit reached error (402 Payment Required)
      if (error.response?.status === 402) {
        // Get limit information from the response
        const limitData = error.response?.data;
        
        toast({
          title: "Free Analysis Limit Reached",
          description: (
            <div className="space-y-2">
              <p>You've used all your free analyses this month ({limitData?.limit || 3} analyses).</p>
              <p>Upgrade to Premium for unlimited symptom analyses!</p>
              <div className="pt-2">
                <button 
                  onClick={() => navigate("/premium")}
                  className="bg-primary-600 text-white px-4 py-1.5 rounded-md text-sm font-medium"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          ),
          variant: "default",
          duration: 10000, // Show for 10 seconds
        });
      } else if (error.response && error.usageExceeded) {
        // Another way to catch usage exceeded errors
        toast({
          title: "Free Analysis Limit Reached",
          description: (
            <div className="space-y-2">
              <p>You've used all your free analyses this month (3 analyses).</p>
              <p>Upgrade to Premium for unlimited symptom analyses!</p>
              <div className="pt-2">
                <button 
                  onClick={() => navigate("/premium")}
                  className="bg-primary-600 text-white px-4 py-1.5 rounded-md text-sm font-medium"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          ),
          variant: "default",
          duration: 10000, // Show for 10 seconds
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: "There was a problem analyzing your symptoms. Please try again.",
          variant: "destructive",
        });
      }
    }
  };
  
  // Create Home component wrapper to pass props
  const HomeWrapper = () => (
    <Home 
      setUserSymptoms={setUserSymptoms}
      initialSymptoms={userSymptoms}
      analyzeSymptoms={analyzeUserSymptoms}
    />
  );
  
  // Create Results component wrapper to pass props
  const ResultsWrapper = () => (
    <Results 
      analysisResult={analysisResult} 
      userSymptoms={userSymptoms}
      setUserSymptoms={setUserSymptoms}
    />
  );
  
  return (
    <AuthProvider>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-grow">
            {isAnalyzing ? (
              <LoadingAnalysis progress={progress} />
            ) : (
              <PaymentVerificationWrapper
                analysisResult={analysisResult}
                userSymptoms={userSymptoms}
                setUserSymptoms={setUserSymptoms}
                analyzeUserSymptoms={analyzeUserSymptoms}
              />
            )}
          </main>
          <Footer />
        </div>
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
