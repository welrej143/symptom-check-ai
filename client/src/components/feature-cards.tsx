import { ClipboardList, BarChart2, ShieldCheck } from "lucide-react";

export default function FeatureCards() {
  return (
    <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="text-primary-600 mb-3">
          <ClipboardList className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Analysis</h3>
        <p className="text-gray-600">Get instant insights about possible conditions based on your symptoms.</p>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="text-secondary-600 mb-3">
          <BarChart2 className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Track Your Health</h3>
        <p className="text-gray-600">Monitor symptoms daily and see improvement trends over time.</p>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="text-indigo-600 mb-3">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Private & Secure</h3>
        <p className="text-gray-600">Your health data stays private with advanced encryption and security.</p>
      </div>
    </div>
  );
}
