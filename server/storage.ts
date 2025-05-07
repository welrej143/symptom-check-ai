import { 
  users, 
  type User, 
  type InsertUser, 
  symptomRecords, 
  type SymptomRecord, 
  type InsertSymptomRecord,
  dailyTracking,
  type DailyTracking,
  type InsertDailyTracking,
  appSettings,
  type AppSettings,
  type InsertAppSettings,
  type PaymentSettings
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, gte, asc, and, inArray } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { sql } from "drizzle-orm";

// Storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId: string, stripeSubscriptionId: string }): Promise<User>;
  updateUserPayPalInfo(userId: number, paypalInfo: { paypalSubscriptionId: string, paypalOrderId?: string }): Promise<User>;
  updateSubscriptionStatus(userId: number, status: string, endDate?: Date, planName?: string): Promise<User>;
  
  // Symptom record methods
  createSymptomRecord(record: InsertSymptomRecord): Promise<SymptomRecord>;
  getSymptomRecords(): Promise<SymptomRecord[]>;
  getSymptomRecordById(id: number): Promise<SymptomRecord | undefined>;
  
  // Daily tracking methods
  createDailyTracking(tracking: InsertDailyTracking): Promise<DailyTracking>;
  getDailyTrackingData(days: number, userId?: number): Promise<DailyTracking[]>;
  
  // Usage tracking methods
  incrementAnalysisCount(userId: number): Promise<number>;
  getAnalysisCount(userId: number): Promise<number>;
  resetAnalysisCount(userId: number): Promise<void>;
  
  // App settings methods
  getSetting(key: string): Promise<string | null>;
  getSettings(keys: string[]): Promise<Record<string, string>>;
  setSetting(key: string, value: string): Promise<AppSettings>;
  getPaymentSettings(): Promise<PaymentSettings>;
  updatePaymentSettings(settings: PaymentSettings): Promise<PaymentSettings>;
  adminLogin(username: string, password: string): Promise<boolean>;
  
  // Session management
  sessionStore: session.Store;
}

