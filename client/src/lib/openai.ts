import { AnalysisResponse } from "@shared/schema";
import { apiRequest } from "./queryClient";

export async function analyzeSymptoms(symptoms: string): Promise<AnalysisResponse> {
  const response = await apiRequest("POST", "/api/analyze-symptoms", { 
    symptoms 
  });
  return await response.json();
}
