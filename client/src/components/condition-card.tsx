import { Condition } from "@shared/schema";

interface ConditionCardProps {
  condition: Condition;
}

export default function ConditionCard({ condition }: ConditionCardProps) {
  // Determine card style based on urgency level
  const getUrgencyClass = (level: string) => {
    switch (level) {
      case "high":
        return "urgency-emergency";
      case "moderate":
        return "urgency-urgent";
      case "low":
        return "urgency-moderate";
      default:
        return "urgency-moderate";
    }
  };
  
  // Determine icon based on urgency level
  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case "high":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case "moderate":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "low":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };
  
  return (
    <div className="mb-6 last:mb-0">
      <div className={`${getUrgencyClass(condition.urgencyLevel)} p-4 rounded-md`}>
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            {getUrgencyIcon(condition.urgencyLevel)}
          </div>
          <div className="ml-3 flex-1">
            <h4 className="text-lg font-medium text-gray-900">{condition.name}</h4>
            <p className="mt-1 text-sm text-gray-600">{condition.description}</p>
            
            <div className="mt-3">
              <h5 className="text-sm font-medium text-gray-900">Common Symptoms</h5>
              <div className="mt-2 flex flex-wrap gap-2">
                {condition.symptoms.map((symptom, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="mt-3">
              <button className="text-sm text-blue-500 hover:text-blue-700 font-medium">
                Learn more
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
