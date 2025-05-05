import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Shield, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';

export default function UsageIndicator() {
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const FREE_ANALYSIS_LIMIT = 3;
  
  useEffect(() => {
    // Only fetch for non-premium users who are logged in
    if (!user || user.isPremium) {
      setLoading(false);
      return;
    }
    
    const fetchUsage = async () => {
      try {
        setLoading(true);
        const response = await apiRequest('GET', `/api/usage-count`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch usage data');
        }
        
        const data = await response.json();
        setAnalysisCount(data.count);
      } catch (err) {
        console.error('Error fetching usage data:', err);
        setError('Could not retrieve your usage information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsage();
  }, [user]);
  
  // Don't render for premium users or if not logged in
  if (!user || user.isPremium || loading) {
    return null;
  }
  
  // Handle error state
  if (error) {
    return (
      <div className="text-sm text-gray-600 flex items-center mb-4">
        <AlertCircle className="w-4 h-4 mr-1 text-amber-500" />
        <span>{error}</span>
      </div>
    );
  }
  
  // If we have the analysis count, show the indicator
  if (analysisCount !== null) {
    const remaining = Math.max(0, FREE_ANALYSIS_LIMIT - analysisCount);
    const isLow = remaining <= 1;
    
    return (
      <div className="mb-4">
        <div className={`px-4 py-3 rounded-md text-sm flex items-start ${isLow ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex-shrink-0 mr-3 mt-0.5">
            {isLow ? (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            ) : (
              <Shield className="h-5 w-5 text-gray-500" />
            )}
          </div>
          <div>
            <p className={`font-medium ${isLow ? 'text-amber-800' : 'text-gray-700'}`}>
              {remaining === 0 
                ? 'You\'ve used all your free analyses this month' 
                : `You have ${remaining} free analysis${remaining !== 1 ? 'es' : ''} remaining this month`}
            </p>
            <div className="mt-2 mb-1 bg-gray-200 rounded-full h-1.5 w-full">
              <div 
                className={`h-1.5 rounded-full ${isLow ? 'bg-amber-500' : 'bg-primary-500'}`} 
                style={{ width: `${Math.min(100, (analysisCount / FREE_ANALYSIS_LIMIT) * 100)}%` }}
              ></div>
            </div>
            {remaining === 0 ? (
              <button
                onClick={() => navigate('/premium')}
                className="mt-2 text-xs font-medium bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700"
              >
                Upgrade to Premium
              </button>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Free tier includes {FREE_ANALYSIS_LIMIT} analyses per month</p>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return null;
}