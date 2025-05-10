import { useLocation } from "wouter";
import { Zap, UserCircle, LogOut, ChevronDown, Shield, LineChart, Crown } from "lucide-react";
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
          <img src="/icon.png" alt="SymptomCheck AI" className="h-8 w-auto" />
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
                    <span className="ml-2 px-2 py-1 text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded shadow-sm border border-yellow-500 flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      PRO
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 text-gray-500 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/tracker")}>
                  <LineChart className="h-4 w-4 mr-2" />
                  Health Tracker
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/premium")}>
                  {user?.isPremium ? (
                    <>
                      <Crown className="h-4 w-4 mr-2 text-yellow-500" />
                      Premium Status
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Upgrade to Premium
                    </>
                  )}
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
