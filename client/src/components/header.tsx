import { useLocation } from "wouter";
import { Zap } from "lucide-react";

export default function Header() {
  const [_, navigate] = useLocation();
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div 
          className="flex items-center cursor-pointer" 
          onClick={() => navigate("/")}
        >
          <Zap className="h-8 w-8 text-blue-500" />
          <h1 className="ml-2 text-xl font-bold text-gray-900">SymptomCheck AI</h1>
        </div>
        
        <nav className="flex items-center">
          <button 
            className="text-sm font-medium text-blue-500 hover:text-blue-700 mr-4"
            onClick={() => navigate("/")}
          >
            Sign In
          </button>
          <button 
            className="bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => navigate("/")}
          >
            Get Premium
          </button>
        </nav>
      </div>
    </header>
  );
}
