import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  UsersRound, 
  FileText, 
  BarChart, 
  CreditCard, 
  Eye, 
  EyeOff, 
  User, 
  Calendar,
  BadgeCheck,
  AlertCircle
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface PaymentSettings {
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  paypalMode: 'sandbox' | 'live';
  // We're no longer using these fields for UI but keeping them for API compatibility
  paypalSandboxClientId: string;
  paypalSandboxClientSecret: string;
  paypalLiveClientId: string;
  paypalLiveClientSecret: string;
}

interface Statistics {
  userCount: number;
  recordCount: number;
  trackingCount: number;
}

interface User {
  id: number;
  username: string;
  email: string;
  isPremium: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  planName: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  analysisCount: number;
  analysisCountResetDate: string | null;
  createdAt: string;
}

interface PaymentClickStats {
  stripe: number;
  paypal: number;
}

interface PaymentSuccessStats {
  stripe: number;
  paypal: number;
}

interface PaymentEvent {
  id: number;
  method: string;
  event: string;
  timestamp: string;
  userId: number | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
}

interface DashboardData {
  statistics: Statistics;
  users: User[];
  paymentSettings: PaymentSettings;
  paymentClickStats: PaymentClickStats;
  paymentSuccessStats: PaymentSuccessStats;
  recentPaymentEvents: PaymentEvent[];
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/admin/dashboard");
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
        setSettings(data.paymentSettings);
      } else {
        // Show error without redirecting to login (login requirement removed)
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Logout function removed since login is no longer required

  const savePaymentSettings = async () => {
    if (!settings) return;
    
    try {
      setSavingSettings(true);
      
      const response = await apiRequest("POST", "/api/admin/payment-settings", settings);
      
      if (response.ok) {
        toast({
          title: "Settings updated",
          description: "Payment settings have been updated successfully",
        });
        // Refresh dashboard data to see updated settings
        fetchDashboardData();
      } else {
        const data = await response.json();
        toast({
          title: "Failed to update settings",
          description: data.error || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>
      
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Payment Analytics</TabsTrigger>
          <TabsTrigger value="settings">Payment Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">Total Users</CardTitle>
                <UsersRound className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboardData?.statistics.userCount || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  Registered accounts
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">Symptom Analyses</CardTitle>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboardData?.statistics.recordCount || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  Performed analyses
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">Daily Tracking</CardTitle>
                <BarChart className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboardData?.statistics.trackingCount || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  Daily symptom tracking entries
                </p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Currently enabled payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">PayPal:</span>
                  <span className={`px-2 py-1 rounded-md text-sm ${settings?.paypalEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {settings?.paypalEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">PayPal Mode:</span>
                  <span className={`px-2 py-1 rounded-md text-sm ${settings?.paypalMode === 'live' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {settings?.paypalMode === 'live' ? 'Live' : 'Sandbox'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Stripe:</span>
                  <span className={`px-2 py-1 rounded-md text-sm ${settings?.stripeEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {settings?.stripeEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered Users</CardTitle>
              <CardDescription>All registered users in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.users && dashboardData.users.length > 0 ? (
                <Table>
                  <TableCaption>List of all registered users</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Usage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.users.map((user) => {
                      // Format the date
                      const createdDate = new Date(user.createdAt).toLocaleDateString();
                      
                      // Determine status badge
                      let statusBadge;
                      if (user.isPremium) {
                        statusBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <BadgeCheck className="w-3 h-3 mr-1" />
                            Premium
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Free
                          </span>
                        );
                      }
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.id}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{statusBadge}</TableCell>
                          <TableCell>
                            {user.subscriptionStatus === 'active' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {user.planName || 'Premium Monthly'}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center text-sm text-gray-500">
                              <Calendar className="w-3 h-3 mr-1" />
                              {createdDate}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {user.isPremium ? (
                              <span className="text-gray-500 text-sm">Unlimited</span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                {user.analysisCount}/3
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <UsersRound className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>No users registered yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Button Clicks</CardTitle>
                <CardDescription>Number of times payment buttons were clicked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">PayPal</p>
                      <p className="text-sm text-muted-foreground">Button click count</p>
                    </div>
                    <div className="text-3xl font-bold">
                      {dashboardData?.paymentClickStats?.paypal || 0}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">Stripe</p>
                      <p className="text-sm text-muted-foreground">Button click count</p>
                    </div>
                    <div className="text-3xl font-bold">
                      {dashboardData?.paymentClickStats?.stripe || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Successful Payments</CardTitle>
                <CardDescription>Number of successful payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">PayPal</p>
                      <p className="text-sm text-muted-foreground">Successful payments</p>
                    </div>
                    <div className="text-3xl font-bold">
                      {dashboardData?.paymentSuccessStats?.paypal || 0}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">Stripe</p>
                      <p className="text-sm text-muted-foreground">Successful payments</p>
                    </div>
                    <div className="text-3xl font-bold">
                      {dashboardData?.paymentSuccessStats?.stripe || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Payment Events</CardTitle>
              <CardDescription>Latest payment-related activity</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.recentPaymentEvents && dashboardData.recentPaymentEvents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.recentPaymentEvents.map((event) => {
                      // Format the date
                      const eventDate = new Date(event.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      
                      // Format amount if available
                      const formattedAmount = event.amount && event.currency 
                        ? new Intl.NumberFormat('en-US', { 
                            style: 'currency', 
                            currency: event.currency
                          }).format(event.amount) 
                        : '-';
                      
                      // Determine event badge
                      let eventBadge;
                      switch(event.event) {
                        case 'button_click':
                          eventBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Button Click
                            </span>
                          );
                          break;
                        case 'payment_success':
                          eventBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Payment Success
                            </span>
                          );
                          break;
                        case 'payment_failed':
                          eventBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Payment Failed
                            </span>
                          );
                          break;
                        default:
                          eventBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {event.event}
                            </span>
                          );
                      }
                      
                      // Determine method badge
                      let methodBadge;
                      switch(event.method) {
                        case 'paypal':
                          methodBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              PayPal
                            </span>
                          );
                          break;
                        case 'stripe':
                          methodBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Stripe
                            </span>
                          );
                          break;
                        default:
                          methodBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {event.method}
                            </span>
                          );
                      }
                      
                      return (
                        <TableRow key={event.id}>
                          <TableCell>{eventBadge}</TableCell>
                          <TableCell>{methodBadge}</TableCell>
                          <TableCell>{eventDate}</TableCell>
                          <TableCell>{event.userId || '-'}</TableCell>
                          <TableCell>{formattedAmount}</TableCell>
                          <TableCell>
                            {event.status ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${event.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                event.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                'bg-gray-100 text-gray-800'}`}>
                                {event.status}
                              </span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>No payment events recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>Configure payment methods and settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="stripe-toggle"
                        checked={settings.stripeEnabled}
                        onCheckedChange={(checked) => 
                          setSettings({ ...settings, stripeEnabled: checked })
                        }
                      />
                      <Label htmlFor="stripe-toggle">Enable Stripe Payments</Label>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="paypal-toggle"
                          checked={settings.paypalEnabled}
                          onCheckedChange={(checked) => 
                            setSettings({ ...settings, paypalEnabled: checked })
                          }
                        />
                        <Label htmlFor="paypal-toggle">Enable PayPal Payments</Label>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="paypal-mode">PayPal Mode</Label>
                          <Select
                            value={settings.paypalMode}
                            onValueChange={(value) => 
                              setSettings({ 
                                ...settings, 
                                paypalMode: value as 'sandbox' | 'live' 
                              })
                            }
                          >
                            <SelectTrigger id="paypal-mode">
                              <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                              <SelectItem value="live">Live (Production)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">
                            Warning: Only switch to live mode when ready for real transactions
                          </p>
                        </div>
                        
                        <div className="border rounded-md p-4 space-y-4">
                          <h3 className="font-medium">PayPal API Credentials</h3>
                          <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
                            <p className="text-blue-800 font-medium mb-2">Credentials Configuration</p>
                            <p className="text-blue-700 text-sm">
                              PayPal API credentials are now managed through environment variables in Render.
                            </p>
                            <ul className="list-disc ml-5 mt-2 text-sm text-blue-700">
                              <li>Set <code className="bg-blue-100 px-1 rounded">PAYPAL_CLIENT_ID_SANDBOX</code> for sandbox testing</li>
                              <li>Set <code className="bg-blue-100 px-1 rounded">PAYPAL_CLIENT_SECRET_SANDBOX</code> for sandbox testing</li>
                              <li>Set <code className="bg-blue-100 px-1 rounded">PAYPAL_CLIENT_ID_LIVE</code> for production</li>
                              <li>Set <code className="bg-blue-100 px-1 rounded">PAYPAL_CLIENT_SECRET_LIVE</code> for production</li>
                            </ul>
                            <p className="text-blue-700 text-sm mt-2">
                              This approach is more secure and prevents credentials from being stored in the database.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={savePaymentSettings} 
                    disabled={savingSettings}
                    className="w-full"
                  >
                    {savingSettings ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Save Payment Settings
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}