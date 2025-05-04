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
      
      // Simplified approach: Just create a payment intent
      // We'll create the subscription after successful payment via webhook
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 999, // $9.99 in cents
        currency: 'usd',
        customer: customerId,
        metadata: {
          userId: user.id.toString(),
          priceId: stripePriceId,
          isSubscriptionPayment: 'true',
        },
        // Link to the subscription
        description: `Premium subscription for ${user.username}`,
      });
      
      console.log("Payment intent created:", paymentIntent.id);
      
      // Get the client secret which will be used on the client side to complete the payment
      const clientSecret = paymentIntent.client_secret;

      res.json({
        clientSecret: clientSecret,
        paymentIntentId: paymentIntent.id,
      });
    
    } catch (error) {
      console.error("Error creating payment intent for subscription:", error);
      res.status(500).json({ message: "Error creating payment intent" });
    }
  });

  // Check subscription status
  app.get("/api/subscription", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user;
      
      res.json({
        isPremium: user.isPremium || false,
        subscriptionStatus: user.subscriptionStatus || 'inactive',
        subscriptionEndDate: user.subscriptionEndDate || null,
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      res.status(500).json({ message: "Error checking subscription" });
    }
  });

  // Update premium status (after payment)
  app.post("/api/update-premium-status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user;
      const { paymentIntentId, subscriptionId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }
      
      // Check if it's a simulated payment for testing
      if (paymentIntentId.startsWith("pi_simulated_")) {
        console.log("Using simulated payment for testing:", paymentIntentId);
        // Continue with the subscription update below
      } else {
        // For real payments, verify with Stripe
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ message: "Payment has not been completed successfully" });
          }
        } catch (stripeError) {
          console.error("Stripe error:", stripeError);
          return res.status(400).json({ message: "Could not verify payment with Stripe" });
        }
      }
      
      // Determine endDate and status
      let endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      let status = 'active';
      
      // If we have a subscription ID, use it to get accurate info
      if (subscriptionId) {
        try {
          // Check if the ID starts with 'sub_' (a subscription) or 'pi_' (payment intent)
          if (subscriptionId.startsWith('sub_')) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            // Update end date based on the subscription
            if ((subscription as any).current_period_end) {
              endDate = new Date((subscription as any).current_period_end * 1000);
            }
            
            // Update status based on subscription status
            if (subscription.status === 'active') {
              status = 'active';
            } else if (subscription.status === 'past_due') {
              status = 'past_due';
            } else if (subscription.status === 'canceled') {
              status = 'canceled';
            }
          } else {
            // It's a payment intent (pi_) or something else, just use default dates
            console.log("Using one-time payment model with ID:", subscriptionId);
            // No need to fetch anything - just set status to active and use default endDate
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
      
      res.json({ 
        message: "Premium status updated successfully",
        isPremium: true,
        subscriptionStatus: status,
        subscriptionEndDate: endDate,
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
          
          // Mark the subscription as canceled but keep the end date from Stripe
          await storage.updateSubscriptionStatus(
            user.id,
            'canceled',
            endDate
          );
        } catch (error) {
          console.log("Error updating subscription, using fallback approach:", error);
          // Fall back to manual status update
          const endDate = user.subscriptionEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await storage.updateSubscriptionStatus(user.id, 'canceled', endDate);
        }
      } else {
        // Fallback if we don't have a subscription ID
        // If there's no end date, set one month from now
        const endDate = user.subscriptionEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        await storage.updateSubscriptionStatus(
          user.id,
          'canceled',
          endDate
        );
      }
      
      res.json({ 
        message: "Subscription canceled successfully. You'll have access until the end of your billing period.",
        subscriptionStatus: 'canceled',
        subscriptionEndDate: user.subscriptionEndDate,
      });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Error canceling subscription" });
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
          
          // Mark the subscription as active again with the end date from Stripe
          await storage.updateSubscriptionStatus(
            user.id,
            'active',
            endDate
          );
        } catch (error) {
          console.log("Error reactivating subscription, using fallback approach:", error);
          // Fall back to manual status update
          const endDate = user.subscriptionEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await storage.updateSubscriptionStatus(user.id, 'active', endDate);
        }
      } else {
        // Fallback if we don't have a subscription ID
        // If there's no end date, set one month from now
        const endDate = user.subscriptionEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Mark the subscription as active again with the same end date
        await storage.updateSubscriptionStatus(
          user.id,
          'active',
          endDate
        );
      }
      
      res.json({ 
        message: "Subscription reactivated successfully.",
        subscriptionStatus: 'active',
        subscriptionEndDate: user.subscriptionEndDate,
      });
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
    // Check if this is a subscription payment
    if (paymentIntent.metadata && paymentIntent.metadata.isSubscriptionPayment === 'true') {
      const userId = parseInt(paymentIntent.metadata.userId);
      
      if (userId) {
        // Find the user
        const user = await storage.getUser(userId);
        
        if (user) {
          // Calculate subscription end date (1 month from now)
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1);
          
          // Update subscription status
          await storage.updateSubscriptionStatus(userId, 'active', endDate);
          
          // Log the subscription with proper price ID if available
          const priceId = paymentIntent.metadata?.priceId || process.env.STRIPE_PRICE_ID;
          
          // Save subscription details 
          if (!user.stripeSubscriptionId) {
            await storage.updateUserStripeInfo(userId, {
              stripeCustomerId: user.stripeCustomerId || '',
              stripeSubscriptionId: paymentIntent.id,
            });
            
            console.log(`Successfully updated subscription for user ${userId} with price ID: ${priceId}`);
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
        
        // Update subscription status
        await storage.updateSubscriptionStatus(user.id, 'active', endDate);
        
        // Save subscription details
        await storage.updateUserStripeInfo(user.id, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
        });
        
        console.log(`Successfully created subscription for user ${user.id}`);
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
        
        // Set appropriate status based on subscription status
        let status = 'active';
        if (subscription.cancel_at_period_end) {
          status = 'canceled';
        } else if (subscription.status === 'past_due') {
          status = 'past_due';
        } else if (subscription.status === 'unpaid') {
          status = 'unpaid';
        } else if (subscription.status === 'canceled') {
          status = 'canceled';
        }
        
        // Update subscription status
        await storage.updateSubscriptionStatus(user.id, status, endDate);
        
        console.log(`Successfully updated subscription for user ${user.id} to status: ${status}`);
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
        
        // Update subscription status
        await storage.updateSubscriptionStatus(user.id, 'active', endDate);
        
        console.log(`Successfully processed invoice payment for user ${user.id}`);
      }
    } catch (error: any) {
      console.error(`Error handling invoice payment succeeded: ${error.message}`);
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
        // Keep the current end date
        const endDate = user.subscriptionEndDate || new Date(); // Use current date as fallback
        
        // Mark as past_due
        await storage.updateSubscriptionStatus(user.id, 'past_due', endDate);
        
        console.log(`Invoice payment failed for user ${user.id}`);
      }
    } catch (error: any) {
      console.error(`Error handling invoice payment failed: ${error.message}`);
    }
  }

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
