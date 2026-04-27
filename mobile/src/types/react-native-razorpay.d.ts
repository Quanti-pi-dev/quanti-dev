// Type declarations for react-native-razorpay
// https://razorpay.com/docs/payments/payment-gateway/react-native-integration/standard/
// https://razorpay.com/docs/payments/subscriptions/build-integration/

declare module 'react-native-razorpay' {
  interface RazorpayOptions {
    key: string;
    /**
     * For one-off payments. Mutually exclusive with subscription_id.
     */
    order_id?: string;
    /**
     * For recurring subscriptions. When set, Razorpay opens in subscription
     * checkout mode and captures a UPI Autopay / mandate.
     * Mutually exclusive with order_id.
     */
    subscription_id?: string;
    amount?: number;
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

  /** Returned when checkout is opened with subscription_id */
  interface RazorpaySubscriptionSuccessResponse {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }

  interface RazorpayErrorResponse {
    code: number;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id?: string;
      payment_id?: string;
      subscription_id?: string;
    };
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse | RazorpaySubscriptionSuccessResponse>;
  };

  export default RazorpayCheckout;
  export type { RazorpayOptions, RazorpaySuccessResponse, RazorpaySubscriptionSuccessResponse, RazorpayErrorResponse };
}
