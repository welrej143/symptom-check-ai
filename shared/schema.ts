import { pgTable, text, serial, integer, boolean, date, time, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
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
  prescriptionMedications: z.array(z.object({
    name: z.string(),
    description: z.string(),
    dosage: z.string().optional(),
    sideEffects: z.array(z.string()).optional(),
  })).optional(),
  otcMedications: z.array(z.object({
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
  
  // For backward compatibility with existing data
  medications: z.array(z.object({
    name: z.string(),
    description: z.string(),
    dosage: z.string().optional(),
    sideEffects: z.array(z.string()).optional(),
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

// App Settings table for admin configuration
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentAnalytics = pgTable("payment_analytics", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(), // 'button_click', 'payment_success', etc.
  method: text("method").notNull(), // 'stripe', 'paypal'
  userId: integer("user_id").references(() => users.id),
  amount: numeric("amount"), // Numeric for storing currency values
  currency: text("currency"), // Currency code (USD, EUR, etc.)
  status: text("status"), // Payment status (completed, pending, failed)
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  metadata: jsonb("metadata"), // JSON data for any extra information
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).pick({
  key: true,
  value: true,
});

export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;

export const insertPaymentAnalyticsSchema = createInsertSchema(paymentAnalytics);

export type InsertPaymentAnalytics = z.infer<typeof insertPaymentAnalyticsSchema>;
export type PaymentAnalytics = typeof paymentAnalytics.$inferSelect;

// Admin Authentication
export const adminLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type AdminLoginData = z.infer<typeof adminLoginSchema>;

// Payment method settings schema
export const paymentSettingsSchema = z.object({
  stripeEnabled: z.boolean(),
  paypalEnabled: z.boolean(),
  paypalMode: z.enum(["sandbox", "live"]),
  // Kept for backward compatibility but no longer edited in UI
  // These fields are now managed via environment variables:
  // PAYPAL_CLIENT_ID_SANDBOX, PAYPAL_CLIENT_SECRET_SANDBOX, 
  // PAYPAL_CLIENT_ID_LIVE, PAYPAL_CLIENT_SECRET_LIVE
  paypalSandboxClientId: z.string().optional(),
  paypalSandboxClientSecret: z.string().optional(),
  paypalLiveClientId: z.string().optional(),
  paypalLiveClientSecret: z.string().optional(),
});

export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;
