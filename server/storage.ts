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
  sessionStore: session.Store;

  constructor() {
    const PostgresStore = connectPg(session);
    this.sessionStore = new PostgresStore({
      pool,
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
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
    const [updatedUser] = await db
      .update(users)
      .set({
        subscriptionStatus: status,
        isPremium: status === 'active',
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
