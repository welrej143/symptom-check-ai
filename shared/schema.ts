import { pgTable, text, serial, integer, boolean, date, time, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  isPremium: boolean("is_premium").default(false),
  subscriptionStatus: text("subscription_status").default("inactive"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  planName: text("plan_name").default("Premium Monthly"),
  // Usage tracking for free tier
  analysisCount: integer("analysis_count").default(0).notNull(),
  analysisCountResetDate: timestamp("analysis_count_reset_date"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const symptomRecords = pgTable("symptom_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  symptoms: text("symptoms").notNull(),
  date: timestamp("date").notNull().defaultNow(),
});

export const insertSymptomRecordSchema = createInsertSchema(symptomRecords).pick({
  userId: true,
  symptoms: true,
  date: true,
});

export type InsertSymptomRecord = z.infer<typeof insertSymptomRecordSchema>;
export type SymptomRecord = typeof symptomRecords.$inferSelect;

export const dailyTracking = pgTable("daily_tracking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  date: date("date").notNull(),
  symptoms: text("symptoms").array(),
  symptomSeverity: integer("symptom_severity").notNull(),
  energyLevel: integer("energy_level").notNull(),
  mood: integer("mood").notNull(),
  sleepQuality: integer("sleep_quality").notNull(),
  notes: text("notes"),
});

export const insertDailyTrackingSchema = createInsertSchema(dailyTracking).pick({
  userId: true,
  date: true,
  symptoms: true,
  symptomSeverity: true,
  energyLevel: true,
  mood: true,
  sleepQuality: true,
  notes: true,
});

export type InsertDailyTracking = z.infer<typeof insertDailyTrackingSchema>;
export type DailyTracking = typeof dailyTracking.$inferSelect;

// Analysis response types
export const conditionSchema = z.object({
  name: z.string(),
  description: z.string(),
  symptoms: z.array(z.string()),
  causes: z.array(z.string()).optional(),
  urgencyLevel: z.enum(["low", "moderate", "high"]),
  medications: z.array(z.object({
    name: z.string(),
    description: z.string(),
    dosage: z.string().optional(),
    sideEffects: z.array(z.string()).optional(),
  })).optional(),
  supplements: z.array(z.object({
    name: z.string(),
    description: z.string(),
    dosage: z.string().optional(),
    benefits: z.array(z.string()).optional(),
  })).optional(),
});

export const analysisResponseSchema = z.object({
  userSymptoms: z.string(),
  conditions: z.array(conditionSchema),
  urgencyLevel: z.enum(["low", "moderate", "high"]),
  urgencyText: z.string(),
  recommendations: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    isEmergency: z.boolean().optional(),
  })),
});

export type Condition = z.infer<typeof conditionSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

// Symptom form schema
export const symptomInputSchema = z.object({
  symptoms: z.string().min(3, "Please describe your symptoms in more detail"),
});

export type SymptomInput = z.infer<typeof symptomInputSchema>;

// Daily tracking form schema
export const dailyTrackingFormSchema = z.object({
  symptomSeverity: z.number().min(1).max(10),
  symptoms: z.array(z.string()).min(1, "Please select at least one symptom"),
  energyLevel: z.number().min(1).max(5),
  mood: z.number().min(1).max(5),
  sleepQuality: z.number().min(1).max(5),
  notes: z.string().optional(),
});

export type DailyTrackingForm = z.infer<typeof dailyTrackingFormSchema>;
