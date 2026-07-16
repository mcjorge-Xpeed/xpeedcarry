export const PAYMENT_REQUEST_PREFIX = "::PAYMENT_REQUEST::";

export type PaymentRequestPayload = {
  orderId: string;
  clientId: string;
  orderNumber: string;
  title: string;
  price: number;
};

export function buildPaymentRequestMessage(payload: PaymentRequestPayload): string {
  return PAYMENT_REQUEST_PREFIX + JSON.stringify(payload);
}

export function parsePaymentRequestMessage(content: string): PaymentRequestPayload | null {
  if (!content.startsWith(PAYMENT_REQUEST_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(PAYMENT_REQUEST_PREFIX.length));
  } catch {
    return null;
  }
}
