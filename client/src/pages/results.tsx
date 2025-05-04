import { useEffect } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { AnalysisResponse } from "@shared/schema";
import ConditionCard from "@/components/condition-card";
import UrgencyIndicator from "@/components/urgency-indicator";
import PremiumCard from "@/components/premium-card";
import { RotateCcw } from "lucide-react";

interface ResultsProps {
  analysisResult: AnalysisResponse | null;
  userSymptoms: string;
  setUserSymptoms?: (symptoms: string) => void;
}

export default function Results({ analysisResult, userSymptoms, setUserSymptoms }: ResultsProps) {
  const [, navigate] = useLocation();
  
  const handleAnalyzeAgain = () => {
    // If setUserSymptoms is provided, we'll keep the previous symptoms
    // This allows users to modify their previous symptoms entry
    if (setUserSymptoms) {
      setUserSymptoms(userSymptoms);
    }
    navigate("/");
  };
  
  // If no results, redirect to home
  useEffect(() => {
    if (!analysisResult) {
      navigate("/");
    }
  }, [analysisResult, navigate]);
  
  if (!analysisResult) {
    return null;
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900">Symptom Analysis Results</h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
          Based on the symptoms you described: <span className="font-medium text-gray-800">{userSymptoms}</span>
        </p>
      </div>
      
      <div className="flex justify-center mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <Link href="/results">
              <div className="py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-l-lg border border-blue-600 focus:z-10 focus:ring-2 focus:ring-blue-500 cursor-pointer">
                Analysis
              </div>
            </Link>
            <Link href="/tracker">
              <div className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-r-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-500 cursor-pointer">
                Track Symptoms
              </div>
            </Link>
          </div>
          
          <button 
            onClick={handleAnalyzeAgain}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Analyze Again
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Possible Conditions</h3>
              <p className="text-sm text-gray-500 mb-6">
                Remember, this is not a diagnosis. Always consult with a healthcare professional.
              </p>
              
              {analysisResult.conditions.map((condition, index) => (
                <ConditionCard 
                  key={index}
                  condition={condition}
                />
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Recommended Actions</h3>
              
              <div className="space-y-4">
                {analysisResult.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0">
                      {/* Use dynamic icon from recommendation */}
                      <svg xmlns="http://www.w3.org/2000/svg" 
                        className={`h-6 w-6 ${recommendation.isEmergency ? 'text-amber-500' : 'text-secondary-600'}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        {recommendation.icon === "alert-circle" && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                        {recommendation.icon === "book-open" && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        )}
                        {recommendation.icon === "eye" && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        )}
                        {recommendation.icon === "shopping-bag" && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        )}
                        {/* Fallback icon if none specified */}
                        {!["alert-circle", "book-open", "eye", "shopping-bag"].includes(recommendation.icon) && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-base font-medium text-gray-900">{recommendation.title}</h4>
                      <p className="mt-1 text-sm text-gray-600">{recommendation.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-4">
          <UrgencyIndicator 
            level={analysisResult.urgencyLevel} 
            text={analysisResult.urgencyText}
          />
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Start Tracking Symptoms</h3>
              <p className="text-sm text-gray-600 mb-4">
                Tracking your symptoms daily helps you see patterns and improvements over time.
              </p>
              
              <Link href="/tracker">
                <div className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors mb-4 text-center cursor-pointer">
                  Start Daily Tracking
                </div>
              </Link>
              
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center text-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Get trends and insights</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 mt-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Receive personalized health tips</span>
                </div>

              </div>
            </div>
          </div>
          
          <PremiumCard />
        </div>
      </div>
    </div>
  );
}
