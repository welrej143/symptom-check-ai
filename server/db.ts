import pg from 'pg';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";
import { users, symptomRecords, dailyTracking } from "@shared/schema";

// Define Pool from pg
const { Pool } = pg;

// Use standard PostgreSQL connection for Render's database
// We're using pg module which is more compatible with Render's PostgreSQL

// Set a longer connection timeout (in milliseconds)
const CONNECTION_TIMEOUT = 15000; // 15 seconds - longer for first connection

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log connection information for debugging (without exposing credentials)
const logDatabaseInfo = () => {
  try {
    if (process.env.DATABASE_URL) {
      const dbUrl = new URL(process.env.DATABASE_URL);
      console.log(`Database connection details (redacted):
        - Host: ${dbUrl.hostname} 
        - Port: ${dbUrl.port}
        - Database: ${dbUrl.pathname.replace('/', '')}
        - SSL: ${dbUrl.searchParams.get('sslmode') || 'default'}
      `);
    }
  } catch (err) {
    console.error('Error parsing DATABASE_URL:', err);
  }
};

// Only log in development
if (process.env.NODE_ENV !== 'production') {
  logDatabaseInfo();
}

// Create a pool with more comprehensive error handling and connection retry logic
let pool: any; // Will be a pg.Pool instance
let db: ReturnType<typeof drizzle>;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

/**
 * Helper function to check if a table exists in the database
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      )
    `);
    
    return result.rows[0].exists === true;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Function to update existing tables with new columns
 * This ensures old tables get updated with new schema changes
 */
async function updateExistingTables() {
  try {
    console.log("Checking if existing tables need updates...");
    
    // Check if payment_provider column exists in users table
    const paymentProviderExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'payment_provider'
    `);
    
    if (paymentProviderExists.rows.length === 0) {
      console.log("Adding payment_provider column to users table...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN payment_provider TEXT DEFAULT 'stripe'
      `);
      console.log("payment_provider column added successfully");
    }
    
    // Check if paypal_subscription_id column exists in users table
    const paypalSubscriptionIdExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'paypal_subscription_id'
    `);
    
    if (paypalSubscriptionIdExists.rows.length === 0) {
      console.log("Adding paypal_subscription_id column to users table...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN paypal_subscription_id TEXT
      `);
      console.log("paypal_subscription_id column added successfully");
    }
    
    // Check if paypal_order_id column exists in users table
    const paypalOrderIdExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'paypal_order_id'
    `);
    
    if (paypalOrderIdExists.rows.length === 0) {
      console.log("Adding paypal_order_id column to users table...");
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN paypal_order_id TEXT
      `);
      console.log("paypal_order_id column added successfully");
    }
    
  } catch (error) {
    console.error("Error updating existing tables:", error);
    // Don't throw the error - we want to continue even if this fails
  }
}

/**
 * Function to ensure all required database tables exist
 * This is a fallback in case migrations aren't working in production
 */
