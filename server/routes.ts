import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import OpenAI from "openai";
import Stripe from "stripe";
import z from "zod";
import { symptomInputSchema, analysisResponseSchema } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  
  // Setup OpenAI
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "sk-dummy",
  });

  // Analyze symptoms route
  app.post("/api/analyze-symptoms", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const validation = symptomInputSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: validation.error.format() 
        });
      }
      
      const { symptoms } = validation.data;
      
      // Check if user is premium or still has free analyses
      const user = req.user;
      const FREE_ANALYSIS_LIMIT = 3; // Users get 3 free analyses per month
      
      if (!user.isPremium) {
        // Increment the analysis count and get the new count
        const analysisCount = await storage.incrementAnalysisCount(user.id);
        
        // Check if the user has reached the limit
        if (analysisCount > FREE_ANALYSIS_LIMIT) {
          return res.status(402).json({
            message: "Free analysis limit reached",
            limit: FREE_ANALYSIS_LIMIT,
            count: analysisCount,
            upgrade: true
          });
        }
      }
      
      // Store the symptom record with user ID
      await storage.createSymptomRecord({
        userId: req.user.id, 
        symptoms,
        date: new Date(), // This is okay since symptomRecords uses timestamp
      });
      
      // Call OpenAI API to analyze symptoms
      const prompt = `
        As a healthcare AI assistant, analyze these symptoms: ${symptoms}
        
        Provide a detailed analysis in JSON format with the following structure:
        {
          "userSymptoms": "the symptoms provided by user",
          "conditions": [
            {
              "name": "Condition name",
              "description": "Brief description of the condition",
              "symptoms": ["symptom1", "symptom2", "etc"],
              "causes": ["cause1", "cause2", "etc"],
              "urgencyLevel": "low/moderate/high",
              "medications": [
                {
                  "name": "Medication name",
                  "description": "Brief description of how this medication helps",
                  "dosage": "Typical dosage information (optional)",
                  "sideEffects": ["side effect 1", "side effect 2", "etc"] (optional)
                }
              ],
              "supplements": [
                {
                  "name": "Supplement name",
                  "description": "Brief description of how this supplement helps",
                  "dosage": "Typical dosage information (optional)",
                  "benefits": ["benefit 1", "benefit 2", "etc"] (optional)
                }
              ]
            }
          ],
          "urgencyLevel": "low/moderate/high",
          "urgencyText": "Text explaining the urgency level",
          "recommendations": [
            {
              "title": "Recommendation title",
              "description": "Detailed description of recommendation",
              "icon": "icon name from Lucide React iconset",
              "isEmergency": true/false (optional)
            }
          ]
        }
        
        Important guidelines:
        1. Return exactly 3 possible conditions based on the symptoms
        2. For each condition, provide common symptoms (4-6 symptoms per condition)
        3. For each condition, provide 2-4 common causes or risk factors that may lead to this condition
        4. Set urgencyLevel to either "low" (monitor at home), "moderate" (see doctor soon), or "high" (emergency)
        5. Provide 3-5 actionable recommendations
        6. For each condition, include 1-3 relevant medications that are commonly prescribed
        7. For each condition, include 1-3 relevant supplements that may help with symptoms
        8. For the icon field, use only icon names from Lucide React (like "stethoscope", "thermometer", "clipboard", etc.)
        9. ALWAYS include disclaimer text about consulting healthcare professionals
        10. If symptoms suggest a potentially life-threatening condition, mark the recommendation with isEmergency: true
        
        Response should be properly formatted JSON only, without any additional text.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const analysisContent = response.choices[0].message.content;
      
      if (!analysisContent) {
        return res.status(500).json({ message: "Failed to analyze symptoms" });
      }
      
      try {
        const analysisData = JSON.parse(analysisContent);
        console.log("ANALYSIS DATA:", JSON.stringify(analysisData, null, 2));
        console.log("Does it have causes?", analysisData.conditions?.[0]?.causes ? "YES" : "NO");
        const validatedData = analysisResponseSchema.parse(analysisData);
        res.json(validatedData);
      } catch (error) {
        console.error("Error parsing or validating OpenAI response:", error);
        res.status(500).json({ message: "Failed to process analysis results" });
      }
    } catch (error) {
      console.error("Error analyzing symptoms:", error);
      res.status(500).json({ message: "Error analyzing symptoms" });
    }
  });

  // Get symptom records
  app.get("/api/symptom-records", async (req: Request, res: Response) => {
    try {
      const records = await storage.getSymptomRecords();
      res.json(records);
    } catch (error) {
      console.error("Error fetching symptom records:", error);
      res.status(500).json({ message: "Error fetching symptom records" });
    }
  });

  // Track daily symptoms
  app.post("/api/track-symptoms", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { 
        symptomSeverity, 
        symptoms, 
        energyLevel, 
        mood, 
        sleepQuality, 
        notes 
      } = req.body;
      
      // Validate required fields
      if (!symptomSeverity || !symptoms || !energyLevel || !mood || !sleepQuality) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Store the daily tracking data
      const tracking = await storage.createDailyTracking({
        userId: req.user.id,
        date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
        symptoms,
        symptomSeverity,
        energyLevel,
        mood,
        sleepQuality,
        notes: notes || null,
      });
      
      res.json(tracking);
    } catch (error) {
      console.error("Error tracking symptoms:", error);
      res.status(500).json({ message: "Error tracking symptoms" });
    }
  });

  // Get daily tracking data
  app.get("/api/tracking-data", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const data = await storage.getDailyTrackingData(days, req.user.id);
      res.json(data);
    } catch (error) {
      console.error("Error fetching tracking data:", error);
      res.status(500).json({ message: "Error fetching tracking data" });
    }
  });

  // Get user's analysis usage count
  app.get("/api/usage-count", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = req.user;
      
      // For premium users, usage count doesn't matter
      if (user.isPremium) {
        return res.json({
          count: 0,
          limit: null,
          unlimited: true
        });
      }
      
      // Get the current analysis count
      const count = await storage.getAnalysisCount(user.id);
      const FREE_ANALYSIS_LIMIT = 3;
      
      res.json({
        count,
        limit: FREE_ANALYSIS_LIMIT,
        unlimited: false,
        remaining: Math.max(0, FREE_ANALYSIS_LIMIT - count)
      });
    } catch (error) {
      console.error("Error getting usage count:", error);
      res.status(500).json({ message: "Error retrieving usage information" });
    }
  });

  // Create a proper Stripe subscription
  app.post("/api/create-subscription", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user;
      
      // Check if user already has an active subscription
      if (user.isPremium && user.subscriptionStatus === 'active') {
        return res.status(400).json({ message: "User already has an active subscription" });
      }

      // Create or retrieve a Stripe customer
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.username,
          metadata: {
            userId: user.id.toString(),
          },
        });
        
        customerId = customer.id;
        
        // Update user with Stripe customer ID
        await storage.updateUserStripeInfo(user.id, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: "",
        });
      }

      // Ensure the STRIPE_PRICE_ID is available
      const stripePriceId = process.env.STRIPE_PRICE_ID;
      if (!stripePriceId) {
        console.error('Missing STRIPE_PRICE_ID environment variable');
        return res.status(500).json({ 
          message: "Missing Stripe price ID. Please set the STRIPE_PRICE_ID environment variable.",
          errorType: "configuration"
        });
      }
      
      // Validate the price ID format (should start with "price_")
      if (!stripePriceId.startsWith('price_')) {
        console.error('Invalid STRIPE_PRICE_ID format. It should start with "price_", got:', stripePriceId);
        return res.status(500).json({ 
          message: "Invalid Stripe price ID format. It should start with 'price_'.",
          errorType: "configuration",
          priceIdPrefix: stripePriceId.substring(0, 5) + "..."
        });
      }
      
      // Create a subscription with Stripe
      console.log("Creating subscription with Stripe price ID:", stripePriceId);
      
      try {
        // Create subscription directly - this is the recommended approach
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [
            {
              price: stripePriceId,
            },
          ],
          payment_behavior: 'default_incomplete',
          payment_settings: {
            payment_method_types: ['card'],
            save_default_payment_method: 'on_subscription'
          },
          // No expand here - we'll get the invoice and payment intent separately
          metadata: {
            userId: user.id.toString(),
          },
        });
        
        console.log("Subscription created:", subscription.id, "with status:", subscription.status);
        
        // Get the invoice separately
        const invoiceId = subscription.latest_invoice as string;
        if (!invoiceId) {
          throw new Error("No invoice found for the created subscription");
        }
        
        console.log("Retrieving invoice:", invoiceId);
        const invoice = await stripe.invoices.retrieve(invoiceId, {
          expand: ['payment_intent']
        });
        
        // Get the payment intent client secret
        if (!invoice.payment_intent || typeof invoice.payment_intent === 'string') {
          throw new Error("No payment intent found on the subscription invoice");
        }
        
        const clientSecret = invoice.payment_intent.client_secret;
        
        // Update user with the subscription ID
        await storage.updateUserStripeInfo(user.id, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
        });
        
        // Return both the client secret and subscription ID
        res.json({
          clientSecret: clientSecret,
          subscriptionId: subscription.id,
        });
      } catch (subscriptionError) {
        console.error("Failed to create subscription:", subscriptionError);
        return res.status(500).json({ 
          message: "Failed to create subscription with payment provider",
          error: subscriptionError.message
        });
      }
    } catch (error) {
      console.error("Error setting up subscription:", error);
      res.status(500).json({ message: "Error setting up subscription" });
    }
  });

  // Get pricing information from Stripe
  app.get("/api/pricing", async (_req: Request, res: Response) => {
    try {
      // Get price ID from environment variable
      const stripePriceId = process.env.STRIPE_PRICE_ID;
      if (!stripePriceId) {
        console.error('Missing STRIPE_PRICE_ID environment variable');
        return res.status(500).json({ 
          message: "Missing Stripe price ID configuration",
          errorType: "configuration"
        });
      }
      
      // Fetch the price details from Stripe
      console.log("Fetching price details from Stripe:", stripePriceId);
      const price = await stripe.prices.retrieve(stripePriceId, {
        expand: ['product']
      });
      
      // Extract the relevant details
      const priceDetails = {
        id: price.id,
        amount: price.unit_amount || 0,
        currency: price.currency,
        interval: price.recurring ? price.recurring.interval : 'month',
        intervalCount: price.recurring ? price.recurring.interval_count : 1,
        formattedPrice: formatPrice(price.unit_amount || 0, price.currency),
        productName: (price.product as any)?.name || 'Premium Subscription',
        productDescription: (price.product as any)?.description || 'Unlimited symptom analyses and premium features'
      };
      
      res.json(priceDetails);
    } catch (error) {
      console.error("Error fetching price details from Stripe:", error);
      res.status(500).json({ 
        message: "Error fetching pricing information",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Format price amount based on currency
  function formatPrice(amount: number, currency: string): string {
    // Convert amount from cents to dollars/euros/etc.
    const value = amount / 100;
    
    // Format based on currency
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value);
  }
  
  // Check subscription status
  app.get("/api/subscription", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user;
      console.log("Checking subscription status for user:", user.username);
      
      // If we have a customer ID in Stripe, we can look up their subscriptions directly
      if (user.stripeCustomerId) {
        try {
          console.log(`Fetching subscriptions for customer ${user.stripeCustomerId}`);
          
          // Get all subscriptions for this customer
          const subscriptionsResult = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'all', // Get all subscriptions including active, past_due, canceled, etc.
            limit: 1       // We only need the most recent one
          });
          
          // If we found any subscription
          if (subscriptionsResult.data.length > 0) {
            const subscription = subscriptionsResult.data[0];
            console.log(`Found Stripe subscription: ${subscription.id}, status: ${subscription.status}`);
            
            // Calculate the subscription end date from Stripe's data
            let endDate;
            try {
              // First try current_period_end
              if ((subscription as any).current_period_end) {
                endDate = new Date((subscription as any).current_period_end * 1000);
              }
              // If that's not available, try billing_cycle_anchor for incomplete subscriptions
              else if ((subscription as any).billing_cycle_anchor) {
                console.log("Using billing_cycle_anchor for subscription end date");
                const anchor = new Date((subscription as any).billing_cycle_anchor * 1000);
                endDate = new Date(anchor);
                endDate.setMonth(endDate.getMonth() + 1);
              }
              else {
                // Set a default date 1 month from now
                endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 1);
              }
            } catch (dateError) {
              console.error("Error retrieving subscriptions from Stripe:", dateError);
              // Fallback to one month from now
              endDate = new Date();
              endDate.setMonth(endDate.getMonth() + 1);
            }
            
            // Determine status from Stripe
            let status = subscription.status;
            if (subscription.cancel_at_period_end) {
              status = 'canceled';
            }
            
            // Make sure we're always in sync with Stripe
            const userEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : undefined;
            const subscriptionIdChanged = user.stripeSubscriptionId !== subscription.id;
            
            // Get the plan name from the first subscription item
            let planName = "Premium Monthly"; // Default fallback
            
            try {
              if (subscription.items.data && subscription.items.data.length > 0) {
                // Get the first item's price
                const firstItem = subscription.items.data[0];
                if (firstItem.price && firstItem.price.product) {
                  // Get the product details to get the product name
                  const product = await stripe.products.retrieve(firstItem.price.product as string);
                  if (product && product.name) {
                    planName = product.name;
                    console.log(`Found plan name from Stripe: ${planName}`);
                  }
                }
              }
            } catch (productError) {
              console.error("Error fetching plan name:", productError);
              // Continue with default plan name
            }
            
            if (status !== user.subscriptionStatus || 
                !datesEqual(endDate, userEndDate) ||
                subscriptionIdChanged ||
                user.planName !== planName) {
              console.log(`Updating subscription data from Stripe:`);
              console.log(`- Status: ${user.subscriptionStatus} -> ${status}`);
              console.log(`- End date: ${userEndDate?.toISOString()} -> ${endDate.toISOString()}`);
              if (subscriptionIdChanged) {
                console.log(`- Subscription ID: ${user.stripeSubscriptionId} -> ${subscription.id}`);
              }
              console.log(`- Plan name: ${user.planName} -> ${planName}`);
              
              // Update both status and subscription ID if needed
              await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
              
              if (subscriptionIdChanged) {
                await storage.updateUserStripeInfo(user.id, {
                  stripeCustomerId: user.stripeCustomerId,
                  stripeSubscriptionId: subscription.id,
                });
              }
            }
            
            // Only mark as premium if subscription is actually active
            const isPremium = status === 'active';
            
            return res.json({
              isPremium: isPremium,
              subscriptionStatus: status,
              subscriptionEndDate: endDate,
              subscriptionId: subscription.id,
              planName: planName,
              // Additional subscription details from Stripe
              currentPeriodStart: (subscription as any).current_period_start 
                ? new Date((subscription as any).current_period_start * 1000)
                : new Date(),
              currentPeriodEnd: endDate,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              directFromStripe: true,
              // Add payment intent info for incomplete subscriptions
              // This is safer than trying to access nested properties of latest_invoice
              paymentIntentStatus: status === 'incomplete' ? 'needs_payment_method' : null
            });
          } else {
            console.log(`No active subscriptions found for customer ${user.stripeCustomerId}`);
            
            // Try to look up by current subscription ID as a fallback
            if (user.stripeSubscriptionId && user.stripeSubscriptionId.startsWith('sub_')) {
              try {
                console.log(`Trying to fetch specific subscription ${user.stripeSubscriptionId}`);
                const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                
                // Calculate the subscription end date from Stripe's data
                const endDate = new Date((subscription as any).current_period_end * 1000);
                
                // Determine status from Stripe
                let status = subscription.status;
                if (subscription.cancel_at_period_end) {
                  status = 'canceled';
                }
                
                // Get the plan name from the first subscription item
                let planName = "Premium Monthly"; // Default fallback
                
                try {
                  if (subscription.items.data && subscription.items.data.length > 0) {
                    // Get the first item's price
                    const firstItem = subscription.items.data[0];
                    if (firstItem.price && firstItem.price.product) {
                      // Get the product details to get the product name
                      const product = await stripe.products.retrieve(firstItem.price.product as string);
                      if (product && product.name) {
                        planName = product.name;
                        console.log(`Found plan name from Stripe: ${planName}`);
                      }
                    }
                  }
                } catch (productError) {
                  console.error("Error fetching plan name:", productError);
                  // Continue with default plan name
                }
                
                // Update our database to match Stripe
                const userEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : undefined;
                if (status !== user.subscriptionStatus || 
                    !datesEqual(endDate, userEndDate) ||
                    user.planName !== planName) {
                  console.log(`Updating status from ${user.subscriptionStatus} to ${status} and end date to ${endDate.toISOString()}`);
                  console.log(`Plan name: ${user.planName} -> ${planName}`);
                  await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
                }
                
                // Only mark as premium if status is active
                const isPremium = status === 'active';
                
                return res.json({
                  isPremium: isPremium,
                  subscriptionStatus: status,
                  subscriptionEndDate: endDate,
                  planName: planName,
                  subscriptionId: user.stripeSubscriptionId,
                  // Additional subscription details from Stripe
                  currentPeriodStart: (subscription as any).current_period_start 
                    ? new Date((subscription as any).current_period_start * 1000)
                    : new Date(),
                  currentPeriodEnd: endDate,
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                  directFromStripe: true,
                  // Add payment intent info for incomplete subscriptions
                  // This is safer than trying to access nested properties of latest_invoice
                  paymentIntentStatus: status === 'incomplete' ? 'needs_payment_method' : null
                });
              } catch (error) {
                console.error(`Error retrieving subscription details from Stripe: ${error}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error retrieving subscriptions from Stripe: ${error}`);
        }
      } else if (user.stripeSubscriptionId && user.stripeSubscriptionId.startsWith('sub_')) {
        // If we don't have a customer ID but do have a subscription ID, try that
        try {
          console.log(`Fetching subscription ${user.stripeSubscriptionId} details from Stripe`);
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          
          // Calculate the subscription end date from Stripe's data
          const endDate = new Date((subscription as any).current_period_end * 1000);
          
          // Determine status from Stripe
          let status = subscription.status;
          if (subscription.cancel_at_period_end) {
            status = 'canceled';
          }
          
          // Get the plan name from the first subscription item
          let planName = "Premium Monthly"; // Default fallback
          
          try {
            if (subscription.items.data && subscription.items.data.length > 0) {
              // Get the first item's price
              const firstItem = subscription.items.data[0];
              if (firstItem.price && firstItem.price.product) {
                // Get the product details to get the product name
                const product = await stripe.products.retrieve(firstItem.price.product as string);
                if (product && product.name) {
                  planName = product.name;
                  console.log(`Found plan name from Stripe: ${planName}`);
                }
              }
            }
          } catch (productError) {
            console.error("Error fetching plan name:", productError);
            // Continue with default plan name
          }
          
          // Make sure we're always in sync with Stripe
          const userEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : undefined;
          if (status !== user.subscriptionStatus || 
              !datesEqual(endDate, userEndDate) ||
              user.planName !== planName) {
            console.log(`Updating status from ${user.subscriptionStatus} to ${status} and end date to ${endDate.toISOString()}`);
            console.log(`Plan name: ${user.planName} -> ${planName}`);
            await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
          }
          
          return res.json({
            isPremium: status === 'active', // Only set to true if status is actually 'active'
            subscriptionStatus: status,
            subscriptionEndDate: endDate,
            planName: planName,
            subscriptionId: user.stripeSubscriptionId,
            // Additional subscription details from Stripe
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: endDate,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            directFromStripe: true
          });
        } catch (error) {
          console.error(`Error retrieving subscription details from Stripe: ${error}`);
          // Fall back to database info if Stripe API fails
        }
      }
      
      // If we reach here, we couldn't get fresh data from Stripe
      console.log("Could not retrieve fresh subscription data from Stripe");
      res.status(404).json({
        error: "No active subscription found",
        message: "Unable to retrieve subscription details from Stripe. Please contact support if you believe this is an error."
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      res.status(500).json({ message: "Error checking subscription" });
    }
  });
  
  // Helper function to compare dates (ignoring milliseconds)
  function datesEqual(date1: Date, date2?: Date): boolean {
    if (!date2) return false;
    return Math.abs(date1.getTime() - date2.getTime()) < 1000; // Within 1 second
  }

  // Update premium status (after payment)
  app.post("/api/update-premium-status", async (req: Request, res: Response) => {
    try {
      console.log("*** PAYMENT UPDATE REQUEST RECEIVED ***");
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      if (!req.isAuthenticated()) {
        console.log("User not authenticated");
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user;
      console.log("User:", JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        subscriptionStatus: user.subscriptionStatus
      }, null, 2));
      
      const { paymentIntentId, subscriptionId } = req.body;
      
      if (!paymentIntentId) {
        console.log("No payment intent ID provided");
        return res.status(400).json({ message: "Payment intent ID is required" });
      }
      
      console.log(`Processing payment update: paymentIntentId=${paymentIntentId}, subscriptionId=${subscriptionId || 'none'}`);
      
      // Ensure the STRIPE_PRICE_ID is available
      const stripePriceId = process.env.STRIPE_PRICE_ID;
      if (!stripePriceId) {
        console.error('Missing STRIPE_PRICE_ID environment variable');
        return res.status(500).json({ 
          message: "Missing Stripe price ID. Please set the STRIPE_PRICE_ID environment variable.",
          errorType: "configuration"
        });
      }
      
      console.log("Using Stripe price ID:", stripePriceId);
      
      // Check if it's a simulated payment for testing
      if (paymentIntentId.startsWith("pi_simulated_")) {
        console.log("Using simulated payment for testing:", paymentIntentId);
        // Continue with the subscription update below
      } else {
        // For real payments, verify with Stripe
        try {
          console.log("Retrieving payment intent from Stripe:", paymentIntentId);
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          console.log("Payment intent status:", paymentIntent.status);
          
          if (paymentIntent.status !== 'succeeded') {
            console.log("Payment intent not successful:", paymentIntent.status);
            return res.status(400).json({ message: "Payment has not been completed successfully" });
          }
          
          console.log("Payment is successful, proceeding with subscription creation");
          
          // Create or verify customer ID
          let customerId = user.stripeCustomerId;
          
          if (!customerId) {
            // Create a new customer in Stripe
            const customer = await stripe.customers.create({
              email: user.email,
              name: user.username,
              metadata: {
                userId: user.id.toString(),
              },
            });
            
            customerId = customer.id;
            
            // Update user with Stripe customer ID
            await storage.updateUserStripeInfo(user.id, {
              stripeCustomerId: customerId,
              stripeSubscriptionId: "", // Will be updated after subscription creation
            });
          }
          
          // Create a real subscription record in Stripe
          try {
            // Get payment method from the payment intent
            console.log("Getting payment method from payment intent:", paymentIntentId);
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ['payment_method']
            });
            
            // Get the payment method from the payment intent
            let paymentMethodId = pi.payment_method as string | { id: string };
            
            if (!paymentMethodId) {
              console.error("No payment method found on payment intent", paymentIntentId);
              throw new Error("No payment method found on payment intent");
            }
            
            console.log(`Attaching payment method ${typeof paymentMethodId === 'string' ? paymentMethodId : 'OBJECT'} to customer ${customerId}`);
            
            // Make sure paymentMethodId is a string
            if (typeof paymentMethodId !== 'string') {
              console.error("Payment method ID is not a string:", paymentMethodId);
              
              // If it's an object with an id property, extract the id
              if (paymentMethodId && typeof paymentMethodId === 'object' && 'id' in paymentMethodId) {
                paymentMethodId = paymentMethodId.id;
                console.log("Extracted payment method ID:", paymentMethodId);
              } else {
                throw new Error("Invalid payment method ID format");
              }
            }
            
            let attachmentSuccessful = false;
            try {
              // Attach the payment method to the customer
              await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
              });
              attachmentSuccessful = true;
            } catch (attachError: any) {
              // Handle specific error for reused payment methods
              if (attachError?.type === 'StripeInvalidRequestError' && 
                  attachError?.raw?.message?.includes('previously used without being attached')) {
                console.log("Payment method was previously used. Will create a new one in the subscription.");
                
                // Don't need to attach - will be created with the subscription
                // Just continue without setting as default
              } else {
                // For other errors, rethrow
                throw attachError;
              }
            }
            
            // Set as default payment method only if we successfully attached
            if (attachmentSuccessful) {
              await stripe.customers.update(customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
              });
            }
            
            console.log("Creating actual Stripe subscription with price ID:", stripePriceId);
            
            // Check if the user already has a subscription that's incomplete
            if (user.stripeSubscriptionId && user.stripeSubscriptionId.startsWith('sub_')) {
              try {
                console.log(`Checking if subscription ${user.stripeSubscriptionId} already exists and is incomplete`);
                const existingSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                
                if (existingSubscription.status === 'incomplete') {
                  console.log(`Found existing incomplete subscription: ${user.stripeSubscriptionId}`);
                  
                  // Try to update the existing subscription instead of creating a new one
                  try {
                    // Get the latest invoice for this subscription
                    const latestInvoice = await stripe.invoices.retrieve(existingSubscription.latest_invoice as string);
                    
                    if (latestInvoice.status === 'open') {
                      console.log(`Paying open invoice ${latestInvoice.id} with payment method ${paymentMethodId}`);
                      
                      // Try to pay the invoice with the new payment method
                      if (latestInvoice.id) {
                        await stripe.invoices.pay(latestInvoice.id, {
                          payment_method: paymentMethodId
                        });
                      }
                      
                      // Get the updated subscription
                      const updatedSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                      console.log(`Updated subscription status: ${updatedSub.status}`);
                      
                      // Calculate end date - using 'as any' because TypeScript doesn't recognize the property correctly
                      const endDate = new Date(((updatedSub as any).current_period_end as number) * 1000);
                      
                      // Update user's subscription status
                      await storage.updateSubscriptionStatus(
                        user.id, 
                        updatedSub.status, 
                        endDate
                      );
                      
                      // Return success response
                      return res.json({
                        message: "Subscription payment completed successfully",
                        isPremium: updatedSub.status === 'active',
                        subscriptionStatus: updatedSub.status,
                        subscriptionEndDate: endDate,
                        subscriptionId: updatedSub.id
                      });
                    }
                  } catch (invoiceError) {
                    console.error("Error updating incomplete subscription:", invoiceError);
                    // Continue with creating a new subscription
                  }
                }
              } catch (subError) {
                console.log("Could not retrieve existing subscription:", subError);
                // Continue with creating a new subscription
              }
            }
            
            // If we got here, we need to create a new subscription
            console.log("Creating a new subscription with payment method");
            
            // Create subscription options with payment method
            const subscriptionOptions: any = {
              customer: customerId,
              items: [
                {
                  price: stripePriceId, // Use the price ID from env vars
                },
              ],
              // Don't try to expand payment_intent as it will cause API errors
              metadata: {
                paymentIntentId: paymentIntentId, // Link back to the original payment intent
                userId: user.id.toString(),
              },
            };
            
            // Always collect a payment and upgrade immediately
            subscriptionOptions.payment_behavior = 'default_incomplete';
            subscriptionOptions.payment_settings = {
              payment_method_types: ['card'],
              save_default_payment_method: 'on_subscription'
            };
            
            // Set default payment method if available
            if (attachmentSuccessful) {
              subscriptionOptions.default_payment_method = paymentMethodId;
            }
            
            const subscription = await stripe.subscriptions.create(subscriptionOptions);
            
            console.log("Created subscription in Stripe:", subscription.id);
            
            // Now we have a real subscription ID starting with sub_
            const realSubscriptionId = subscription.id;
            
            // If subscription is incomplete, try to confirm payment immediately
            if (subscription.status === 'incomplete' && subscription.latest_invoice) {
              console.log("Subscription created with incomplete status, trying to confirm payment");
              
              try {
                // Get the invoice details
                const invoice = await stripe.invoices.retrieve(subscription.latest_invoice as string);
                
                // Handle the payment intent - Stripe returns this value but TypeScript doesn't recognize it
                // We'll use object destructuring to safely handle this
                const { payment_intent: paymentIntentId } = invoice as any;
                
                // Only proceed if we actually got a payment intent ID
                let paymentIntent = null;
                if (paymentIntentId && typeof paymentIntentId === 'string') {
                  paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                  console.log(`Retrieved payment intent ${paymentIntentId} with status: ${paymentIntent.status}`);
                }
                if (paymentIntent) {
                  console.log(`Invoice payment intent status: ${paymentIntent.status}`);
                  
                  // If the payment intent is still requires_payment_method, try to update it
                  if (paymentIntent.status === 'requires_payment_method') {
                    console.log("Payment intent needs payment method, updating with our confirmed payment intent");
                    
                    // Try to confirm the payment intent with our payment method
                    try {
                      await stripe.paymentIntents.update(paymentIntent.id, {
                        payment_method: paymentMethodId
                      });
                      
                      // Confirm the payment intent
                      await stripe.paymentIntents.confirm(paymentIntent.id);
                      
                      console.log("Updated payment intent with our payment method");
                      
                      // Refresh the subscription to get updated status
                      const updatedSubscription = await stripe.subscriptions.retrieve(subscription.id);
                      console.log(`Updated subscription status: ${updatedSubscription.status}`);
                      
                      // We can't reassign the subscription constant, so we'll use the updated values directly
                      // Just log the updated status
                      console.log("Using updated subscription data for further processing");
                    } catch (paymentError) {
                      console.error("Error updating payment intent:", paymentError);
                      // Continue with the existing subscription
                    }
                  }
                }
              } catch (invoiceError) {
                console.error("Error processing invoice for new subscription:", invoiceError);
                // Continue with original subscription
              }
            }
            
            // Calculate end date based on the subscription
            let endDate;
            try {
              // For a newly created subscription, check current_period_end on the actual result
              // For 'incomplete' subscriptions, use billing_cycle_anchor instead as current_period_end may not be set yet
              let timestamp;
              
              // First try current_period_end
              if ((subscription as any).current_period_end) {
                timestamp = Number((subscription as any).current_period_end) * 1000;
              }
              // If that's not available, try billing_cycle_anchor
              else if ((subscription as any).billing_cycle_anchor) {
                console.log("Using billing_cycle_anchor instead of current_period_end");
                // Calculate one month from billing_cycle_anchor for incomplete subscriptions
                const anchor = Number((subscription as any).billing_cycle_anchor) * 1000;
                const anchorDate = new Date(anchor);
                // Add one month
                const oneMonthFromAnchor = new Date(anchorDate);
                oneMonthFromAnchor.setMonth(oneMonthFromAnchor.getMonth() + 1);
                timestamp = oneMonthFromAnchor.getTime();
              } 
              // As a last resort, set a date one month from now
              else {
                console.log("No valid timestamp found in subscription, using default date");
                const now = new Date();
                now.setMonth(now.getMonth() + 1);
                timestamp = now.getTime();
              }
              
              // Verify the timestamp and create the date
              if (!isNaN(timestamp) && timestamp > 0) {
                endDate = new Date(timestamp);
                console.log(`End date: ${endDate.toISOString()}`);
              } else {
                throw new Error('Invalid timestamp value');
              }
            } catch (dateError) {
              console.error('Error creating subscription end date:', dateError);
              // Set a default end date (1 month from now) if we can't get it from Stripe
              endDate = new Date();
              endDate.setMonth(endDate.getMonth() + 1);
              console.log(`Using default end date: ${endDate.toISOString()}`);
            }
            
            // Get plan name from the subscription product
            let planName = "Premium Monthly"; // Default
            try {
              if (subscription.items.data && subscription.items.data.length > 0) {
                const item = subscription.items.data[0];
                if (item.price && item.price.product) {
                  const product = await stripe.products.retrieve(item.price.product as string);
                  if (product.name) {
                    planName = product.name;
                  }
                }
              }
            } catch (productError) {
              console.error("Error getting plan name:", productError);
            }
            
            // Use the actual status from Stripe instead of assuming 'active'
            const actualStatus = subscription.status;
            const isPremium = actualStatus === 'active';
            
            console.log(`Using actual Stripe subscription status: ${actualStatus}, isPremium: ${isPremium}`);
            await storage.updateSubscriptionStatus(user.id, actualStatus, endDate, planName);
            
            // Save the real subscription ID
            await storage.updateUserStripeInfo(user.id, { 
              stripeCustomerId: customerId,
              stripeSubscriptionId: realSubscriptionId,
            });
            
            res.json({ 
              message: "Premium status updated successfully with Stripe subscription",
              isPremium: isPremium, // Only true if subscription is active
              subscriptionStatus: actualStatus,
              subscriptionEndDate: endDate,
              subscriptionId: realSubscriptionId,
              planName: planName
            });
            
            return; // Exit early since we've handled everything
            
          } catch (subCreationError) {
            console.error("Error creating subscription:", subCreationError);
            // Continue with fallback approach if subscription creation fails
          }
        } catch (stripeError) {
          console.error("Stripe error:", stripeError);
          return res.status(400).json({ message: "Could not verify payment with Stripe" });
        }
      }
      
      // Determine endDate and status
      let endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      // Default to 'incomplete' instead of 'active' to avoid false positives
      let status = 'incomplete';
      
      // If we have a subscription ID, use it to get accurate info
      if (subscriptionId) {
        try {
          // Check if the ID starts with 'sub_' (a subscription) or 'pi_' (payment intent)
          if (subscriptionId.startsWith('sub_')) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            // Update end date based on the subscription
            try {
              if ((subscription as any).current_period_end) {
                // Ensure it's a valid timestamp and create a Date
                const timestamp = Number((subscription as any).current_period_end) * 1000;
                if (!isNaN(timestamp) && timestamp > 0) {
                  endDate = new Date(timestamp);
                  // Validate the date
                  if (isNaN(endDate.getTime())) {
                    throw new Error('Invalid date created from timestamp');
                  }
                  console.log(`End date from Stripe: ${endDate.toISOString()}`);
                } else {
                  throw new Error('Invalid or missing timestamp');
                }
              } else {
                throw new Error('No current_period_end provided');
              }
            } catch (dateError) {
              console.error('Error creating subscription end date:', dateError);
              // Keep using the default end date we already set
              console.log(`Using default end date: ${endDate.toISOString()}`);
            }
            
            // Use the exact status from Stripe
            status = subscription.status;
            console.log(`Using Stripe subscription status: ${status}`);
            
            // If subscription is canceled at period end but still active
            if (subscription.cancel_at_period_end && status === 'active') {
              status = 'canceled';
            }
          } else {
            // It's a payment intent (pi_) or something else, just use default dates
            console.log("Using one-time payment model with ID:", subscriptionId);
            // Important: For payment intents, verify the status with Stripe before setting to active
            try {
              // If it starts with 'pi_', it's a payment intent
              if (subscriptionId.startsWith('pi_')) {
                const paymentIntent = await stripe.paymentIntents.retrieve(subscriptionId);
                if (paymentIntent.status === 'succeeded') {
                  // Only set as active if payment has succeeded
                  status = 'active';
                } else {
                  console.log(`Payment intent status is ${paymentIntent.status}, not marking as active`);
                  // Keep default 'incomplete' status
                }
              }
            } catch (piError) {
              console.error("Error checking payment intent status:", piError);
              // Keep default status
            }
          }
        } catch (subError) {
          console.error("Error retrieving subscription:", subError);
          // Continue with default values if we can't get the subscription
        }
      }
      
      // Update user subscription status
      await storage.updateSubscriptionStatus(user.id, status, endDate);
      
      // Save subscription info
      const newSubscriptionId = subscriptionId || paymentIntentId;
      await storage.updateUserStripeInfo(user.id, { 
        stripeCustomerId: user.stripeCustomerId || '',
        stripeSubscriptionId: newSubscriptionId,
      });
      
      // Use a default plan name
      const planName = "Premium Monthly";
      
      // Update with plan name too
      await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
      
      res.json({ 
        message: "Premium status updated successfully",
        isPremium: status === 'active',  // Only true if status is active
        subscriptionStatus: status,
        subscriptionEndDate: endDate,
        planName: planName,
      });
    } catch (error) {
      console.error("Error updating premium status:", error);
      res.status(500).json({ message: "Error updating premium status" });
    }
  });
  
  // Route to cancel a subscription
  app.post("/api/cancel-subscription", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user;
      
      // Ensure the user has an active subscription
      if (!user.isPremium || user.subscriptionStatus !== 'active') {
        return res.status(400).json({ message: "No active subscription to cancel" });
      }
      
      // Cancel with Stripe if we have a subscription ID
      if (user.stripeSubscriptionId && user.stripeSubscriptionId.startsWith('sub_')) {
        try {
          // Only proceed if it's actually a subscription ID (starts with sub_)
          await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
          
          // Get the subscription to get the current_period_end
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          const endDate = new Date((subscription as any).current_period_end * 1000);
          
          // Get plan name from the subscription if possible
          let planName = "Premium"; // Will be updated if we can get it from Stripe
          
          try {
            if (subscription.items.data && subscription.items.data.length > 0) {
              const item = subscription.items.data[0];
              if (item.price && item.price.product) {
                const product = await stripe.products.retrieve(item.price.product as string);
                if (product && product.name) {
                  planName = product.name;
                }
              }
            }
          } catch (productError) {
            console.error("Error getting plan name:", productError);
            // Continue with existing plan name
          }
          
          // Mark the subscription as canceled but keep the end date from Stripe
          await storage.updateSubscriptionStatus(
            user.id,
            'canceled',
            endDate,
            planName
          );
        } catch (error) {
          console.error("Error cancelling subscription with Stripe:", error);
          return res.status(500).json({ 
            error: "Failed to cancel subscription", 
            message: "There was an error cancelling your subscription with Stripe. Please try again or contact support."
          });
        }
      } else {
        // No valid subscription ID to cancel
        return res.status(404).json({ 
          error: "No valid subscription found", 
          message: "We couldn't find a valid subscription to cancel. Please contact support if you believe this is an error."
        });
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Error canceling subscription" });
    }
  });
  
  // Route to get payment method update URL
  app.get("/api/payment-method-update", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = req.user;
      
      // Check if user has a Stripe customer ID and subscription ID
      if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
        return res.status(404).json({ 
          error: "No subscription found",
          message: "No active subscription found to update payment method."
        });
      }
      
      try {
        // Create a checkout session for updating the payment method
        const session = await stripe.checkout.sessions.create({
          mode: 'setup',
          payment_method_types: ['card'],
          customer: user.stripeCustomerId,
          setup_intent_data: {
            metadata: {
              subscription_id: user.stripeSubscriptionId,
              user_id: user.id.toString()
            }
          },
          success_url: `${process.env.PUBLIC_URL || 'http://localhost:5000'}/account?payment_updated=true`,
          cancel_url: `${process.env.PUBLIC_URL || 'http://localhost:5000'}/account?payment_updated=false`,
        });
        
        return res.json({ 
          url: session.url,
          success: true
        });
      } catch (stripeError) {
        console.error("Error creating Stripe checkout session:", stripeError);
        return res.status(500).json({ 
          error: "Payment processor error",
          message: "Could not create a payment update session. Please try again later."
        });
      }
    } catch (error) {
      console.error("Error in payment method update route:", error);
      return res.status(500).json({ 
        error: "Server error",
        message: "An unexpected error occurred. Please try again later."
      });
    }
  });
  
  // Route to reactivate a canceled subscription
  app.post("/api/reactivate-subscription", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user;
      
      // Ensure the user has a canceled subscription
      if (!user.isPremium || user.subscriptionStatus !== 'canceled') {
        return res.status(400).json({ message: "No canceled subscription to reactivate" });
      }
      
      // Reactivate with Stripe if we have a valid subscription ID
      if (user.stripeSubscriptionId && user.stripeSubscriptionId.startsWith('sub_')) {
        try {
          // Only proceed if it's actually a subscription ID (starts with sub_)
          await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false,
          });
          
          // Get the subscription to get the current_period_end
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          const endDate = new Date((subscription as any).current_period_end * 1000);
          
          // Get plan name from the subscription if possible
          let planName = "Premium"; // Will be updated if we can get it from Stripe
          
          try {
            if (subscription.items.data && subscription.items.data.length > 0) {
              const item = subscription.items.data[0];
              if (item.price && item.price.product) {
                const product = await stripe.products.retrieve(item.price.product as string);
                if (product && product.name) {
                  planName = product.name;
                }
              }
            }
          } catch (productError) {
            console.error("Error getting plan name:", productError);
            // Continue with existing plan name
          }
          
          // Mark the subscription as active again with the end date from Stripe
          await storage.updateSubscriptionStatus(
            user.id,
            'active',
            endDate,
            planName
          );
          
          return res.json({ 
            message: "Subscription reactivated successfully.",
            subscriptionStatus: 'active',
            subscriptionEndDate: endDate,
            planName: planName
          });
        } catch (error) {
          console.error("Error reactivating subscription with Stripe:", error);
          return res.status(500).json({ 
            error: "Failed to reactivate subscription", 
            message: "There was an error reactivating your subscription with Stripe. Please try again or contact support."
          });
        }
      } else {
        // No valid subscription ID to reactivate
        return res.status(404).json({ 
          error: "No valid subscription found", 
          message: "We couldn't find a valid subscription to reactivate. Please contact support if you believe this is an error."
        });
      }
      
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Error reactivating subscription" });
    }
  });

  // Webhook to handle Stripe events
  app.post("/api/stripe-webhook", async (req: Request, res: Response) => {
    // Webhook signature verification
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Missing Stripe webhook secret");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    // Get the signature from headers
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      console.error("No Stripe signature found in headers");
      return res.status(400).json({ message: "No Stripe signature found" });
    }

    let event;
    
    try {
      // Get raw body data for signature verification
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      
      // Verify the event using the webhook secret and signature
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
      
      console.log(`Webhook received: ${event.type}`);
      
      // For TypeScript safety, use a simpler approach for the webhook handler
      // This avoids complex typings and reduces errors
      try {
        const eventType = event.type;
        const data = event.data.object;
        
        // Handle payment intent succeeded event
        if (eventType === 'payment_intent.succeeded') {
          await handlePaymentIntentSucceeded(data);
        }
        // Handle setup intent for payment method updates
        else if (eventType === 'setup_intent.succeeded') {
          await handleSetupIntentSucceeded(data);
        }
        // Handle subscription events
        else if (eventType === 'customer.subscription.created') {
          await handleSubscriptionCreated(data);
        }
        else if (eventType === 'customer.subscription.updated') {
          await handleSubscriptionUpdated(data);
        }
        else if (eventType === 'customer.subscription.deleted') {
          await handleSubscriptionDeleted(data);
        }
        // Handle invoice events
        else if (eventType === 'invoice.payment_succeeded') {
          await handleInvoicePaymentSucceeded(data);
        }
        else if (eventType === 'invoice.payment_failed') {
          await handleInvoicePaymentFailed(data);
        }
        else {
          console.log(`Unhandled event type: ${eventType}`);
        }
      } catch (handlerError: any) {
        console.error(`Error processing webhook event: ${handlerError.message}`);
        // Still return 200 to acknowledge receipt (Stripe will retry otherwise)
        return res.json({ 
          received: true,
          warning: "Event processed with errors"
        });
      }

      // Return a 200 response to acknowledge receipt of the event
      res.json({ received: true });
      
    } catch (error: any) {
      console.error(`Webhook signature verification error: ${error.message}`);
      res.status(400).json({ message: `Webhook error: ${error.message}` });
    }
  });

  // Helper functions for webhook event handling
  async function handlePaymentIntentSucceeded(paymentIntent: any) {
    console.log("Payment intent succeeded webhook:", paymentIntent.id);
    console.log("Payment intent metadata:", paymentIntent.metadata);
    
    // Check if this is a subscription payment
    if (paymentIntent.metadata && paymentIntent.metadata.isSubscriptionPayment === 'true') {
      console.log("This is a subscription payment");
      const userId = parseInt(paymentIntent.metadata.userId);
      
      if (userId) {
        console.log("Processing payment for user ID:", userId);
        // Find the user
        const user = await storage.getUser(userId);
        
        if (user) {
          console.log("Found user:", user.username);
          // Get price ID from env vars or metadata
          const priceId = paymentIntent.metadata?.priceId || process.env.STRIPE_PRICE_ID;
          
          if (!priceId) {
            console.error("Missing STRIPE_PRICE_ID for subscription creation");
            return;
          }
          
          console.log("Using price ID:", priceId);
          
          // If user doesn't have a subscription ID or has a payment intent ID (not a real subscription)
          if (!user.stripeSubscriptionId || user.stripeSubscriptionId.startsWith('pi_')) {
            try {
              // Create or get customer in Stripe
              let customerId = user.stripeCustomerId;
              
              if (!customerId) {
                // Create a customer for this user in Stripe
                const customer = await stripe.customers.create({
                  email: user.email,
                  name: user.username,
                  metadata: {
                    userId: user.id.toString()
                  }
                });
                
                customerId = customer.id;
                
                // Update user with the new customer ID
                await storage.updateUserStripeInfo(user.id, {
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: user.stripeSubscriptionId || '',
                });
              }
              
              // Get payment method information from the payment intent
              console.log(`Getting payment method from payment intent: ${paymentIntent.id}`);
              const pi = await stripe.paymentIntents.retrieve(paymentIntent.id, {
                expand: ['payment_method']
              });
              
              // Get the payment method from the payment intent
              let paymentMethodId = pi.payment_method as string | { id: string };
              
              if (!paymentMethodId) {
                console.error("No payment method found on payment intent", paymentIntent.id);
                throw new Error("No payment method found on payment intent");
              }
              
              console.log(`Attaching payment method ${typeof paymentMethodId === 'string' ? paymentMethodId : 'OBJECT'} to customer ${customerId}`);
              
              // Make sure paymentMethodId is a string
              if (typeof paymentMethodId !== 'string') {
                console.error("Payment method ID is not a string:", paymentMethodId);
                
                // If it's an object with an id property, extract the id
                if (paymentMethodId && typeof paymentMethodId === 'object' && 'id' in paymentMethodId) {
                  paymentMethodId = paymentMethodId.id;
                  console.log("Extracted payment method ID:", paymentMethodId);
                } else {
                  throw new Error("Invalid payment method ID format");
                }
              }
              
              // Attach the payment method to the customer
              await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
              });
              
              // Set as default payment method
              await stripe.customers.update(customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
              });
              
              // Create a real subscription in Stripe
              console.log(`Creating Stripe subscription for user ${userId} with price ID: ${priceId}`);
              const subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: priceId }],
                default_payment_method: paymentMethodId,
                metadata: {
                  paymentIntentId: paymentIntent.id,
                  userId: user.id.toString()
                }
              });
              
              console.log(`Created Stripe subscription: ${subscription.id}`);
              
              // Calculate subscription end date from the subscription
              const endDate = new Date((subscription as any).current_period_end * 1000);
              
              // Update user subscription status with proper end date
              await storage.updateSubscriptionStatus(userId, 'active', endDate);
              
              // Save the real subscription ID
              await storage.updateUserStripeInfo(userId, {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id, // This is now a real sub_XXX ID
              });
              
              console.log(`Successfully created subscription for user ${userId}`);
              
            } catch (error) {
              // Log error but don't use fallbacks
              console.error("Error creating subscription in Stripe:", error);
              console.log("Failed to create a subscription. Will not update user subscription status.");
            }
          } else if (user.stripeSubscriptionId.startsWith('sub_')) {
            // User already has a real subscription, just update status
            console.log(`User ${userId} already has a subscription: ${user.stripeSubscriptionId}`);
            
            // Ensure the subscription is active
            try {
              const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
              const endDate = new Date((subscription as any).current_period_end * 1000);
              await storage.updateSubscriptionStatus(userId, 'active', endDate);
            } catch (error) {
              console.error("Error retrieving existing subscription:", error);
            }
          }
        }
      }
    }
  }
  
  async function handleSubscriptionCreated(subscription: any) {
    const customerId = subscription.customer;
    
    // Find user with this customer ID using storage
    try {
      // Find users with matching stripe customer ID using drizzle-orm
      const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
      
      const user = userResults[0];
      
      if (user && typeof user.id === 'number') {
        // Calculate subscription end date from current_period_end (comes in seconds)
        const endDate = new Date(subscription.current_period_end * 1000);
        
        // Get the plan name from the first subscription item
        let planName = "Premium Monthly"; // Default fallback
        
        try {
          if (subscription.items.data && subscription.items.data.length > 0) {
            // Get the first item's price
            const firstItem = subscription.items.data[0];
            if (firstItem.price && firstItem.price.product) {
              // Get the product details to get the product name
              const product = await stripe.products.retrieve(firstItem.price.product as string);
              if (product && product.name) {
                planName = product.name;
                console.log(`Found plan name from Stripe for new subscription: ${planName}`);
              }
            }
          }
        } catch (productError) {
          console.error("Error fetching plan name for new subscription:", productError);
          // Continue with default plan name
        }
        
        // Use the actual status from Stripe
        const status = subscription.status;
        console.log(`New subscription status from Stripe: ${status}`);
        
        // Update subscription status with plan name and actual status
        await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
        
        // Save subscription details
        await storage.updateUserStripeInfo(user.id, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
        });
        
        console.log(`Successfully created subscription for user ${user.id} with status: ${status}, plan: ${planName}`);
      }
    } catch (error: any) {
      console.error(`Error handling subscription created: ${error.message}`);
    }
  }
  
  async function handleSubscriptionUpdated(subscription: any) {
    const customerId = subscription.customer;
    
    try {
      // Find users with matching stripe customer ID using drizzle-orm
      const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
      
      const user = userResults[0];
      
      if (user && typeof user.id === 'number') {
        // Calculate subscription end date from current_period_end (comes in seconds)
        const endDate = new Date(subscription.current_period_end * 1000);
        
        // Use the exact subscription status from Stripe
        let status = subscription.status;
        console.log(`Raw Stripe subscription status: ${status}`);
        
        // Handle cancel_at_period_end flag (subscription is technically still active but will be canceled)
        if (subscription.cancel_at_period_end && status === 'active') {
          status = 'canceled';
        }
        
        // Log status information for debugging
        console.log(`Using subscription status: ${status}`);
        console.log(`Subscription details: 
          - Status: ${subscription.status}
          - Cancel at period end: ${subscription.cancel_at_period_end}
          - Current period end: ${new Date(subscription.current_period_end * 1000)}
          - Collection method: ${subscription.collection_method}
        `);
        
        // Get the plan name from the first subscription item
        let planName = "Premium Monthly"; // Default fallback
        
        try {
          if (subscription.items.data && subscription.items.data.length > 0) {
            // Get the first item's price
            const firstItem = subscription.items.data[0];
            if (firstItem.price && firstItem.price.product) {
              // Get the product details to get the product name
              const product = await stripe.products.retrieve(firstItem.price.product as string);
              if (product && product.name) {
                planName = product.name;
                console.log(`Found plan name from Stripe for updated subscription: ${planName}`);
              }
            }
          }
        } catch (productError) {
          console.error("Error fetching plan name for updated subscription:", productError);
          // Continue with default plan name
        }
        
        // Check if plan name has changed
        if (user.planName !== planName) {
          console.log(`Plan changed from ${user.planName} to ${planName}`);
        }
        
        // Update subscription status with plan name
        await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
        
        console.log(`Successfully updated subscription for user ${user.id} to status: ${status}, plan: ${planName}`);
      }
    } catch (error: any) {
      console.error(`Error handling subscription updated: ${error.message}`);
    }
  }
  
  async function handleSubscriptionDeleted(subscription: any) {
    const customerId = subscription.customer;
    
    try {
      // Find users with matching stripe customer ID using drizzle-orm
      const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
      
      const user = userResults[0];
      
      if (user && typeof user.id === 'number') {
        // Set end date to now
        const endDate = new Date();
        
        // Update subscription status to inactive
        await storage.updateSubscriptionStatus(user.id, 'inactive', endDate);
        
        console.log(`Subscription canceled for user ${user.id}`);
      }
    } catch (error: any) {
      console.error(`Error handling subscription deleted: ${error.message}`);
    }
  }
  
  async function handleInvoicePaymentSucceeded(invoice: any) {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    
    if (!subscriptionId) {
      return; // Not a subscription invoice
    }
    
    try {
      // Find users with matching stripe customer ID using drizzle-orm
      const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
      
      const user = userResults[0];
      
      if (user && typeof user.id === 'number') {
        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Calculate subscription end date
        const endDate = new Date((subscription as any).current_period_end * 1000);
        
        // Get the plan name from the first subscription item
        let planName = "Premium Monthly"; // Default fallback
        
        try {
          if (subscription.items.data && subscription.items.data.length > 0) {
            // Get the first item's price
            const firstItem = subscription.items.data[0];
            if (firstItem.price && firstItem.price.product) {
              // Get the product details to get the product name
              const product = await stripe.products.retrieve(firstItem.price.product as string);
              if (product && product.name) {
                planName = product.name;
                console.log(`Found plan name from Stripe for invoice payment: ${planName}`);
              }
            }
          }
        } catch (productError) {
          console.error("Error fetching plan name for invoice payment:", productError);
          // Continue with default plan name
        }
        
        // Use the actual status from Stripe
        const status = subscription.status;
        console.log(`Subscription status after payment: ${status}`);
        
        // Update subscription status with plan name
        await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
        
        console.log(`Successfully processed invoice payment for user ${user.id}, status: ${status}, plan: ${planName}`);
      }
    } catch (error: any) {
      console.error(`Error handling invoice payment succeeded: ${error.message}`);
    }
  }
  
  // Handle successful setup intent (payment method update)
  async function handleSetupIntentSucceeded(setupIntent: any) {
    console.log("Setup intent succeeded webhook:", setupIntent.id);
    console.log("Setup intent metadata:", setupIntent.metadata);
    
    if (!setupIntent.metadata || !setupIntent.metadata.subscription_id) {
      console.log("No subscription ID in setup intent metadata");
      return;
    }
    
    const subscriptionId = setupIntent.metadata.subscription_id;
    const userId = setupIntent.metadata.user_id ? parseInt(setupIntent.metadata.user_id) : null;
    
    if (!userId) {
      console.log("No user ID found in setup intent metadata");
      return;
    }
    
    try {
      // Get user
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.log(`User not found with ID ${userId}`);
        return;
      }
      
      // Get payment method from setup intent
      const paymentMethodId = setupIntent.payment_method as string;
      
      if (!paymentMethodId) {
        console.log("No payment method found on setup intent");
        return;
      }
      
      console.log(`Updating subscription ${subscriptionId} with payment method ${paymentMethodId}`);
      
      // Get the subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (subscription.status === 'incomplete' || subscription.status === 'past_due') {
        // For incomplete or past_due subscriptions, try to process the payment
        try {
          if (!user.stripeCustomerId) {
            console.log("User has no Stripe customer ID");
            return;
          }
          
          // First, set the payment method as default for the customer
          await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId
            }
          });
          
          // Find the latest unpaid invoice for this subscription
          const invoices = await stripe.invoices.list({
            subscription: subscriptionId,
            status: 'open',
            limit: 1,
          });
          
          if (invoices.data.length > 0) {
            const invoice = invoices.data[0];
            const invoiceId = invoice.id;
            
            if (invoiceId) {
              console.log(`Attempting to pay invoice ${invoiceId} for subscription ${subscriptionId}`);
              await stripe.invoices.pay(invoiceId, {
                payment_method: paymentMethodId
              });
              console.log(`Successfully paid invoice ${invoiceId}`);
            }
          } else {
            console.log("No unpaid invoice found for this subscription");
          }
          
          // Update the subscription to set the default payment method
          await stripe.subscriptions.update(subscriptionId, {
            default_payment_method: paymentMethodId
          });
          
          // Refresh the subscription to get the latest status
          const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          // Update the user's subscription status in our database
          const endDate = new Date((updatedSubscription as any).current_period_end * 1000);
          await storage.updateSubscriptionStatus(userId, updatedSubscription.status, endDate);
          
          console.log(`Updated subscription status to ${updatedSubscription.status}`);
        } catch (payError) {
          console.error("Error processing payment after payment method update:", payError);
        }
      } else {
        // For active subscriptions, just update the payment method
        await stripe.subscriptions.update(subscriptionId, {
          default_payment_method: paymentMethodId
        });
      }
    } catch (error) {
      console.error("Error handling setup intent succeeded:", error);
    }
  }
  
  async function handleInvoicePaymentFailed(invoice: any) {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    
    if (!subscriptionId) {
      return; // Not a subscription invoice
    }
    
    try {
      // Find users with matching stripe customer ID using drizzle-orm
      const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
      
      const user = userResults[0];
      
      if (user && typeof user.id === 'number') {
        try {
          // Get the subscription from Stripe to get accurate end date
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const endDate = new Date((subscription as any).current_period_end * 1000);
          
          // Get the plan name from the subscription if possible
          let planName = "Premium Monthly"; // Will be updated if we can get it from Stripe
          
          try {
            if (subscription.items.data && subscription.items.data.length > 0) {
              const item = subscription.items.data[0];
              if (item.price && item.price.product) {
                const product = await stripe.products.retrieve(item.price.product as string);
                if (product && product.name) {
                  planName = product.name;
                }
              }
            }
          } catch (productError) {
            console.error("Error getting plan name:", productError);
            // Continue with existing plan name or default
          }
          
          // Use the actual status from Stripe
          const status = subscription.status;
          console.log(`Subscription status after payment failure: ${status}`);
          
          // Update subscription status with Stripe status (typically 'past_due' or 'unpaid')
          await storage.updateSubscriptionStatus(user.id, status, endDate, planName);
          
          console.log(`Invoice payment failed for user ${user.id}, status: ${status}, subscription will end at: ${endDate.toISOString()}`);
        } catch (subError) {
          console.error("Error retrieving subscription for failed payment:", subError);
          // Don't update if we can't get accurate data from Stripe
        }
      }
    } catch (error: any) {
      console.error(`Error handling invoice payment failed: ${error.message}`);
    }
  }

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
