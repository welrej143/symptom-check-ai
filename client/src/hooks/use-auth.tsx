import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<Omit<User, "password">, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<Omit<User, "password">, Error, RegisterData>;
  refreshSubscriptionStatus: () => Promise<void>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  email: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
    refetch: refetchUser
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0, // Always refetch when requested
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: async (userData) => {
      // Update cache immediately
      queryClient.setQueryData(["/api/user"], userData);
      
      // Check subscription status if user has Stripe info
      if (userData.stripeCustomerId) {
        try {
          const res = await apiRequest("GET", "/api/subscription");
          
          if (res.ok) {
            const subscriptionData = await res.json();
            
            // Update user with subscription data from Stripe
            queryClient.setQueryData(["/api/user"], {
              ...userData,
              isPremium: subscriptionData.isPremium,
              subscriptionStatus: subscriptionData.subscriptionStatus,
              subscriptionEndDate: subscriptionData.subscriptionEndDate,
              planName: subscriptionData.planName || "Premium",
            });
          } else if (res.status === 404) {
            // No subscription found in Stripe
            console.warn("No subscription found in Stripe");
            
            // Override any local premium status with Stripe as source of truth
            queryClient.setQueryData(["/api/user"], {
              ...userData,
              isPremium: false,
              subscriptionStatus: 'inactive',
            });
          } else {
            // Other error
            console.error("Error fetching subscription:", res.status);
          }
        } catch (error) {
          console.error("Failed to fetch subscription status:", error);
          
          // Use default non-premium state on network/unexpected errors
          queryClient.setQueryData(["/api/user"], {
            ...userData,
            isPremium: false,
            subscriptionStatus: 'error',
          });
        }
      }
      
      // Force a refetch for fresh data
      refetchUser();
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.username}!`,
      });
      
      // Force a refresh to ensure proper state
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", userData);
      return await res.json();
    },
    onSuccess: (userData) => {
      // Update cache immediately
      queryClient.setQueryData(["/api/user"], userData);
      // Also force a refetch for fresh data
      refetchUser();
      
      toast({
        title: "Registration successful",
        description: `Welcome to SymptomCheck AI, ${userData.username}!`,
      });
      
      // Force a refresh to ensure proper state
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Clear cache
      queryClient.setQueryData(["/api/user"], null);
      // Also force a refetch to get fresh session state
      refetchUser();
      
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });
      
      // Force a refresh to ensure proper state
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to refresh subscription status
  const refreshSubscriptionStatus = async () => {
    // Force a complete refresh of user data first
    await refetchUser();
    
    // Skip if user isn't available after refetch
    if (!user) return;
    
    try {
      const res = await apiRequest("GET", "/api/subscription");
      
      if (res.ok) {
        const subscriptionData = await res.json();
        
        // Update user with subscription data
        queryClient.setQueryData(["/api/user"], {
          ...user,
          isPremium: subscriptionData.isPremium,
          subscriptionStatus: subscriptionData.subscriptionStatus,
          subscriptionEndDate: subscriptionData.subscriptionEndDate,
          planName: subscriptionData.planName,
        });
      } else {
        // Handle 404 or other error status
        if (res.status === 404) {
          // Subscription not found in Stripe
          console.warn("No active subscription found in Stripe");
          
          // Only update if there's a mismatch (user thinks they're premium but they're not)
          if (user.isPremium) {
            queryClient.setQueryData(["/api/user"], {
              ...user,
              isPremium: false,
              subscriptionStatus: 'inactive',
            });
          }
        } else {
          console.error("Error fetching subscription:", res.status);
        }
      }
    } catch (error) {
      console.error("Failed to refresh subscription status:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        refreshSubscriptionStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}