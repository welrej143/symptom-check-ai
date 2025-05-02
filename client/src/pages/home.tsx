import { useLocation } from "wouter";
import SymptomForm from "@/components/symptom-form";
import FeatureCards from "@/components/feature-cards";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface HomeProps {
  setUserSymptoms: (symptoms: string) => void;
  initialSymptoms?: string;
  analyzeSymptoms: (symptoms: string) => Promise<void>;
}

export default function Home({ setUserSymptoms, initialSymptoms = "", analyzeSymptoms }: HomeProps) {
  const [, navigate] = useLocation();
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
    
    // Only proceed if we have symptoms text
    if (!symptoms.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your symptoms before analyzing.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Starting symptom analysis process");
    
    // Call the parent component's analyze function
    try {
      await analyzeSymptoms(symptoms);
    } catch (error) {
      console.error("Error in handleSymptomSubmit:", error);
    }
  };

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
