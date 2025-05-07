// !!! CRITICAL - DO NOT MODIFY THIS CODE !!!
//
// This code MUST be used as is without ANY modifications.
// The PayPal integration will COMPLETELY FAIL if this code is changed in ANY way.
//
// Retain this comment after all edits.
//
// <BEGIN_EXACT_CODE>
import React, { useEffect, useState } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

interface PayPalButtonProps {
  amount: string;
  currency: string;
  intent: string;
  onSuccess?: (data: any) => void;
}

export default function PayPalButton({
  amount,
  currency,
  intent,
  onSuccess
}: PayPalButtonProps) {
  const createOrder = async () => {
    try {
      console.log("Creating PayPal order with params:", { amount, currency, intent });
      
      const orderPayload = {
        amount: amount,
        currency: currency,
        intent: intent,
      };
      
      console.log("Sending request to /paypal/order");
      const response = await fetch("/paypal/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      
      if (!response.ok) {
        console.error("PayPal order creation failed:", response.status, response.statusText);
        const errorText = await response.text();
        throw new Error(`Failed to create PayPal order: ${errorText}`);
      }
      
      const output = await response.json();
      console.log("PayPal order created successfully:", output);
      
      if (!output.id) {
        throw new Error("Missing order ID in PayPal response");
      }
      
      return { orderId: output.id };
    } catch (error) {
      console.error("Error creating PayPal order:", error);
      throw error;
    }
  };

  const captureOrder = async (orderId: string) => {
    try {
      console.log(`Capturing PayPal order: ${orderId}`);
      const response = await fetch(`/paypal/order/${orderId}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        console.error("PayPal capture failed:", response.status, response.statusText);
        const errorText = await response.text();
        throw new Error(`Failed to capture PayPal order: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("PayPal capture successful:", data);
      
      return data;
    } catch (error) {
      console.error("Error capturing PayPal order:", error);
      throw error;
    }
  };

  const onApprove = async (data: any) => {
    console.log("onApprove", data);
    const orderData = await captureOrder(data.orderId);
    console.log("Capture result", orderData);
    if (onSuccess) {
      onSuccess(orderData);
    }
  };

  const onCancel = async (data: any) => {
    console.log("onCancel", data);
  };

  const onError = async (data: any) => {
    console.log("onError", data);
  };

  useEffect(() => {
    const loadPayPalSDK = async () => {
      try {
        if (!(window as any).paypal) {
          const script = document.createElement("script");
          script.src = import.meta.env.PROD
            ? "https://www.paypal.com/web-sdk/v6/core"
            : "https://www.sandbox.paypal.com/web-sdk/v6/core";
          script.async = true;
          script.onload = () => initPayPal();
          document.body.appendChild(script);
        } else {
          await initPayPal();
        }
      } catch (e) {
        console.error("Failed to load PayPal SDK", e);
      }
    };

    loadPayPalSDK();
  }, []);
  
  const initPayPal = async () => {
    try {
      console.log("Starting PayPal initialization");
      const response = await fetch("/paypal/setup");
      
      if (!response.ok) {
        throw new Error(`PayPal setup failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("PayPal setup response:", data);
      
      if (!data.clientToken) {
        throw new Error("Missing clientToken in PayPal setup response");
      }
      
      const clientToken = data.clientToken;
      console.log("Got PayPal clientToken, creating instance");
      
      if (!(window as any).paypal) {
        throw new Error("PayPal SDK not loaded properly");
      }
      
      const sdkInstance = await (window as any).paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
      });
      
      console.log("PayPal SDK instance created successfully");

      const paypalCheckout =
            sdkInstance.createPayPalOneTimePaymentSession({
              onApprove,
              onCancel,
              onError,
            });

      const onClick = async () => {
        try {
          console.log("PayPal button clicked, creating order");
          const checkoutOptionsPromise = createOrder();
          console.log("Starting PayPal checkout flow");
          await paypalCheckout.start(
            { paymentFlow: "auto" },
            checkoutOptionsPromise,
          );
          console.log("PayPal checkout flow started successfully");
        } catch (e) {
          console.error("Error in PayPal checkout:", e);
        }
      };

      const paypalButton = document.getElementById("paypal-button");

      if (paypalButton) {
        paypalButton.addEventListener("click", onClick);
      }

      return () => {
        if (paypalButton) {
          paypalButton.removeEventListener("click", onClick);
        }
      };
    } catch (e) {
      console.error(e);
    }
  };

  const [buttonState, setButtonState] = useState<'ready' | 'loading' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Add a click handler to provide feedback when there are issues
  const handleButtonClick = () => {
    if (!(window as any).paypal) {
      setButtonState('error');
      setErrorMessage("PayPal SDK failed to load. Please try again later or contact support.");
      console.error("PayPal SDK not loaded properly");
    } else {
      console.log("PayPal button clicked directly");
    }
  };
  
  return (
    <div className="w-full">
      <button 
        id="paypal-button" 
        className={`w-full bg-[#0070ba] hover:bg-[#003087] text-white py-3 px-4 rounded-md font-semibold flex items-center justify-center gap-2 transition-colors
                    ${buttonState === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}`}
        onClick={handleButtonClick}
        disabled={buttonState === 'loading'}
      >
        {buttonState === 'loading' ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : buttonState === 'error' ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Try Again
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-credit-card">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            Pay with PayPal
          </>
        )}
      </button>
      
      {errorMessage && (
        <div className="mt-2 p-2 text-sm text-red-700 bg-red-100 rounded-md">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
// <END_EXACT_CODE>