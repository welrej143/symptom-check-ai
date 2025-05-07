import { Mail, Phone, AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import appIcon from "../assets/app-icon.png";

// Modal component for Terms, Privacy Policy, etc.
function LegalModal({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-xl text-gray-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  const [modalContent, setModalContent] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    isOpen: false,
    title: "",
    content: null
  });
  
  const openModal = (title: string, content: React.ReactNode) => {
    setModalContent({
      isOpen: true,
      title,
      content
    });
  };
  
  const closeModal = () => {
    setModalContent(prev => ({
      ...prev,
      isOpen: false
    }));
  };

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center">
              <img src={appIcon} alt="SymptomCheck AI" className="h-10 w-auto" />
              <h2 className="ml-2 text-xl font-bold text-gray-900">SymptomCheck AI</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600">Personalized health insights powered by artificial intelligence.</p>
            
            <div className="mt-4 space-y-2">
              <a 
                href="mailto:support@symptomcheckapp.com" 
                className="flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                <Mail className="h-4 w-4 mr-2" />
                support@symptomcheckapp.com
              </a>
              <a 
                href="tel:+639678361036" 
                className="flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                <Phone className="h-4 w-4 mr-2" />
                +63 967 836 1036
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => openModal("Medical Disclaimer", (
                    <div className="prose prose-sm max-w-none">
                      <h2>Medical Disclaimer for SymptomCheck AI</h2>
                      
                      <p>Last Updated: {new Date().toLocaleDateString()}</p>
                      
                      <p>
                        <strong>Not a Substitute for Professional Medical Advice</strong>
                      </p>
                      
                      <p>
                        SymptomCheck AI is an artificial intelligence tool designed to provide information about potential medical conditions based on symptoms you input. The information provided by this application is for informational and educational purposes only and is not intended to be a substitute for professional medical advice, diagnosis, or treatment.
                      </p>
                      
                      <p>
                        Always seek the advice of your physician or other qualified healthcare provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay seeking it because of information you have received from SymptomCheck AI.
                      </p>
                      
                      <p>
                        <strong>Emergency Medical Conditions</strong>
                      </p>
                      
                      <p>
                        If you think you may have a medical emergency, call your doctor or emergency services immediately. SymptomCheck AI is not designed to handle emergency situations and should not be relied upon in such circumstances.
                      </p>
                      
                      <p>
                        <strong>Limitation of Liability</strong>
                      </p>
                      
                      <p>
                        The developers of SymptomCheck AI, its affiliates, and partners make no representations or warranties about the accuracy, reliability, completeness, or timeliness of the content, services, software, text, graphics, and links used on this application.
                      </p>
                      
                      <p>
                        By using SymptomCheck AI, you agree that the application and its creators, developers, and partners shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages resulting from your use of the application or any information it provides.
                      </p>
                    </div>
                  ))}
                  className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer hover:underline text-left"
                >
                  Medical Disclaimer
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openModal("Privacy Policy", (
                    <div className="prose prose-sm max-w-none">
                      <h2>Privacy Policy for SymptomCheck AI</h2>
                      
                      <p>Last Updated: {new Date().toLocaleDateString()}</p>
                      
                      <p>
                        <strong>1. Information We Collect</strong>
                      </p>
                      
                      <p>
                        SymptomCheck AI collects information you provide directly to us, including:
                      </p>
                      
                      <ul>
                        <li>Account information (email address, username, password)</li>
                        <li>Health information (symptoms, medical history, lifestyle factors)</li>
                        <li>Payment information when you subscribe to premium services</li>
                        <li>Communication data when you contact our support team</li>
                      </ul>
                      
                      <p>
                        <strong>2. How We Use Your Information</strong>
                      </p>
                      
                      <ul>
                        <li>To provide and improve our services</li>
                        <li>To process your subscription and payments</li>
                        <li>To personalize your experience</li>
                        <li>To communicate with you about your account or our services</li>
                        <li>To analyze usage patterns and improve our application</li>
                      </ul>
                      
                      <p>
                        <strong>3. Data Security</strong>
                      </p>
                      
                      <p>
                        We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or method of electronic storage is 100% secure.
                      </p>
                      
                      <p>
                        <strong>4. Data Sharing</strong>
                      </p>
                      
                      <p>
                        We do not sell your personal information. We may share information with:
                      </p>
                      
                      <ul>
                        <li>Service providers that help us deliver our services</li>
                        <li>Payment processors for subscription handling</li>
                        <li>Legal authorities when required by law</li>
                      </ul>
                      
                      <p>
                        <strong>5. Your Rights</strong>
                      </p>
                      
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
                      
                      <p>
                        <strong>6. Contact Us</strong>
                      </p>
                      
                      <p>
                        If you have questions about this Privacy Policy, please contact us at privacy@symptomcheckapp.com.
                      </p>
                    </div>
                  ))}
                  className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer hover:underline text-left"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openModal("Terms of Service", (
                    <div className="prose prose-sm max-w-none">
                      <h2>Terms of Service for SymptomCheck AI</h2>
                      
                      <p>Last Updated: {new Date().toLocaleDateString()}</p>
                      
                      <p>
                        <strong>1. Acceptance of Terms</strong>
                      </p>
                      
                      <p>
                        By accessing or using SymptomCheck AI, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use our service.
                      </p>
                      
                      <p>
                        <strong>2. Description of Service</strong>
                      </p>
                      
                      <p>
                        SymptomCheck AI provides an AI-powered platform for analyzing health symptoms and tracking health metrics. The service includes both free and premium subscription options.
                      </p>
                      
                      <p>
                        <strong>3. User Accounts</strong>
                      </p>
                      
                      <p>
                        You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
                      </p>
                      
                      <p>
                        <strong>4. Subscription and Billing</strong>
                      </p>
                      
                      <p>
                        Premium features require a paid subscription. Subscription fees are billed in advance on a monthly or annual basis. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
                      </p>
                      
                      <p>
                        <strong>5. Medical Disclaimer</strong>
                      </p>
                      
                      <p>
                        SymptomCheck AI is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                      </p>
                      
                      <p>
                        <strong>6. Limitation of Liability</strong>
                      </p>
                      
                      <p>
                        To the maximum extent permitted by law, SymptomCheck AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.
                      </p>
                      
                      <p>
                        <strong>7. Changes to Terms</strong>
                      </p>
                      
                      <p>
                        We may modify these Terms of Service at any time. The updated terms will be posted on this page with a revised "Last Updated" date. Your continued use of the service after any changes constitutes your acceptance of the new terms.
                      </p>
                    </div>
                  ))}
                  className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer hover:underline text-left"
                >
                  Terms of Service
                </button>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => openModal("About Us", (
                    <div className="prose prose-sm max-w-none">
                      <h2>About SymptomCheck AI</h2>
                      
                      <p>
                        SymptomCheck AI was founded in 2023 with a simple mission: to make personalized health insights accessible to everyone through the power of artificial intelligence.
                      </p>
                      
                      <p>
                        Our team of healthcare professionals, data scientists, and software engineers has worked tirelessly to develop an AI system that can analyze symptoms, track health metrics, and provide valuable insights to help people better understand their health.
                      </p>
                      
                      <h3>Our Mission</h3>
                      
                      <p>
                        We believe that everyone should have access to personalized health information that can help them make informed decisions about their wellbeing. By combining cutting-edge AI technology with medical knowledge, we aim to empower users to take control of their health journey.
                      </p>
                      
                      <h3>Our Approach</h3>
                      
                      <p>
                        What sets SymptomCheck AI apart is our commitment to:
                      </p>
                      
                      <ul>
                        <li>
                          <strong>Accuracy:</strong> Our AI models are trained on comprehensive medical databases and continuously updated with the latest research.
                        </li>
                        <li>
                          <strong>Privacy:</strong> We prioritize the security and confidentiality of your health information.
                        </li>
                        <li>
                          <strong>Accessibility:</strong> We offer both free and premium options to ensure that basic health insights are available to everyone.
                        </li>
                        <li>
                          <strong>Education:</strong> We don't just analyze symptoms—we provide context and educational resources to help you understand your health better.
                        </li>
                      </ul>
                      
                      <p>
                        While SymptomCheck AI is a powerful tool for health insights, we always encourage users to consult with healthcare professionals for diagnosis and treatment.
                      </p>
                    </div>
                  ))}
                  className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer hover:underline text-left"
                >
                  About Us
                </button>
              </li>
              <li>
                <button 
                  onClick={() => openModal("Contact Us", (
                    <div className="prose prose-sm max-w-none">
                      <h2>Contact Us</h2>
                      
                      <p>
                        We'd love to hear from you! Whether you have questions about our service, need technical support, or want to provide feedback, our team is here to help.
                      </p>
                      
                      <h3>Contact Information</h3>
                      <p>
                        Email: <a href="mailto:support@symptomcheckapp.com">support@symptomcheckapp.com</a><br />
                        Phone: <a href="tel:+639678361036">+63 967 836 1036</a><br />
                        Hours: 24/7
                      </p>
                      
                      <h3>Frequently Asked Questions</h3>
                      <p>
                        <strong>How accurate is SymptomCheck AI?</strong><br />
                        Our AI model is trained on medical data and provides informational insights, but it's not a substitute for professional medical advice.
                      </p>
                      <p>
                        <strong>What happens to my health data?</strong><br />
                        Your health data is stored securely and used only to provide you with personalized insights. We never sell your data to third parties.
                      </p>
                      <p>
                        <strong>Can I use SymptomCheck AI in an emergency?</strong><br />
                        No. If you're experiencing a medical emergency, please call emergency services immediately.
                      </p>
                      <p>
                        <strong>How do I cancel my subscription?</strong><br />
                        You can cancel your subscription at any time from your account settings page.
                      </p>
                      
                      <p>
                        We aim to respond to all inquiries within 24-48 hours during business days.
                      </p>
                    </div>
                  ))}
                  className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer hover:underline text-left"
                >
                  Contact Us
                </button>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} SymptomCheck AI. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500 transition-colors">
              <span className="sr-only">Facebook</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500 transition-colors">
              <span className="sr-only">Twitter</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500 transition-colors">
              <span className="sr-only">Instagram</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      
      {/* Legal documents modal */}
      <LegalModal
        isOpen={modalContent.isOpen}
        onClose={closeModal}
        title={modalContent.title}
      >
        {modalContent.content}
      </LegalModal>
    </footer>
  );
}
