import { useLocation } from "wouter";
import { Zap, UserCircle, LogOut, ChevronDown, Shield, LineChart, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function Header() {
  const [_, navigate] = useLocation();
  const { user, isLoading, logoutMutation } = useAuth();
  
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/");
        // Force page reload to ensure all auth state is cleared
        window.location.reload();
      }
    });
  };
  
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
        
        <nav className="flex items-center space-x-4">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 px-2">
                  <UserCircle className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">{user.username}</span>
                  {user.isPremium && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full">
                      PRO
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 text-gray-500 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/tracker")}>
                  <LineChart className="h-4 w-4 mr-2" />
                  Health Tracker
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/premium")}>
                  <Shield className="h-4 w-4 mr-2" />
                  {user?.isPremium ? "Premium Status" : "Upgrade to Premium"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                  {logoutMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Logging out...
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button 
              className="text-sm font-medium text-blue-500 hover:text-blue-700"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
