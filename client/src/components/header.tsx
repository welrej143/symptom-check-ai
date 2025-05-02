import { useLocation } from "wouter";
import { Zap, UserCircle, LogOut, ChevronDown, Sun, Moon } from "lucide-react";
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
import { useTheme } from "next-themes";

export default function Header() {
  const [_, navigate] = useLocation();
  const { user, isLoading, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  return (
    <header className="bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div 
          className="flex items-center cursor-pointer" 
          onClick={() => navigate("/")}
        >
          <Zap className="h-8 w-8 text-blue-500" />
          <h1 className="ml-2 text-xl font-bold text-foreground">SymptomCheck AI</h1>
        </div>
        
        <nav className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full" 
            onClick={toggleTheme} 
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all text-yellow-500" />
            ) : (
              <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all text-blue-500" />
            )}
          </Button>
          
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 px-2">
                  <UserCircle className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">{user.username}</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/tracker")}>
                  Health Tracker
                </DropdownMenuItem>
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
              className="text-sm font-medium text-blue-500 hover:text-blue-400"
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
