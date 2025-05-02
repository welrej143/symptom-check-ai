import { DailyTracking } from "@shared/schema";
import { Activity, User, CloudSun, SmilePlus } from "lucide-react";

interface HealthScoreProps {
  trackingData: DailyTracking[];
}

export default function HealthScore({ trackingData }: HealthScoreProps) {
  // Calculate health score (0-100) based on tracking data
  const calculateHealthScore = (): {score: number, change: number} => {
    if (!trackingData || trackingData.length === 0) {
      return { score: 0, change: 0 };
    }
    
    // Get latest entry
    const latest = trackingData[trackingData.length - 1];
    
    // Calculate score based on latest metrics
    // Score formula: 100 - symptomSeverity*5 + (energyLevel + mood + sleepQuality)*5
    // This gives us a range of approximately 0-100
    const baseScore = Math.min(100, Math.max(0, 100 - (latest.symptomSeverity * 5) + ((latest.energyLevel + latest.mood + latest.sleepQuality) * 5)));
    
    // Round to nearest whole number
    const score = Math.round(baseScore);
    
    // Calculate change from previous day
    let change = 0;
    if (trackingData.length > 1) {
      const previous = trackingData[trackingData.length - 2];
      const previousScore = Math.min(100, Math.max(0, 100 - (previous.symptomSeverity * 5) + ((previous.energyLevel + previous.mood + previous.sleepQuality) * 5)));
      change = score - Math.round(previousScore);
    }
    
    return { score, change };
  };
  
  const { score, change } = calculateHealthScore();
  
  // Get status labels for metrics
  const getStatusLabel = (value: number, type: string): string => {
    if (!value) return "No data";
    
    // Different scales for different metrics
    if (type === "symptomSeverity") {
      if (value <= 3) return "Mild";
      if (value <= 7) return "Moderate";
      return "Severe";
    } else {
      // For energy, mood, sleep
      if (value <= 2) return "Poor";
      if (value <= 3) return "Fair";
      if (value <= 4) return "Good";
      return "Excellent";
    }
  };
  
  // Get color for status label
  const getStatusColor = (value: number, type: string): string => {
    if (!value) return "text-gray-400";
    
    if (type === "symptomSeverity") {
      if (value <= 3) return "text-green-600";
      if (value <= 7) return "text-amber-600";
      return "text-red-600";
    } else {
      // For energy, mood, sleep
      if (value <= 2) return "text-red-600";
      if (value <= 3) return "text-amber-600";
      if (value <= 4) return "text-green-600";
      return "text-green-600";
    }
  };
  
  // Get the latest metrics
  const getLatestMetrics = () => {
    if (!trackingData || trackingData.length === 0) {
      return {
        symptomSeverity: 0,
        energyLevel: 0,
        mood: 0,
        sleepQuality: 0
      };
    }
    
    return trackingData[trackingData.length - 1];
  };
  
  const latestMetrics = getLatestMetrics();
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Score</h3>
        
        <div className="relative pt-1 mb-6">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block text-secondary-600">
                {change > 0 ? "Improving" : change < 0 ? "Declining" : "Stable"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-secondary-600">{score}/100</span>
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-secondary-100">
            <div 
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-secondary-600"
              style={{ width: `${score}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600">
            {change > 0 
              ? `Up ${change} points from yesterday` 
              : change < 0 
                ? `Down ${Math.abs(change)} points from yesterday`
                : "No change from yesterday"
            }
          </p>
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Symptom Severity</span>
              </div>
              <span className={`text-sm font-medium ${getStatusColor(latestMetrics.symptomSeverity, "symptomSeverity")}`}>
                {getStatusLabel(latestMetrics.symptomSeverity, "symptomSeverity")}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Energy Level</span>
              </div>
              <span className={`text-sm font-medium ${getStatusColor(latestMetrics.energyLevel, "energyLevel")}`}>
                {getStatusLabel(latestMetrics.energyLevel, "energyLevel")}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <SmilePlus className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Mood</span>
              </div>
              <span className={`text-sm font-medium ${getStatusColor(latestMetrics.mood, "mood")}`}>
                {getStatusLabel(latestMetrics.mood, "mood")}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CloudSun className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">Sleep Quality</span>
              </div>
              <span className={`text-sm font-medium ${getStatusColor(latestMetrics.sleepQuality, "sleepQuality")}`}>
                {getStatusLabel(latestMetrics.sleepQuality, "sleepQuality")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
