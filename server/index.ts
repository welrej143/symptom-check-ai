import express, { Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";

// Extended Request type that includes originalUrl
interface Request extends express.Request {
  rawBody?: string;
}

const app = express();

// Special middleware for Stripe webhooks that need the raw body
// This needs to be before express.json() middleware
app.use((req, res, next) => {
  // Only run this middleware for the Stripe webhook route
  if (req.originalUrl === '/api/stripe-webhook') {
    let rawBody = '';
    req.setEncoding('utf8');
    
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    
    req.on('end', () => {
      (req as any).rawBody = rawBody;
      next();
    });
  } else {
    next();
  }
});

// Regular middleware for other routes
app.use(express.json({
  // Don't parse JSON body for Stripe webhook route as we handle it separately
  verify: (req: any, res, buf) => {
    if (req.originalUrl === '/api/stripe-webhook') {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(express.urlencoded({ extended: false }));

// Setup authentication
setupAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Include more error details for better debugging
    const errorDetails = {
      message,
      status,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      name: err.name,
      code: err.code,
      detail: err.detail || err.details,
    };
    
    // Check if error is related to session/authentication which could indicate session table issue
    const isAuthError = 
      err.name === 'TypeError' && 
      (err.message?.includes('passport') || 
       err.message?.includes('session') || 
       err.message?.includes('properties of undefined'));
    
    if (isAuthError) {
      console.error('Authentication/Session error:', JSON.stringify({
        ...errorDetails,
        // Always include stack for auth errors even in production
        stack: err.stack, 
        hint: "This may indicate the session table is not properly initialized"
      }));
    } else {
      console.error('Server error:', JSON.stringify(errorDetails));
    }
    
    // In production, return a simplified error response to the client
    if (process.env.NODE_ENV === 'production') {
      res.status(status).json({
        message: isAuthError ? "Authentication error. Please try logging in again." : message,
        status
      });
    } else {
      // In development, return full error details
      res.status(status).json(errorDetails);
      throw err; // Re-throw in development for better debugging
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
