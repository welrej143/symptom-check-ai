import { useEffect, useRef } from "react";
import { DailyTracking } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

interface SymptomChartProps {
  data: DailyTracking[];
  isLoading: boolean;
}

export default function SymptomChart({ data, isLoading }: SymptomChartProps) {
  // Format data for chart
  const formatChartData = () => {
    if (!data || data.length === 0) return [];
    
    return data.map(entry => {
      const date = typeof entry.date === 'string' ? new Date(entry.date) : entry.date;
      return {
        date: format(date, 'MM/dd'),
        symptomSeverity: entry.symptomSeverity,
        energy: entry.energyLevel,
        mood: entry.mood,
        sleep: entry.sleepQuality
      };
    });
  };
  
  const chartData = formatChartData();
  
  if (isLoading) {
    return <Skeleton className="w-full h-full" />;
  }
  
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center border border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <p className="text-gray-500 mb-2">No tracking data available yet</p>
          <p className="text-sm text-gray-400">Start tracking your symptoms daily to see trends</p>
        </div>
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis domain={[0, 10]} fontSize={12} />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="symptomSeverity" 
          name="Symptom Severity" 
          stroke="#ef4444" 
          activeDot={{ r: 8 }}
          strokeWidth={2}
        />
        <Line 
          type="monotone" 
          dataKey="energy" 
          name="Energy Level" 
          stroke="#3b82f6" 
          strokeWidth={2}
        />
        <Line 
          type="monotone" 
          dataKey="mood" 
          name="Mood" 
          stroke="#10b981" 
          strokeWidth={2}
        />
        <Line 
          type="monotone" 
          dataKey="sleep" 
          name="Sleep Quality" 
          stroke="#8b5cf6" 
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
