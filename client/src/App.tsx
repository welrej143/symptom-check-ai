import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Results from "@/pages/results";
import Tracker from "@/pages/tracker";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useState } from "react";
import { AnalysisResponse } from "@shared/schema";

function App() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [userSymptoms, setUserSymptoms] = useState<string>("");
  
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow">
          <Switch>
            <Route path="/">
              <Home 
                setAnalysisResult={setAnalysisResult} 
                setUserSymptoms={setUserSymptoms}
              />
            </Route>
            <Route path="/results">
              <Results 
                analysisResult={analysisResult} 
                userSymptoms={userSymptoms}
              />
            </Route>
            <Route path="/tracker">
              <Tracker />
            </Route>
            <Route>
              <NotFound />
            </Route>
          </Switch>
        </main>
        <Footer />
      </div>
    </TooltipProvider>
  );
}

export default App;