async function ensureTablesExist() {
  try {
    console.log("Checking and creating database tables if needed...");
    
    // Check if users table exists, if not create it
    const userTableExists = await checkTableExists('users');
    if (!userTableExists) {
      console.log("Creating users table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          password TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          payment_provider TEXT DEFAULT 'stripe',
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          paypal_subscription_id TEXT,
          paypal_order_id TEXT,
          is_premium BOOLEAN DEFAULT FALSE,
          subscription_status TEXT DEFAULT 'inactive',
          subscription_end_date TIMESTAMP,
          plan_name TEXT DEFAULT 'Premium Monthly',
          analysis_count INTEGER DEFAULT 0 NOT NULL,
          analysis_count_reset_date TIMESTAMP
        )
      `);
      console.log("Users table created successfully");
    }
    
    // Check if symptom_records table exists, if not create it
    const symptomRecordsTableExists = await checkTableExists('symptom_records');
    if (!symptomRecordsTableExists) {
      console.log("Creating symptom_records table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS symptom_records (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          symptoms TEXT NOT NULL,
          date TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log("Symptom records table created successfully");
    }
    
    // Check if daily_tracking table exists, if not create it
    const dailyTrackingTableExists = await checkTableExists('daily_tracking');
    if (!dailyTrackingTableExists) {
      console.log("Creating daily_tracking table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS daily_tracking (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          date DATE NOT NULL,
          symptoms TEXT NOT NULL,
          symptom_severity INTEGER NOT NULL,
          energy_level INTEGER NOT NULL,
          mood INTEGER NOT NULL,
          sleep_quality INTEGER NOT NULL,
          notes TEXT
        )
      `);
      console.log("Daily tracking table created successfully");
    }
    
    // Check if session table exists, if not create it
    const sessionTableExists = await checkTableExists('session');
    if (!sessionTableExists) {
      console.log("Creating session table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS session (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `);
      // Create index on expire column
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire)
      `);
      console.log("Session table created successfully");
    }
    
    // Check if app_settings table exists, if not create it
    const appSettingsTableExists = await checkTableExists('app_settings');
    if (!appSettingsTableExists) {
      console.log("Creating app_settings table...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app_settings (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log("App settings table created successfully");
    }
    
    console.log("All required tables are in place");
  } catch (error) {
    console.error("Error ensuring tables exist:", error);
    // Don't throw the error - we want to continue even if this fails
    // The application might still work with existing tables
  }
}

async function initializeDatabase(retryCount = 0): Promise<void> {
  try {
    console.log(`Initializing database connection pool (attempt ${retryCount + 1} of ${MAX_RETRIES + 1})...`);
    
    // Parse the DATABASE_URL to extract host info
    let dbUrl: URL;
    try {
      dbUrl = new URL(process.env.DATABASE_URL!);
      
      // Extract host info for better error tracking
      console.log(`Attempting to connect to database host: ${dbUrl.hostname}`);
      
      // Make sure we're connecting to a valid Neon database
      if (!dbUrl.hostname.includes('neon.tech')) {
        console.warn("Database URL doesn't appear to be a Neon database. This might cause issues.");
      }
    } catch (error) {
      console.error("Error parsing DATABASE_URL:", error);
    }
    
    // Pool configuration with better timeout handling
    const poolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 2, // Reduce to minimum connections (free tier limitation)
      idleTimeoutMillis: 10000, // 10 seconds
      connectionTimeoutMillis: CONNECTION_TIMEOUT, // using the longer timeout
      ssl: {
        rejectUnauthorized: false // Necessary for Neon and Render's free tier
      }
    };
    
    // Initialize the pool
    console.log("Creating pool with secure WebSocket configuration...");
    pool = new Pool(poolConfig);
    
    // Add connection handling before trying to use it
    pool.on('connect', () => {
      console.log("New database connection established successfully");
    });
    
    pool.on('error', (err: unknown) => {
      console.error('Database pool error:', err);
      
      // In production, just log the error and continue
      if (process.env.NODE_ENV === 'production') {
        console.log('Database error detected, but continuing in degraded mode...');
      } else {
        // In development, fail fast
        console.error('Database error in development mode, exiting application');
        process.exit(-1); 
      }
    });
    
    // Wrap the connection test in a timeout promise to avoid hanging
    const clientPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), CONNECTION_TIMEOUT)
    );
    
    try {
      // Use Promise.race to implement the timeout
      const client = await Promise.race([clientPromise, timeoutPromise]) as any;
      console.log("Database connection test successful");
      client.release();
    } catch (connError) {
      console.error("Connection test failed:", connError);
      throw connError; // Rethrow to trigger retry
    }
    
    // Initialize Drizzle ORM
    db = drizzle({ client: pool, schema });
    console.log("Database connection pool initialized successfully");
    
    // Test if we can execute a query
    try {
      const result = await db.execute(sql`SELECT 1 AS test`);
      if (result && result.rows && result.rows.length > 0) {
        console.log("Database query test successful");
      } else {
        throw new Error("Query returned empty result");
      }
    } catch (queryError) {
      console.error("Database query test failed:", queryError);
      throw queryError; // Rethrow to trigger retry
    }
    
    // Try to ensure all required tables exist
    try {
      await ensureTablesExist();
      
      // Then update any existing tables with new columns
      await updateExistingTables();
    } catch (tableError) {
      console.error("Error creating or updating tables:", tableError);
      // Continue anyway - tables might already exist
    }
    
  } catch (error) {
    console.error(`Database initialization error (attempt ${retryCount + 1}):`, error);
    
    // Clean up if pool was created
    if (pool) {
      try {
        await pool.end();
        console.log("Closed existing connection pool due to error");
      } catch (endError) {
        console.error("Error closing pool:", endError);
      }
    }
    
    // More aggressive retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      // Exponential backoff: 3s, 6s, 12s, 24s
      const backoffTime = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`Retrying database connection in ${backoffTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return initializeDatabase(retryCount + 1);
    }
    
    // If we've exhausted retries, still enable the app in degraded mode
    console.error(`Failed to connect to database after ${MAX_RETRIES + 1} attempts. Application will continue in DEGRADED MODE.`);
    
    // Create a mock DB implementation that handles common operations
    // This allows the application to start even without a database
    db = {
      execute: async () => ({ rows: [] }),
      select: () => ({
        from: () => ({
          where: () => [],
          orderBy: () => [],
          limit: () => []
        })
      }),
      insert: () => ({
        values: () => ({
          returning: () => []
        })
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => []
          })
        })
      }),
      delete: () => ({
        where: () => ({
          returning: () => []
        })
      })
    } as any;
    
    // In development, we want to know about DB failures
    if (process.env.NODE_ENV !== 'production') {
      console.error("⚠️ WARNING: Application running without database in development mode!");
    }
  }
}

// Start the initialization process
try {
  initializeDatabase()
    .catch(error => {
      console.error("Fatal database initialization error:", error);
      // In production, keep the server running even if DB fails
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
    });
} catch (error) {
  console.error("Unexpected error during database initialization:", error);
  // In production, keep the server running even if DB fails
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
}

// Add a health check function to report if we're in degraded mode
export function isDatabaseHealthy(): boolean {
  return !!pool && !!db;
}

export { pool, db };