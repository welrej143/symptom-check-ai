import { useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export default function TermsOfService() {
  // Set document title when component mounts
  useEffect(() => {
    document.title = "Terms of Service | SymptomCheck AI";
    return () => {
      document.title = "SymptomCheck AI - Health Analysis & Symptom Tracking";
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8 flex items-center">
        <Link href="/" className="flex items-center text-primary-600 hover:text-primary-700 font-medium">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Home
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8">
        <div className="prose prose-lg max-w-none">
          <h1>Terms of Service for SymptomCheck AI</h1>
          
          <p>Last Updated: {new Date().toLocaleDateString()}</p>
          
          <h2>1. Acceptance of Terms</h2>
          
          <p>
            By accessing or using SymptomCheck AI, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use our service.
          </p>
          
          <h2>2. Description of Service</h2>
          
          <p>
            SymptomCheck AI provides an AI-powered platform for analyzing health symptoms and tracking health metrics. The service includes both free and premium subscription options.
          </p>
          
          <h2>3. User Accounts</h2>
          
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
          </p>
          
          <h2>4. Subscription and Billing</h2>
          
          <p>
            Premium features require a paid subscription. Subscription fees are billed in advance on a monthly or annual basis. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
          </p>
          
          <h2>5. Medical Disclaimer</h2>
          
          <p>
            SymptomCheck AI is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
          </p>
          
          <h2>6. Limitation of Liability</h2>
          
          <p>
            To the maximum extent permitted by law, SymptomCheck AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.
          </p>
          
          <h2>7. Intellectual Property</h2>
          
          <p>
            All content, features, and functionality of SymptomCheck AI, including but not limited to text, graphics, logos, icons, and software, are the exclusive property of SymptomCheck AI or its licensors and are protected by copyright, trademark, and other intellectual property laws.
          </p>
          
          <h2>8. User Content</h2>
          
          <p>
            By submitting content to our service, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content in connection with providing and improving our services.
          </p>
          
          <h2>9. Termination</h2>
          
          <p>
            We may terminate or suspend your account and access to our services at our sole discretion, without prior notice or liability, for any reason, including breach of these Terms.
          </p>
          
          <h2>10. Changes to Terms</h2>
          
          <p>
            We may modify these Terms of Service at any time. The updated terms will be posted on this page with a revised "Last Updated" date. Your continued use of the service after any changes constitutes your acceptance of the new terms.
          </p>
          
          <h2>11. Contact Information</h2>
          
          <p>
            If you have questions about these Terms, please contact us at:
          </p>
          
          <p>
            <strong>Email:</strong> support@symptomcheckapp.com<br />
            <strong>Phone:</strong> +63 967 836 1036
          </p>
        </div>
      </div>
    </div>
  );
}