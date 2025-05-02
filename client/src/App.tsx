import { Switch, Route } from "wouter";
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

function App() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [userSymptoms, setUserSymptoms] = useState<string>("");
  
  // Create Home component wrapper to pass props
  const HomeWrapper = () => (
    <Home 
      setAnalysisResult={setAnalysisResult} 
      setUserSymptoms={setUserSymptoms}
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
            <Switch>
              <Route path="/" component={HomeWrapper} />
              <Route path="/results" component={ResultsWrapper} />
              <ProtectedRoute path="/tracker" component={Tracker} />
              <Route path="/auth" component={AuthPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
        </div>
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
