import { 
  users, 
  type User, 
  type InsertUser, 
  symptomRecords, 
  type SymptomRecord, 
  type InsertSymptomRecord,
  dailyTracking,
  type DailyTracking,
  type InsertDailyTracking
} from "@shared/schema";
import { db } from "./db";
import { eq, gte, asc, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// Storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId: string, stripeSubscriptionId: string }): Promise<User>;
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
  
  // Session management
  sessionStore: session.Store;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore!: session.Store; // Using definite assignment assertion

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
            
            const MemoryStore = require('memorystore')(session);
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
      
      // Retry logic for handling transient database errors
      let retries = 3;
      let lastError: any;
      
      while (retries > 0) {
        try {
          const [user] = await db
            .insert(users)
            .values(insertUser)
            .returning();
          
          if (!user) {
            throw new Error("User creation failed: no user returned from insert");
          }
          
          return user;
        } catch (err: any) {
          lastError = err;
          console.error(`Error in createUser (retry ${3-retries+1}/3):`, err);
          retries--;
          
          // Only retry certain errors
          if (err.code === '23505') { // Unique constraint violation
            throw new Error("Username already exists");
          }
          
          // Wait before retrying
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      throw lastError || new Error("Failed to create user after multiple attempts");
    } catch (error: any) {
      // Format the error for better reporting
      if (error.message === "Username already exists") {
        throw error;
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
}

// Export a singleton instance
export const storage = new DatabaseStorage();
