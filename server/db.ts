import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

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

// Create a pool with more comprehensive error handling
let pool: Pool;
let db: ReturnType<typeof drizzle>;

try {
  console.log("Initializing database connection pool...");
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of clients the pool should contain
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 5000, // Maximum time to wait for a connection from the pool
  });
  
  // Add error handler to the pool
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1); // Exit in case of critical connection errors
  });
  
  db = drizzle({ client: pool, schema });
  console.log("Database connection pool initialized successfully");
} catch (error) {
  console.error("Failed to initialize database connection:", error);
  throw error;
}

export { pool, db };