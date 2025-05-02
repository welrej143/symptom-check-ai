import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";

const formSchema = z.object({
  symptoms: z.string().min(3, "Please describe your symptoms in more detail"),
});

interface SymptomFormProps {
  onSubmit: (symptoms: string) => void;
}

export default function SymptomForm({ onSubmit }: SymptomFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symptoms: "",
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // Don't clear the form after submission
    const symptomText = values.symptoms;
    onSubmit(symptomText);
    
    // This prevents the form from resetting to default values after submission
    setTimeout(() => {
      form.setValue("symptoms", symptomText);
    }, 0);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="mb-4">
          <FormField
            control={form.control}
            name="symptoms"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium text-gray-700 mb-2">
                  Describe your symptoms
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g., headache, nausea, dizziness for the past 2 days"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex items-center text-sm text-gray-500 mb-4 mt-4">
            <AlertCircle className="h-5 w-5 mr-2 text-blue-500" />
            <span>Your data is private and secure. Not stored without your consent.</span>
          </div>
          
          <Button
            type="submit"
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Analyze Symptoms
          </Button>
        </form>
      </Form>
    </div>
  );
}
