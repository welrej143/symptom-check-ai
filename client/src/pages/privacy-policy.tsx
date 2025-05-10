import { useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export default function PrivacyPolicy() {
  // Set document title when component mounts
  useEffect(() => {
    document.title = "Privacy Policy | SymptomCheck AI";
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
          <h1>Privacy Policy for SymptomCheck AI</h1>
          
          <p>Last Updated: {new Date().toLocaleDateString()}</p>
          
          <h2>1. Information We Collect</h2>
          
          <p>
            SymptomCheck AI collects information you provide directly to us, including:
          </p>
          
          <ul>
            <li>Account information (email address, username, password)</li>
            <li>Health information (symptoms, medical history, lifestyle factors)</li>
            <li>Payment information when you subscribe to premium services</li>
            <li>Communication data when you contact our support team</li>
          </ul>
          
          <h2>2. How We Use Your Information</h2>
          
          <ul>
            <li>To provide and improve our services</li>
            <li>To process your subscription and payments</li>
            <li>To personalize your experience</li>
            <li>To communicate with you about your account or our services</li>
            <li>To analyze usage patterns and improve our application</li>
          </ul>
          
          <h2>3. Data Security</h2>
          
          <p>
            We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or method of electronic storage is 100% secure.
          </p>
          
          <h2>4. Data Sharing</h2>
          
          <p>
            We do not sell your personal information. We may share information with:
          </p>
          
          <ul>
            <li>Service providers that help us deliver our services</li>
            <li>Payment processors for subscription handling</li>
            <li>Legal authorities when required by law</li>
          </ul>
          
          <h2>5. Your Rights</h2>
          
          <p>
            Depending on your location, you may have rights to:
          </p>
          
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Delete your information</li>
            <li>Object to certain processing</li>
            <li>Export your data</li>
          </ul>
          
          <h2>6. Cookie Policy</h2>
          
          <p>
            We use cookies and similar technologies to enhance your browsing experience, serve personalized content, and analyze our traffic. You can control cookies through your browser settings.
          </p>
          
          <h2>7. Children's Privacy</h2>
          
          <p>
            Our services are not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </p>
          
          <h2>8. Changes to This Privacy Policy</h2>
          
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
          </p>
          
          <h2>9. Contact Us</h2>
          
          <p>
            If you have questions about this Privacy Policy, please contact us at:
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