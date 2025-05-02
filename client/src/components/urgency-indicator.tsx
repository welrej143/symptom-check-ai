interface UrgencyIndicatorProps {
  level: string;
  text: string;
}

export default function UrgencyIndicator({ level, text }: UrgencyIndicatorProps) {
  // Map urgency level to display data
  const getUrgencyData = (level: string) => {
    switch (level) {
      case "high":
        return {
          label: "Emergency",
          color: "bg-red-100 text-red-800",
          barColor: "bg-red-500",
          barWidth: "w-full",
          bgColor: "bg-red-50",
          textColor: "text-red-800",
        };
      case "moderate":
        return {
          label: "Moderate",
          color: "bg-amber-100 text-amber-800",
          barColor: "bg-amber-500",
          barWidth: "w-2/3",
          bgColor: "bg-amber-50",
          textColor: "text-amber-800",
        };
      case "low":
        return {
          label: "Low",
          color: "bg-green-100 text-green-800",
          barColor: "bg-green-500",
          barWidth: "w-1/3",
          bgColor: "bg-green-50",
          textColor: "text-green-800",
        };
      default:
        return {
          label: "Moderate",
          color: "bg-amber-100 text-amber-800",
          barColor: "bg-amber-500",
          barWidth: "w-2/3",
          bgColor: "bg-amber-50",
          textColor: "text-amber-800",
        };
    }
  };
  
  const urgencyData = getUrgencyData(level);
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Urgency Level</h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${urgencyData.color}`}>
            {urgencyData.label}
          </span>
        </div>
        
        <div className="relative pt-1">
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
            <div className={`${urgencyData.barWidth} shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${urgencyData.barColor}`}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Monitor at home</span>
            <span>See a doctor</span>
            <span>Emergency</span>
          </div>
        </div>
        
        <div className={`mt-4 p-4 ${urgencyData.bgColor} rounded-md`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${urgencyData.barColor}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className={`text-sm ${urgencyData.textColor}`}>{text}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
