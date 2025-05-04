import { AnalysisResponse } from "@shared/schema";
import { apiRequest } from "./queryClient";

export async function analyzeSymptoms(symptoms: string): Promise<AnalysisResponse> {
  try {
    const response = await apiRequest("POST", "/api/analyze-symptoms", { 
      symptoms 
    });
    
    if (!response.ok) {
      // Get the error details
      const errorData = await response.json();
      
      // Create a custom error with status and response data
      const error: any = new Error(errorData.message || "Failed to analyze symptoms");
      error.response = {
        status: response.status,
        data: errorData
      };
      throw error;
    }
    
    return await response.json();
  } catch (error) {
    // If it's already our custom error, just rethrow it
    if ((error as any).response) {
      throw error;
    }
    
    // Otherwise, wrap in our standard format
    console.error("Error analyzing symptoms:", error);
    const customError: any = new Error("Failed to analyze symptoms");
    customError.response = {
      status: 500,
      data: { message: "An unexpected error occurred" }
    };
    throw customError;
  }
}
