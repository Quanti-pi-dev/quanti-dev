// Type declarations for react-native-razorpay
// https://razorpay.com/docs/payments/payment-gateway/react-native-integration/standard/

declare module 'react-native-razorpay' {
  interface RazorpayOptions {
    key: string;
    order_id: string;
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
      backdrop_color?: string;
    };
  }

  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  interface RazorpayErrorResponse {
    code: number;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>;
  };

  export default RazorpayCheckout;
  export type { RazorpayOptions, RazorpaySuccessResponse, RazorpayErrorResponse };
}
