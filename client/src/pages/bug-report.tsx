import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BugIcon, CheckCircle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const bugReportSchema = z.object({
  description: z.string().min(10, {
    message: "Bug description must be at least 10 characters long",
  }),
  screenshot: z.any().optional(),
});

type BugReportFormValues = z.infer<typeof bugReportSchema>;

export default function BugReportPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<BugReportFormValues>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      description: "",
    },
  });

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview image
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue("screenshot", file);
    } else {
      setPreviewUrl(null);
    }
  };

  const onSubmit = async (data: BugReportFormValues) => {
    setIsSubmitting(true);
    try {
      // For now, we'll just send the description as JSON
      // We'll implement file upload later
      const response = await apiRequest("POST", "/api/bug-report", {
        description: data.description
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to submit bug report");
      }
      
      setIsSuccess(true);
      toast({
        title: "Bug report submitted",
        description: "Thank you for your feedback. Our team will review it soon.",
        variant: "default",
      });
      
      // Reset form after successful submission
      form.reset();
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast({
        title: "Error",
        description: "Failed to submit bug report. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-3xl py-10 mx-auto min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <BugIcon className="h-8 w-8 text-red-500" />
        Report a Bug
      </h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Bug Report Form</CardTitle>
          <CardDescription>
            Help us improve SymptomCheck AI by reporting any issues you encounter. 
            Please provide a detailed description and, if possible, attach a screenshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-medium mb-2">Thank You!</h3>
              <p className="text-gray-600 mb-6">
                Your bug report has been submitted successfully. Our team will review it as soon as possible.
              </p>
              <Button onClick={() => setIsSuccess(false)}>Submit Another Report</Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Describe the bug</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Please provide a detailed description of the issue you encountered. Include steps to reproduce if possible."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Be as specific as possible about what happened and what you expected to happen.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormItem>
                  <FormLabel>Screenshot (optional)</FormLabel>
                  <FormControl>
                    <div className="mt-1 flex flex-col items-center space-y-4">
                      <label className="w-full flex flex-col items-center px-4 py-6 bg-white text-blue-500 rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-50 cursor-pointer">
                        <Upload className="h-8 w-8" />
                        <span className="mt-2 text-base font-medium">Drop screenshot here or click to upload</span>
                        <Input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleScreenshotChange}
                        />
                      </label>
                      
                      {previewUrl && (
                        <div className="relative w-full">
                          <img 
                            src={previewUrl} 
                            alt="Screenshot preview" 
                            className="rounded-md max-h-64 mx-auto border border-gray-200"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setPreviewUrl(null);
                              form.setValue("screenshot", undefined);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </FormControl>
                </FormItem>
                
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Bug Report"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4">
          <p className="text-xs text-gray-500">
            Your feedback helps us improve SymptomCheck AI. Thank you for your help!
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}