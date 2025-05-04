import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Loader, User, CreditCard, Settings, Shield, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SubscriptionManager from "@/components/subscription-manager";
import { apiRequest } from "@/lib/queryClient";

export default function ProfilePage() {
  const { user, refreshSubscriptionStatus } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "subscription">("account");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }
  
  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    const formData = new FormData(event.currentTarget);
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real app, this would connect to a password change endpoint
      // const response = await apiRequest("POST", "/api/change-password", {
      //   currentPassword,
      //   newPassword,
      // });
      
      toast({
        title: "Feature not implemented",
        description: "Password change functionality is not available in this demo",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Account Profile</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and subscription</p>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-1/4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3">
                  <p className="font-medium text-gray-900">{user.username}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => setActiveTab("account")}
                className={`w-full text-left px-4 py-2 rounded-md flex items-center ${
                  activeTab === "account" ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <User className="w-5 h-5 mr-2" />
                <span>Account Details</span>
              </button>
              <button
                onClick={() => setActiveTab("subscription")}
                className={`w-full text-left px-4 py-2 rounded-md flex items-center ${
                  activeTab === "subscription" ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                <span>Subscription</span>
              </button>
            </div>
          </div>
          
          {/* Subscription Status Card */}
          <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center mb-3">
              <Shield className="w-5 h-5 text-primary-600 mr-2" />
              <h3 className="font-medium text-gray-900">Subscription Status</h3>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                user.subscriptionStatus === "active" ? "bg-green-500" : 
                user.subscriptionStatus === "canceled" ? "bg-orange-500" : "bg-gray-400"
              }`}></div>
              <span className={`text-sm font-medium ${
                user.subscriptionStatus === "active" ? "text-green-700" : 
                user.subscriptionStatus === "canceled" ? "text-orange-700" : "text-gray-600"
              }`}>
                {user.subscriptionStatus === "active" ? "Active" : 
                 user.subscriptionStatus === "canceled" ? "Canceled" : 
                 user.isPremium ? "Premium" : "Free Plan"}
              </span>
            </div>
            {user.subscriptionEndDate && (
              <div className="mt-2 text-xs text-gray-600 flex items-center">
                <CalendarClock className="w-3 h-3 mr-1" />
                <span>
                  {user.subscriptionStatus === "canceled" ? "Access until: " : "Next billing: "}
                  {new Date(user.subscriptionEndDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1">
          {activeTab === "account" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-primary-600" />
                  Account Settings
                </h2>
                
                <div className="space-y-6">
                  {/* Account Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <div className="bg-gray-50 p-2 rounded-md border border-gray-200">
                          {user.username}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="bg-gray-50 p-2 rounded-md border border-gray-200">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Change Password */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                    <form onSubmit={handlePasswordChange}>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Current Password
                          </label>
                          <input
                            type="password"
                            id="currentPassword"
                            name="currentPassword"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            New Password
                          </label>
                          <input
                            type="password"
                            id="newPassword"
                            name="newPassword"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                        
                        <div>
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            {isLoading ? (
                              <>
                                <Loader className="animate-spin h-4 w-4 mr-2" />
                                Updating...
                              </>
                            ) : (
                              "Change Password"
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === "subscription" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-primary-600" />
                Subscription Management
              </h2>
              
              <SubscriptionManager user={user} refreshSubscriptionStatus={refreshSubscriptionStatus} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}