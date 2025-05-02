import { Link } from "wouter";
import { Zap } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/">
          <div className="flex items-center cursor-pointer">
            <Zap className="h-8 w-8 text-primary-600" />
            <h1 className="ml-2 text-xl font-bold text-gray-900">SymptomCheck AI</h1>
          </div>
        </Link>
        <nav>
          <button className="text-sm font-medium text-primary-600 hover:text-primary-800">Sign In</button>
          <button className="bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-primary-700 transition-colors">Get Premium</button>
        </nav>
      </div>
    </header>
  );
}
