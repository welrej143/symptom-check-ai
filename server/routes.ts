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

  // Create payment intent for subscription
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

      // Create a payment intent for the subscription
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 999, // $9.99
        currency: 'usd',
        customer: customerId,
        metadata: {
          userId: user.id.toString(),
          isSubscription: 'true',
        },
        description: 'SymptomCheck AI Premium Subscription',
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
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
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }
      
      // Verify the payment was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment has not been completed successfully" });
      }
      
      // Calculate subscription end date (1 month from now)
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      
      // Update user subscription status
      await storage.updateSubscriptionStatus(user.id, 'active', endDate);
      
      // Also save the subscription ID if needed
      if (paymentIntent.id && !user.stripeSubscriptionId) {
        await storage.updateUserStripeInfo(user.id, { 
          stripeCustomerId: user.stripeCustomerId || '',
          stripeSubscriptionId: paymentIntent.id,
        });
      }
      
      res.json({ 
        message: "Premium status updated successfully",
        isPremium: true,
        subscriptionStatus: 'active',
        subscriptionEndDate: endDate,
      });
    } catch (error) {
      console.error("Error updating premium status:", error);
      res.status(500).json({ message: "Error updating premium status" });
    }
  });

  // Webhook to handle Stripe events
  app.post("/api/stripe-webhook", async (req: Request, res: Response) => {
    try {
      const event = req.body;
      
      // Handle the payment_intent.succeeded event for subscription handling
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        
        // Check if this is a subscription payment
        if (paymentIntent.metadata && paymentIntent.metadata.isSubscription === 'true') {
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
              
              // Also save the payment intent ID as subscription ID if needed
              if (!user.stripeSubscriptionId) {
                await storage.updateUserStripeInfo(userId, {
                  stripeCustomerId: user.stripeCustomerId || '',
                  stripeSubscriptionId: paymentIntent.id,
                });
              }
            }
          }
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Error processing webhook" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
