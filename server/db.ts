import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import ws from "ws";
import * as schema from "@shared/schema";
import { users, symptomRecords, dailyTracking } from "@shared/schema";

neonConfig.webSocketConstructor = ws;

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
let pool: Pool;
let db: ReturnType<typeof drizzle>;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function initializeDatabase(retryCount = 0): Promise<void> {
  try {
    console.log(`Initializing database connection pool (attempt ${retryCount + 1} of ${MAX_RETRIES + 1})...`);
    
    // Pool configuration
    const poolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: process.env.NODE_ENV === 'production' ? 10 : 20, // Lower connection count in production for Render free tier
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    
    pool = new Pool(poolConfig);
    
    // Test the connection immediately to catch any issues
    const client = await pool.connect();
    
    console.log("Database connection test successful");
    client.release();
    
    // Add error handler to the pool
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client:', err);
      // In production, don't crash the server; instead, attempt to reconnect
      if (process.env.NODE_ENV === 'production') {
        console.log('Attempting to recover from database error...');
      } else {
        process.exit(-1); // In development, fail fast
      }
    });
    
    db = drizzle({ client: pool, schema });
    console.log("Database connection pool initialized successfully");
    
    // Test a basic query to verify the connection is fully working
    await db.execute(sql`SELECT 1 AS test`);
    console.log("Database query test successful");
    
    // Ensure all required tables exist
    await ensureTablesExist();
    
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
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying database connection in ${RETRY_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return initializeDatabase(retryCount + 1);
    }
    
    // If we've exhausted retries, rethrow the error
    throw new Error(`Failed to connect to database after ${MAX_RETRIES + 1} attempts: ${error}`);
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

export { pool, db };