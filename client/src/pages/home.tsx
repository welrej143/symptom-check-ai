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
  setAnalysisResult: (result: AnalysisResponse) => void;
  setUserSymptoms: (symptoms: string) => void;
  initialSymptoms?: string;
}

export default function Home({ setAnalysisResult, setUserSymptoms, initialSymptoms = "" }: HomeProps) {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const handleSymptomSubmit = async (symptoms: string) => {
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
    
    setIsLoading(true);
    setProgress(0); // Reset progress
    
    // Simulate progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);
    
    try {
      const result = await analyzeSymptoms(symptoms);
      clearInterval(interval);
      setProgress(100);
      
      // Set result and navigate to results page
      setAnalysisResult(result);
      
      // Small delay to show 100% before navigating
      setTimeout(() => {
        setIsLoading(false);
        navigate("/results");
      }, 500);
    } catch (error) {
      console.error("Error analyzing symptoms:", error);
      clearInterval(interval);
      setIsLoading(false);
      
      toast({
        title: "Analysis Failed",
        description: "There was a problem analyzing your symptoms. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  if (isLoading) {
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
