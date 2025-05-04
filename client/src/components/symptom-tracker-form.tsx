import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { dailyTrackingFormSchema, DailyTrackingForm } from "@shared/schema";

interface SymptomTrackerFormProps {
  onSubmit: (data: DailyTrackingForm) => void;
  isSubmitting: boolean;
}

export default function SymptomTrackerForm({ onSubmit, isSubmitting }: SymptomTrackerFormProps) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    "Headache", "Nausea"
  ]);
  
  const commonSymptoms = [
    "Headache", "Nausea", "Dizziness", "Fatigue", "Light sensitivity",
    "Fever", "Cough", "Sore throat", "Muscle pain", "Joint pain",
    "Chest pain", "Shortness of breath", "Stomach pain", "Diarrhea"
  ];
  
  const [newSymptom, setNewSymptom] = useState("");
  const [showSymptomInput, setShowSymptomInput] = useState(false);
  
  const form = useForm<DailyTrackingForm>({
    resolver: zodResolver(dailyTrackingFormSchema),
    defaultValues: {
      symptomSeverity: 5,
      symptoms: selectedSymptoms,
      energyLevel: 3,
      mood: 3,
      sleepQuality: 3,
      notes: "",
    },
  });
  
  // Toggle symptom selection
  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => {
      const isSelected = prev.includes(symptom);
      const newSelected = isSelected
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom];
      
      // Update form value
      form.setValue("symptoms", newSelected);
      
      return newSelected;
    });
  };
  
  // Add custom symptom
  const addCustomSymptom = () => {
    if (newSymptom.trim() && !selectedSymptoms.includes(newSymptom.trim())) {
      const symptomToAdd = newSymptom.trim();
      setSelectedSymptoms(prev => [...prev, symptomToAdd]);
      form.setValue("symptoms", [...selectedSymptoms, symptomToAdd]);
      setNewSymptom("");
      setShowSymptomInput(false);
    }
  };
  
  const handleSubmit = (values: DailyTrackingForm) => {
    onSubmit(values);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="symptomSeverity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
                How severe are your symptoms today?
              </FormLabel>
              <FormControl>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Mild</span>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    defaultValue={[field.value]}
                    onValueChange={(vals) => field.onChange(vals[0])}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">Severe</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="symptoms"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block text-sm font-medium text-gray-700 mb-2">
                Which symptoms are you experiencing today?
              </FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {commonSymptoms.map((symptom) => (
                    <Badge
                      key={symptom}
                      variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                      className={`px-3 py-1.5 cursor-pointer ${
                        selectedSymptoms.includes(symptom)
                          ? "bg-primary-100 text-primary-800 hover:bg-primary-200"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                      }`}
                      onClick={() => toggleSymptom(symptom)}
                    >
                      {symptom}
                    </Badge>
                  ))}
                  
                  {showSymptomInput ? (
                    <div className="flex items-center mt-2 w-full">
                      <input
                        type="text"
                        value={newSymptom}
                        onChange={(e) => setNewSymptom(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomSymptom();
                          }
                        }}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Enter symptom name"
                      />
                      <Button
                        type="button"
                        onClick={addCustomSymptom}
                        className="ml-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowSymptomInput(false)}
                        className="ml-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 cursor-pointer"
                      onClick={() => setShowSymptomInput(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add symptom
                    </Badge>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="energyLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
                  Energy Level
                </FormLabel>
                <FormControl>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    defaultValue={[field.value]}
                    onValueChange={(vals) => field.onChange(vals[0])}
                  />
                </FormControl>
                <FormDescription className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Low</span>
                  <span>High</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
                  Mood
                </FormLabel>
                <FormControl>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    defaultValue={[field.value]}
                    onValueChange={(vals) => field.onChange(vals[0])}
                  />
                </FormControl>
                <FormDescription className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Bad</span>
                  <span>Good</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="sleepQuality"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
                  Sleep Quality
                </FormLabel>
                <FormControl>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    defaultValue={[field.value]}
                    onValueChange={(vals) => field.onChange(vals[0])}
                  />
                </FormControl>
                <FormDescription className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Poor</span>
                  <span>Great</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional details about your symptoms today..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="pt-4 mt-4 border-t border-gray-200">
          <Button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 transition-colors text-base"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Today's Check-in"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
