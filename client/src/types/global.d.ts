// Global type definitions
interface Window {
  gtag: (
    command: string,
    action: string | Date,
    params?: {
      [key: string]: any;
    }
  ) => void;
  dataLayer: any[];
}