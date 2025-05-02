import { useEffect, useState } from "react";

interface LoadingAnalysisProps {
  progress: number;
}

export default function LoadingAnalysis({ progress }: LoadingAnalysisProps) {
  const [steps, setSteps] = useState([
    { id: 1, text: "Processing symptom information", status: "complete" },
    { id: 2, text: "Comparing with medical knowledge base", status: "complete" },
    { id: 3, text: "Generating possible conditions", status: "in-progress" },
    { id: 4, text: "Determining urgency level", status: "pending" },
    { id: 5, text: "Preparing personalized recommendations", status: "pending" },
  ]);
  
  // Update steps based on progress
  useEffect(() => {
    if (progress >= 40 && progress < 70) {
      setSteps(prev => 
        prev.map(step => 
          step.id === 3 ? { ...step, status: "complete" } : 
          step.id === 4 ? { ...step, status: "in-progress" } : 
          step
        )
      );
    } else if (progress >= 70 && progress < 90) {
      setSteps(prev => 
        prev.map(step => 
          step.id <= 4 ? { ...step, status: "complete" } : 
          { ...step, status: "in-progress" }
        )
      );
    } else if (progress >= 90) {
      setSteps(prev => 
        prev.map(step => ({ ...step, status: "complete" }))
      );
    }
  }, [progress]);
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <section className="flex flex-col items-center justify-center py-16">
        <div className="text-center mb-8">
          <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h2 className="text-2xl font-bold text-gray-900">Analyzing Your Symptoms</h2>
          <p className="text-gray-600 mt-2">Our AI is carefully reviewing your symptoms...</p>
        </div>
        
        <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="bg-primary-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">Analysis Steps</h3>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <div className="space-y-4">
              {steps.map(step => (
                <div key={step.id} className={`flex items-center ${step.status === 'pending' ? 'opacity-50' : ''}`}>
                  <div className="flex-shrink-0">
                    {step.status === 'complete' ? (
                      <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : step.status === 'in-progress' ? (
                      <svg className="animate-pulse h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block text-primary-600">Analysis Progress</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-primary-600">{progress}%</span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-100">
                  <div className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-600" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
