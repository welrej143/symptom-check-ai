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
import { eq, gte, asc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// Storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Symptom record methods
  createSymptomRecord(record: InsertSymptomRecord): Promise<SymptomRecord>;
  getSymptomRecords(): Promise<SymptomRecord[]>;
  getSymptomRecordById(id: number): Promise<SymptomRecord | undefined>;
  
  // Daily tracking methods
  createDailyTracking(tracking: InsertDailyTracking): Promise<DailyTracking>;
  getDailyTrackingData(days: number, userId?: number): Promise<DailyTracking[]>;
  
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
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Build the query with conditions
    if (userId) {
      return await db
        .select()
        .from(dailyTracking)
        .where(
          gte(dailyTracking.date, cutoffDate.toISOString()),
          eq(dailyTracking.userId, userId)
        )
        .orderBy(asc(dailyTracking.date));
    } else {
      return await db
        .select()
        .from(dailyTracking)
        .where(gte(dailyTracking.date, cutoffDate.toISOString()))
        .orderBy(asc(dailyTracking.date));
    }
  }
}

// Export a singleton instance
export const storage = new DatabaseStorage();
