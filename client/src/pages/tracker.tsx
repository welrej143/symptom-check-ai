import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DailyTracking } from "@shared/schema";
import SymptomTrackerForm from "@/components/symptom-tracker-form";
import SymptomChart from "@/components/symptom-chart";
import HealthScore from "@/components/health-score";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Tracker() {
  const [timeRange, setTimeRange] = useState<string>("7");
  const { toast } = useToast();
  
  // Fetch tracking data
  const { data: trackingData, isLoading } = useQuery({
    queryKey: ['/api/tracking-data', timeRange],
    refetchOnWindowFocus: false
  });
  
  // Submit daily tracking data mutation
  const trackSymptomsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/track-symptoms", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tracking-data'] });
      toast({
        title: "Tracking saved",
        description: "Your symptom tracking has been saved successfully.",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your symptom tracking. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Calculate health insights based on tracking data
  const getHealthInsights = () => {
    if (!trackingData || trackingData.length === 0) {
      return [];
    }
    
    // Get most recent entry
    const latest = trackingData[trackingData.length - 1];
    
    // If we have at least 2 entries, compare with previous
    if (trackingData.length > 1) {
      const previous = trackingData[trackingData.length - 2];
      
      const insights = [];
      
      // Check for improvement in symptom severity
      if (latest.symptomSeverity < previous.symptomSeverity) {
        insights.push({
          title: "Symptom Improvement",
          description: `Your symptom severity has decreased since your last check-in.`,
          type: "primary"
        });
      }
      
      // Check for patterns in sleep quality
      if (latest.sleepQuality > 3 && previous.symptomSeverity > latest.symptomSeverity) {
        insights.push({
          title: "Pattern Detected",
          description: "Your symptoms seem to improve after getting better sleep.",
          type: "secondary"
        });
      }
      
      return insights;
    }
    
    return [{
      title: "First Check-in Complete",
      description: "Keep tracking daily to see patterns and insights.",
      type: "primary"
    }];
  };
  
  // Handle form submission
  const handleSubmit = (data: any) => {
    trackSymptomsMutation.mutate(data);
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900">Daily Symptom Tracker</h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
          Track your symptoms daily to see patterns and improvement over time.
        </p>
      </div>
      
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <Link href="/results">
            <a className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-l-lg border border-gray-200 hover:bg-gray-100 hover:text-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500">
              Analysis
            </a>
          </Link>
          <Link href="/tracker">
            <a className="py-2 px-4 text-sm font-medium text-white bg-primary-600 rounded-r-lg border border-primary-600 focus:z-10 focus:ring-2 focus:ring-primary-500">
              Track Symptoms
            </a>
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Today's Check-in</h3>
              <SymptomTrackerForm 
                onSubmit={handleSubmit}
                isSubmitting={trackSymptomsMutation.isPending}
              />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Symptom History</h3>
                <div className="inline-flex items-center space-x-2">
                  <span className="text-sm text-gray-600">View:</span>
                  <select 
                    className="text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                  >
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                </div>
              </div>
              
              <div className="h-64 mb-6">
                <SymptomChart 
                  data={trackingData || []} 
                  isLoading={isLoading}
                />
              </div>
              
              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4">Insights</h4>
                
                {getHealthInsights().map((insight, index) => (
                  <div 
                    key={index}
                    className={`mt-${index > 0 ? '4' : '0'} p-4 ${
                      insight.type === 'primary' 
                        ? 'bg-primary-50 rounded-md' 
                        : 'bg-secondary-50 rounded-md'
                    }`}
                  >
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className={`h-5 w-5 ${
                            insight.type === 'primary' 
                              ? 'text-primary-600' 
                              : 'text-secondary-600'
                          }`} 
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          {insight.type === 'primary' ? (
                            <path 
                              fillRule="evenodd" 
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
                              clipRule="evenodd" 
                            />
                          ) : (
                            <path 
                              fillRule="evenodd" 
                              d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" 
                              clipRule="evenodd" 
                            />
                          )}
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h5 
                          className={`text-sm font-medium ${
                            insight.type === 'primary' 
                              ? 'text-primary-800' 
                              : 'text-secondary-800'
                          }`}
                        >
                          {insight.title}
                        </h5>
                        <p 
                          className={`mt-1 text-sm ${
                            insight.type === 'primary' 
                              ? 'text-primary-700' 
                              : 'text-secondary-700'
                          }`}
                        >
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {getHealthInsights().length === 0 && (
                  <div className="p-4 bg-gray-50 rounded-md">
                    <p className="text-gray-500 text-sm">
                      Start tracking your symptoms daily to see insights and patterns.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-4">
          <HealthScore trackingData={trackingData || []} />
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Streak & Achievements</h3>
              
              <div className="flex items-center justify-center mb-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 text-primary-800 text-2xl font-bold mb-2">
                    {trackingData ? trackingData.length : 0}
                  </div>
                  <p className="text-sm text-gray-600">day streak</p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Badges</h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className={`rounded-lg p-3 text-center ${trackingData && trackingData.length > 0 ? 'bg-gray-50' : 'bg-gray-100 opacity-50'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 mx-auto ${trackingData && trackingData.length > 0 ? 'text-primary-600' : 'text-gray-400'} mb-1`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span className={`text-xs font-medium ${trackingData && trackingData.length > 0 ? 'text-gray-700' : 'text-gray-400'}`}>First Log</span>
                  </div>
                  
                  <div className={`rounded-lg p-3 text-center ${trackingData && trackingData.length >= 5 ? 'bg-gray-50' : 'bg-gray-100 opacity-50'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 mx-auto ${trackingData && trackingData.length >= 5 ? 'text-primary-600' : 'text-gray-400'} mb-1`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className={`text-xs font-medium ${trackingData && trackingData.length >= 5 ? 'text-gray-700' : 'text-gray-400'}`}>5 Logs</span>
                  </div>
                  
                  <div className="bg-gray-100 opacity-50 rounded-lg p-3 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-400">Locked</span>
                  </div>
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
