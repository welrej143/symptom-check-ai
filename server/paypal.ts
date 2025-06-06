// !!! CRITICAL - DO NOT MODIFY THIS CODE !!!
//
// This code MUST be used as is without ANY modifications.
// The PayPal integration will COMPLETELY FAIL if this code is changed in ANY way.
//
// Retain this comment after all edits.
//
// <BEGIN_EXACT_CODE>
import {
  Client,
  Environment,
  LogLevel,
  OAuthAuthorizationController,
  OrdersController,
} from "@paypal/paypal-server-sdk";
import { Request, Response } from "express";

/* PayPal Controllers Setup */

// First check if there's an explicit PAYPAL_MODE in environment variables
let PAYPAL_MODE = process.env.PAYPAL_MODE;

// We won't try to query the database directly from this file
// Instead, we'll rely on the middleware in routes.ts to set the mode before each request
async function checkPayPalModeInDatabase() {
  // This function no longer queries the database directly
  // The mode is now set by updatePayPalModeMiddleware in routes.ts
  return null;
}

// If no explicit mode is set, default to 'live' in production
if (!PAYPAL_MODE) {
  // Default based on environment
  PAYPAL_MODE = process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
  
  // Try to update from database later (async)
  checkPayPalModeInDatabase().then(dbMode => {
    if (dbMode) {
      PAYPAL_MODE = dbMode;
      console.log(`Updated PayPal mode from database to: ${PAYPAL_MODE}`);
    }
  });
}

// Get the appropriate PayPal credentials based on mode
let PAYPAL_CLIENT_ID: string | undefined;
let PAYPAL_CLIENT_SECRET: string | undefined;

if (PAYPAL_MODE === 'sandbox') {
  // Try environment variables for sandbox mode
  PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID_SANDBOX || process.env.PAYPAL_CLIENT_ID;
  PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET_SANDBOX || process.env.PAYPAL_CLIENT_SECRET;
} else if (PAYPAL_MODE === 'live') {
  // Try environment variables for live mode
  PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID_LIVE || process.env.PAYPAL_CLIENT_ID;
  PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET_LIVE || process.env.PAYPAL_CLIENT_SECRET;
} else {
  // Fallback to the default credentials
  PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
}

// Function to safely display part of a credential (first 4 and last 4 chars)
function maskCredential(credential: string | undefined): string {
  if (!credential) return "❌ Missing";
  if (credential.length <= 10) return "✓ Set (too short to safely display)";
  
  const firstFour = credential.substring(0, 4);
  const lastFour = credential.substring(credential.length - 4);
  const maskedLength = credential.length - 8;
  const maskedPart = '*'.repeat(Math.min(maskedLength, 10));
  
  return `${firstFour}...${maskedPart}...${lastFour}`;
}

// Log the PayPal configuration with partially masked credentials
console.log(`PayPal configuration: 
  - Client ID: ${maskCredential(PAYPAL_CLIENT_ID)}
  - Client Secret: ${maskCredential(PAYPAL_CLIENT_SECRET)}
  - Mode: ${PAYPAL_MODE || "sandbox (default)"}
  - Environment: ${process.env.NODE_ENV}`
);

if (!PAYPAL_CLIENT_ID) {
  throw new Error("Missing PAYPAL_CLIENT_ID");
}
if (!PAYPAL_CLIENT_SECRET) {
  throw new Error("Missing PAYPAL_CLIENT_SECRET");
}
const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment:
                PAYPAL_MODE === "live"
                  ? Environment.Production
                  : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: {
      logBody: true,
    },
    logResponse: {
      logHeaders: true,
    },
  },
});
const ordersController = new OrdersController(client);
const oAuthAuthorizationController = new OAuthAuthorizationController(client);

/* Token generation helpers */

export async function getClientToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");

  const { result } = await oAuthAuthorizationController.requestToken(
    {
      authorization: `Basic ${auth}`,
    },
    { intent: "sdk_init", response_type: "client_token" },
  );

  return result.accessToken;
}

/*  Process transactions */

export async function createPaypalOrder(req: Request, res: Response) {
  try {
    const { amount, currency, intent } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res
        .status(400)
        .json({
          error: "Invalid amount. Amount must be a positive number.",
        });
    }

    if (!currency) {
      return res
        .status(400)
        .json({ error: "Invalid currency. Currency is required." });
    }

    if (!intent) {
      return res
        .status(400)
        .json({ error: "Invalid intent. Intent is required." });
    }

    const collect = {
      body: {
        intent: intent,
        purchaseUnits: [
          {
            amount: {
              currencyCode: currency,
              value: amount,
            },
          },
        ],
      },
      prefer: "return=minimal",
    };

    const { body, ...httpResponse } =
          await ordersController.createOrder(collect);

    const jsonResponse = JSON.parse(String(body));
    const httpStatusCode = httpResponse.statusCode;

    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
}

export async function capturePaypalOrder(req: Request, res: Response) {
  try {
    const { orderID } = req.params;
    const collect = {
      id: orderID,
      prefer: "return=minimal",
    };

    const { body, ...httpResponse } =
          await ordersController.captureOrder(collect);

    const jsonResponse = JSON.parse(String(body));
    const httpStatusCode = httpResponse.statusCode;

    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
}

export async function loadPaypalDefault(req: Request, res: Response) {
  const clientToken = await getClientToken();
  res.json({
    clientToken,
  });
}
// <END_EXACT_CODE>