// Need to use dynamic import for memory store
import memoryStoreModule from 'memorystore';

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // Initialize with a default session store - it will be replaced during initialization
  sessionStore!: session.Store; // Using the definite assignment assertion

  constructor() {
    let retries = 0;
    const maxRetries = 3;
    
    // Function to attempt session store initialization with retry logic
    const initSessionStore = () => {
      try {
        console.log("Initializing PostgreSQL session store...");
        
        // Check if pool is initialized
        if (!pool) {
          console.error("Database pool not initialized for session store");
          throw new Error("Database pool not available");
        }
        
        const PostgresStore = connectPg(session);
        
        // Use more robust options for the session store
        this.sessionStore = new PostgresStore({
          pool,
          tableName: 'session',
          createTableIfMissing: true,
          // Add explicit error handling
          errorLog: (err) => console.error("Session store error:", err),
          pruneSessionInterval: 60 * 15 // Prune expired sessions every 15 min
        });
        
        console.log("PostgreSQL session store initialized successfully");
        return true;
      } catch (error) {
        console.error(`Failed to initialize PostgreSQL session store (attempt ${retries + 1}/${maxRetries}):`, error);
        
        if (retries < maxRetries) {
          retries++;
          console.log(`Retrying session store initialization in 500ms...`);
          // Wait before retrying
          setTimeout(initSessionStore, 500);
          return false;
        } else {
          console.error("Failed to initialize session store after multiple attempts");
          
          // In production, use a fallback in-memory store instead of crashing
          if (process.env.NODE_ENV === 'production') {
            console.log("Falling back to in-memory session store for production");
            
            const MemoryStore = memoryStoreModule(session);
            this.sessionStore = new MemoryStore({
              checkPeriod: 86400000 // prune expired entries every 24h
            });
            
            console.log("In-memory session store initialized as fallback");
            return true;
          } else {
            // In development, throw the error to fail fast
            throw error;
          }
        }
      }
    };
    
    // Start the initialization process
    initSessionStore();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      // Add defensive check before database query
      if (!db) {
        console.error("Database instance not initialized in getUser");
        throw new Error("Database connection not available");
      }
      
      try {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || undefined;
      } catch (err) {
        console.error(`Error in getUser for id ${id}:`, err);
        // Continue execution to avoid breaking authentication flow
        return undefined;
      }
    } catch (error) {
      console.error("Critical error in getUser:", error);
      // We must return undefined to allow the authentication flow to continue
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      // Add defensive check before database query
      if (!db) {
        console.error("Database instance not initialized in getUserByUsername");
        throw new Error("Database connection not available");
      }
      
      // More verbose error handling
      try {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user || undefined;
      } catch (err) {
        console.error(`Error in getUserByUsername for ${username}:`, err);
        // Continue execution to avoid breaking authentication flow
        return undefined;
      }
    } catch (error) {
      console.error("Critical error in getUserByUsername:", error);
      // We must return undefined to allow the authentication flow to continue
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // Add defensive check before database query
      if (!db) {
        console.error("Database instance not initialized in createUser");
        throw new Error("Database connection not available");
      }
      
      // More verbose logging to trace the issue
      console.log("Attempting to create user with username:", insertUser.username);
      
      // Try to use the standard ORM approach first
      try {
        console.log("Attempting to create user with Drizzle ORM");
        const [user] = await db
          .insert(users)
          .values({
            username: insertUser.username,
            email: insertUser.email,
            password: insertUser.password,
            createdAt: new Date(),
            // Set default payment provider
            paymentProvider: 'stripe',
            // Initialize subscription fields
            isPremium: false,
            subscriptionStatus: 'inactive',
            analysisCount: 0
          })
          .returning();
          
        if (user) {
          console.log("User created successfully with ORM, ID:", user.id);
          return user;
        }
        
        // If we get here, the insert worked but returned no user (shouldn't happen)
        console.warn("ORM insert succeeded but returned no user, falling back to SQL");
      } catch (ormError) {
        // ORM approach failed, try SQL approach
        console.warn("ORM insert failed, falling back to SQL:", ormError);
      }
      
      // If ORM fails, use direct SQL as a fallback
      // This is a more reliable approach that gives us more control
      console.log("Using direct SQL to create user");
      const result = await db.execute(sql`
        INSERT INTO users (
          username, 
          email, 
          password, 
          created_at, 
          payment_provider,
          analysis_count, 
          is_premium, 
          subscription_status
        )
        VALUES (
          ${insertUser.username}, 
          ${insertUser.email}, 
          ${insertUser.password}, 
          NOW(), 
          'stripe',
          0, 
          false, 
          'inactive'
        )
        RETURNING *
      `);
      
      if (!result.rows || result.rows.length === 0) {
        console.error("User creation returned no rows");
        throw new Error("User creation failed: database returned no results");
      }
      
      console.log("User created successfully with ID:", result.rows[0].id);
      
      // Create a properly typed User object
      const row = result.rows[0];
      
      const user: User = {
        id: typeof row.id === 'number' ? row.id : parseInt(row.id as string, 10),
        username: String(row.username),
        email: String(row.email),
        password: String(row.password),
        createdAt: new Date(row.created_at as string),
        // Payment provider tracking
        paymentProvider: row.payment_provider ? String(row.payment_provider) : 'stripe',
        // Stripe subscription fields
        stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
        stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
        // PayPal subscription fields
        paypalSubscriptionId: row.paypal_subscription_id ? String(row.paypal_subscription_id) : null,
        paypalOrderId: row.paypal_order_id ? String(row.paypal_order_id) : null,
        // General subscription fields
        isPremium: Boolean(row.is_premium),
        subscriptionStatus: String(row.subscription_status || 'inactive'),
        subscriptionEndDate: row.subscription_end_date ? new Date(row.subscription_end_date as string) : null,
        planName: String(row.plan_name || 'Premium Monthly'),
        // Usage tracking
        analysisCount: typeof row.analysis_count === 'number' ? row.analysis_count : parseInt(row.analysis_count as string, 10) || 0,
        analysisCountResetDate: row.analysis_count_reset_date ? new Date(row.analysis_count_reset_date as string) : null,
      };
      
      return user;
    } catch (error: any) {
      // Format the error for better reporting
      if (error.code === '23505') { // Unique constraint violation
        throw new Error("Username already exists");
      }
      
      console.error("Critical error in createUser:", error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }
  
  async updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId: string, stripeSubscriptionId: string }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        stripeCustomerId: stripeInfo.stripeCustomerId,
        stripeSubscriptionId: stripeInfo.stripeSubscriptionId,
        paymentProvider: 'stripe', // Set payment provider to stripe
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
  
  async updateUserPayPalInfo(userId: number, paypalInfo: { paypalSubscriptionId: string, paypalOrderId?: string }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        paypalSubscriptionId: paypalInfo.paypalSubscriptionId,
        paypalOrderId: paypalInfo.paypalOrderId,
        paymentProvider: 'paypal', // Set payment provider to paypal
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
  
  async updateSubscriptionStatus(userId: number, status: string, endDate?: Date, planName?: string): Promise<User> {
    // Get current date to compare with subscription end date
    const now = new Date();
    
    // If there's an end date in the future, the user should retain premium access
    // until that date, regardless of status (especially for users who cancel but should
    // retain access until the end of their billing period)
    const shouldRemainPremium = 
      // Active subscriptions are always premium
      status === 'active' || 
      // If there's an end date in the future, user should remain premium until then
      (endDate && endDate > now);
    
    console.log(`Updating subscription status: userId=${userId}, status=${status}, isPremium=${shouldRemainPremium}, endDate=${endDate?.toISOString()}`);
      
    const [updatedUser] = await db
      .update(users)
      .set({
        subscriptionStatus: status,
        isPremium: shouldRemainPremium,
        subscriptionEndDate: endDate ? endDate : undefined,
        planName: planName ? planName : undefined,
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // Symptom record methods
  async createSymptomRecord(record: InsertSymptomRecord): Promise<SymptomRecord> {
    const [symptomRecord] = await db
      .insert(symptomRecords)
      .values(record)
      .returning();
    return symptomRecord;
  }

  async getSymptomRecords(): Promise<SymptomRecord[]> {
    return await db.select().from(symptomRecords);
  }

  async getSymptomRecordById(id: number): Promise<SymptomRecord | undefined> {
    const [record] = await db.select().from(symptomRecords).where(eq(symptomRecords.id, id));
    return record || undefined;
  }

  // Daily tracking methods
  async createDailyTracking(tracking: InsertDailyTracking): Promise<DailyTracking> {
    const [trackingResult] = await db
      .insert(dailyTracking)
      .values(tracking)
      .returning();
    return trackingResult;
  }

  async getDailyTrackingData(days: number, userId?: number): Promise<DailyTracking[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Build the query based on whether we have a userId filter
    if (userId) {
      return await db
        .select()
        .from(dailyTracking)
        .where(and(
          gte(dailyTracking.date, cutoffDate.toISOString()),
          eq(dailyTracking.userId, userId)
        ))
        .orderBy(asc(dailyTracking.date));
    } else {
      return await db
        .select()
        .from(dailyTracking)
        .where(gte(dailyTracking.date, cutoffDate.toISOString()))
        .orderBy(asc(dailyTracking.date));
    }
  }
  
  // Usage tracking methods
  async incrementAnalysisCount(userId: number): Promise<number> {
    // Get the current user first to check if we need to reset the counter
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if reset date is null or older than 30 days
    const now = new Date();
    let shouldResetCount = false;
    
    if (!user.analysisCountResetDate) {
      shouldResetCount = true;
    } else {
      const resetDate = new Date(user.analysisCountResetDate);
      const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceReset >= 30) {
        shouldResetCount = true;
      }
    }
    
    // Set next reset date to 30 days from now
    const nextResetDate = new Date();
    nextResetDate.setDate(nextResetDate.getDate() + 30);
    
    if (shouldResetCount) {
      // Reset counter to 1 and update reset date
      const [updatedUser] = await db
        .update(users)
        .set({
          analysisCount: 1,
          analysisCountResetDate: nextResetDate,
        })
        .where(eq(users.id, userId))
        .returning();
      
      return updatedUser.analysisCount;
    } else {
      // Increment the counter
      const [updatedUser] = await db
        .update(users)
        .set({
          analysisCount: user.analysisCount + 1,
        })
        .where(eq(users.id, userId))
        .returning();
      
      return updatedUser.analysisCount;
    }
  }
  
  async getAnalysisCount(userId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user.analysisCount;
  }
  
  async resetAnalysisCount(userId: number): Promise<void> {
    const nextResetDate = new Date();
    nextResetDate.setDate(nextResetDate.getDate() + 30);
    
    await db
      .update(users)
      .set({
        analysisCount: 0,
        analysisCountResetDate: nextResetDate,
      })
      .where(eq(users.id, userId));
  }

  // App settings methods
  async getSetting(key: string): Promise<string | null> {
    try {
      const [setting] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, key));
      return setting ? setting.value : null;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
    try {
      if (keys.length === 0) return {};
      
      // Use PostgreSQL-style placeholders ($1, $2, etc.)
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const query = `SELECT * FROM app_settings WHERE key IN (${placeholders})`;
      
      // Execute the query directly with the db pool
      const result = await pool.query(query, keys);
      
      const settingsMap: Record<string, string> = {};
      if (result.rows) {
        result.rows.forEach((row: any) => {
          settingsMap[row.key] = row.value;
        });
      }
      
      return settingsMap;
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }

  async setSetting(key: string, value: string): Promise<AppSettings> {
    try {
      // Try to update first (in case it exists)
      const [updated] = await db
        .update(appSettings)
        .set({
          value,
          updatedAt: new Date()
        })
        .where(eq(appSettings.key, key))
        .returning();
      
      if (updated) {
        return updated;
      }
      
      // If not updated, insert a new setting
      const [setting] = await db
        .insert(appSettings)
        .values({
          key,
          value,
          updatedAt: new Date()
        })
        .returning();
      
      return setting;
    } catch (error: any) {
      console.error(`Error setting ${key}:`, error);
      throw new Error(`Failed to update setting: ${error.message}`);
    }
  }

  async getPaymentSettings(): Promise<PaymentSettings> {
    try {
      // Default payment settings if nothing is in the database
      const defaultSettings: PaymentSettings = {
        stripeEnabled: false,
        paypalEnabled: true,
        paypalMode: 'sandbox',
        paypalSandboxClientId: process.env.PAYPAL_CLIENT_ID || '',
        paypalSandboxClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        paypalLiveClientId: '',
        paypalLiveClientSecret: '',
      };
      
      // Get all setting keys for payment settings
      const settingKeys = [
        'stripe_enabled', 
        'paypal_enabled', 
        'paypal_mode', 
        'paypal_sandbox_client_id', 
        'paypal_sandbox_client_secret',
        'paypal_live_client_id',
        'paypal_live_client_secret'
      ];
      const settings = await this.getSettings(settingKeys);
      
      // If no settings exist, initialize them with defaults and return defaults
      if (Object.keys(settings).length === 0) {
        await this.updatePaymentSettings(defaultSettings);
        return defaultSettings;
      }
      
      // Otherwise, return the stored settings
      return {
        stripeEnabled: settings.stripe_enabled === 'true',
        paypalEnabled: settings.paypal_enabled === 'true',
        paypalMode: (settings.paypal_mode as 'sandbox' | 'live') || 'sandbox',
        paypalSandboxClientId: settings.paypal_sandbox_client_id || process.env.PAYPAL_CLIENT_ID || '',
        paypalSandboxClientSecret: settings.paypal_sandbox_client_secret || process.env.PAYPAL_CLIENT_SECRET || '',
        paypalLiveClientId: settings.paypal_live_client_id || '',
        paypalLiveClientSecret: settings.paypal_live_client_secret || '',
      };
    } catch (error) {
      console.error('Error getting payment settings:', error);
      // Return defaults on error
      return {
        stripeEnabled: false,
        paypalEnabled: true,
        paypalMode: 'sandbox',
        paypalSandboxClientId: process.env.PAYPAL_CLIENT_ID || '',
        paypalSandboxClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        paypalLiveClientId: '',
        paypalLiveClientSecret: '',
      };
    }
  }

  async updatePaymentSettings(settings: PaymentSettings): Promise<PaymentSettings> {
    try {
      // Update all the individual settings
      await this.setSetting('stripe_enabled', String(settings.stripeEnabled));
      await this.setSetting('paypal_enabled', String(settings.paypalEnabled));
      await this.setSetting('paypal_mode', settings.paypalMode);
      
      // Update sandbox credentials if provided
      if (settings.paypalSandboxClientId) {
        await this.setSetting('paypal_sandbox_client_id', settings.paypalSandboxClientId);
      }
      
      if (settings.paypalSandboxClientSecret) {
        await this.setSetting('paypal_sandbox_client_secret', settings.paypalSandboxClientSecret);
      }
      
      // Update live credentials if provided
      if (settings.paypalLiveClientId) {
        await this.setSetting('paypal_live_client_id', settings.paypalLiveClientId);
      }
      
      if (settings.paypalLiveClientSecret) {
        await this.setSetting('paypal_live_client_secret', settings.paypalLiveClientSecret);
      }
      
      // Update environment variables based on current mode
      process.env.PAYPAL_MODE = settings.paypalMode;
      
      // Set the appropriate credentials based on mode
      if (settings.paypalMode === 'sandbox') {
        if (settings.paypalSandboxClientId) {
          process.env.PAYPAL_CLIENT_ID = settings.paypalSandboxClientId;
        }
        
        if (settings.paypalSandboxClientSecret) {
          process.env.PAYPAL_CLIENT_SECRET = settings.paypalSandboxClientSecret;
        }
      } else {
        // Live mode
        if (settings.paypalLiveClientId) {
          process.env.PAYPAL_CLIENT_ID = settings.paypalLiveClientId;
        }
        
        if (settings.paypalLiveClientSecret) {
          process.env.PAYPAL_CLIENT_SECRET = settings.paypalLiveClientSecret;
        }
      }
      
      return settings;
    } catch (error: any) {
      console.error('Error updating payment settings:', error);
      throw new Error(`Failed to update payment settings: ${error.message}`);
    }
  }

  adminLogin(username: string, password: string): Promise<boolean> {
    // Hardcoded admin credentials for simplicity
    // In a real-world application, these would come from a database with proper hashing
    const ADMIN_USERNAME = 'welrej143';
    const ADMIN_PASSWORD = 'may161998_ECE';
    
    return Promise.resolve(username === ADMIN_USERNAME && password === ADMIN_PASSWORD);
  }
}

// Export a singleton instance
export const storage = new DatabaseStorage();
