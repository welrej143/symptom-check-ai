import { Switch, Route, useLocation } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Results from "@/pages/results";
import Tracker from "@/pages/tracker";
import AuthPage from "@/pages/auth-page";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useState } from "react";
import { AnalysisResponse } from "@shared/schema";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import LoadingAnalysis from "@/components/loading-analysis";
import { analyzeSymptoms } from "@/lib/openai";
import { useToast } from "@/hooks/use-toast";
import PremiumCard from "@/components/premium-card";

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
            )}
          </main>
          <Footer />
        </div>
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
