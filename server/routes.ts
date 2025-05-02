import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import z from "zod";
import { symptomInputSchema, analysisResponseSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup OpenAI
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "sk-dummy",
  });

  // Analyze symptoms route
  app.post("/api/analyze-symptoms", async (req: Request, res: Response) => {
    try {
      const validation = symptomInputSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: validation.error.format() 
        });
      }
      
      const { symptoms } = validation.data;
      
      // Store the symptom record
      await storage.createSymptomRecord({
        userId: null, // Not requiring login for the basic version
        symptoms,
        date: new Date(),
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
        3. Set urgencyLevel to either "low" (monitor at home), "moderate" (see doctor soon), or "high" (emergency)
        4. Provide 3-5 actionable recommendations
        5. For each condition, include 1-3 relevant medications that are commonly prescribed
        6. For each condition, include 1-3 relevant supplements that may help with symptoms
        7. For the icon field, use only icon names from Lucide React (like "stethoscope", "thermometer", "clipboard", etc.)
        8. ALWAYS include disclaimer text about consulting healthcare professionals
        9. If symptoms suggest a potentially life-threatening condition, mark the recommendation with isEmergency: true
        
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
        userId: null, // Not requiring login for now
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
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const data = await storage.getDailyTrackingData(days);
      res.json(data);
    } catch (error) {
      console.error("Error fetching tracking data:", error);
      res.status(500).json({ message: "Error fetching tracking data" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
