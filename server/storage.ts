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
  getDailyTrackingData(days: number): Promise<DailyTracking[]>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private symptomRecords: Map<number, SymptomRecord>;
  private dailyTrackings: Map<number, DailyTracking>;
  private currentUserId: number;
  private currentSymptomRecordId: number;
  private currentDailyTrackingId: number;

  constructor() {
    this.users = new Map();
    this.symptomRecords = new Map();
    this.dailyTrackings = new Map();
    this.currentUserId = 1;
    this.currentSymptomRecordId = 1;
    this.currentDailyTrackingId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Symptom record methods
  async createSymptomRecord(record: InsertSymptomRecord): Promise<SymptomRecord> {
    const id = this.currentSymptomRecordId++;
    const symptomRecord: SymptomRecord = { ...record, id };
    this.symptomRecords.set(id, symptomRecord);
    return symptomRecord;
  }

  async getSymptomRecords(): Promise<SymptomRecord[]> {
    return Array.from(this.symptomRecords.values());
  }

  async getSymptomRecordById(id: number): Promise<SymptomRecord | undefined> {
    return this.symptomRecords.get(id);
  }

  // Daily tracking methods
  async createDailyTracking(tracking: InsertDailyTracking): Promise<DailyTracking> {
    const id = this.currentDailyTrackingId++;
    const dailyTracking: DailyTracking = { ...tracking, id };
    this.dailyTrackings.set(id, dailyTracking);
    return dailyTracking;
  }

  async getDailyTrackingData(days: number): Promise<DailyTracking[]> {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return Array.from(this.dailyTrackings.values())
      .filter(tracking => {
        if (typeof tracking.date === 'string') {
          return new Date(tracking.date) >= cutoffDate;
        } else {
          return tracking.date >= cutoffDate;
        }
      })
      .sort((a, b) => {
        const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
        const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
        return dateA.getTime() - dateB.getTime();
      });
  }
}

// Export a singleton instance
export const storage = new MemStorage();
