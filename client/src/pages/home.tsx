import { useState } from "react";
import { useLocation } from "wouter";
import SymptomForm from "@/components/symptom-form";
import LoadingAnalysis from "@/components/loading-analysis";
import FeatureCards from "@/components/feature-cards";
import { AnalysisResponse } from "@shared/schema";
import { analyzeSymptoms } from "@/lib/openai";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface HomeProps {
  setUserSymptoms: (symptoms: string) => void;
  initialSymptoms?: string;
  analyzeSymptoms: (symptoms: string) => Promise<void>;
}

export default function Home({ setAnalysisResult, setUserSymptoms, initialSymptoms = "" }: HomeProps) {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const handleSymptomSubmit = (symptoms: string) => {
    // Check if user is logged in
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in or register to analyze your symptoms.",
        variant: "default",
      });
      navigate("/auth");
      return;
    }
    
    // Save symptoms to parent state right away
    setUserSymptoms(symptoms);
    
    // Only proceed if we have symptoms text
    if (!symptoms.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your symptoms before analyzing.",
        variant: "destructive",
      });
      return;
    }
    
    // Show loading state immediately
    console.log("Setting loading state to true");
    setIsLoading(true);
    setProgress(0);
    
    // Define a function for progress animation
    const startProgressAnimation = () => {
      // Return the interval ID so we can clear it later
      return setInterval(() => {
        setProgress((prev) => {
          // Cap at 90% until the analysis is complete
          if (prev >= 90) return 90;
          return prev + 5;
        });
      }, 300);
    };
    
    // Start progress animation with a slight delay to ensure loading component renders
    const timer = setTimeout(() => {
      const progressTimer = startProgressAnimation();
      
      // Analyze symptoms
      analyzeSymptoms(symptoms)
        .then(result => {
          // Clear the progress timer
          clearInterval(progressTimer);
          
          // Set to 100% when done
          setProgress(100);
          
          // Set the result
          setAnalysisResult(result);
          
          // Short delay to show 100% before redirecting
          setTimeout(() => {
            setIsLoading(false);
            navigate("/results");
          }, 500);
        })
        .catch(error => {
          // Clear the progress timer
          clearInterval(progressTimer);
          console.error("Error analyzing symptoms:", error);
          
          setIsLoading(false);
          toast({
            title: "Analysis Failed",
            description: "There was a problem analyzing your symptoms. Please try again.",
            variant: "destructive",
          });
        });
    }, 100);
    
    // Cleanup function if component unmounts
    return () => {
      clearTimeout(timer);
    };
  };
  
  // Debug log for rendering
  console.log("Home component rendering, isLoading:", isLoading, "progress:", progress);
  
  if (isLoading) {
    console.log("Rendering loading component");
    return <LoadingAnalysis progress={progress} />;
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <section id="landing-section">
        <div className="flex flex-col lg:flex-row items-center">
          <div className="lg:w-1/2 mb-8 lg:mb-0 lg:pr-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Smart Health Insights at Your Fingertips
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Describe your symptoms and get AI-powered analysis to understand what might be happening with your health.
            </p>
            <SymptomForm 
              onSubmit={handleSymptomSubmit}
              initialSymptoms={initialSymptoms}
            />
          </div>
          <div className="lg:w-1/2">
            <img 
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=600&q=80" 
              alt="Doctor using digital technology" 
              className="rounded-lg shadow-lg w-full h-auto object-cover"
            />
          </div>
        </div>
        
        <FeatureCards />
      </section>
    </div>
  );
}
