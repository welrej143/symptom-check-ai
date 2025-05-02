import { Shield, FileText, TrendingUp } from "lucide-react";

export default function PremiumCard() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Explore Premium Features</h3>
        
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Shield className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-3">
              <h4 className="text-base font-medium text-gray-900">Unlimited detailed analyses</h4>
              <p className="mt-1 text-sm text-gray-600">Get comprehensive health insights whenever you need them.</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-3">
              <h4 className="text-base font-medium text-gray-900">PDF health reports</h4>
              <p className="mt-1 text-sm text-gray-600">Download and share detailed health reports with your doctor.</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <TrendingUp className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-3">
              <h4 className="text-base font-medium text-gray-900">Advanced analytics</h4>
              <p className="mt-1 text-sm text-gray-600">Get deeper insights with advanced health pattern recognition.</p>
            </div>
          </div>
        </div>
        
        <button className="w-full mt-6 bg-primary-50 text-primary-700 border border-primary-300 py-2 px-4 rounded-md font-medium hover:bg-primary-100 transition-colors">
          Upgrade to Premium
        </button>
      </div>
    </div>
  );
}
