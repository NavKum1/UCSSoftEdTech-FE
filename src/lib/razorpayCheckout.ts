/**
 * Razorpay Checkout for a school's plan (S1/S2, India): loads Razorpay's script, opens its window for the subscription the
 * API made, and sends the signed confirmation back to the API, which checks it and creates (or reopens) the school.
 */
import { authenticatedFetch } from "@/lib/apiClient";

export interface RazorpayStart {
  keyId: string;
  subscriptionId: string;
  name: string;
  email: string;
}

interface RazorpayAnswer {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

const load = () =>
  new Promise<void>((resolve, reject) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Razorpay couldn't be loaded. Check your connection and try again."));
    document.body.appendChild(s);
  });

/** C1: a one-time payment (an order), such as a pack of voice minutes */
export interface RazorpayOrderStart {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  email: string;
  description: string;
}

/** Opens Razorpay Checkout for an order and sends its signed answer to `confirmPath`; `onDone` runs after the API has it */
export async function openRazorpayOrder(opts: {
  start: RazorpayOrderStart;
  confirmPath: string;
  getToken: () => Promise<string | null>;
  onDone: (ok: boolean) => void;
  onClose: () => void;
}) {
  await load();
  const Razorpay = (window as unknown as { Razorpay: new (o: object) => { open: () => void } }).Razorpay;
  new Razorpay({
    key: opts.start.keyId,
    order_id: opts.start.orderId,
    amount: opts.start.amount,
    currency: opts.start.currency,
    name: "Edulexa",
    description: opts.start.description,
    prefill: { email: opts.start.email },
    handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
      const res = await authenticatedFetch(
        opts.confirmPath,
        { method: "POST", body: JSON.stringify({ paymentId: r.razorpay_payment_id, orderId: r.razorpay_order_id, signature: r.razorpay_signature }) },
        opts.getToken,
      ).catch(() => null);
      opts.onDone(!!res?.ok);
    },
    modal: { ondismiss: opts.onClose },
  }).open();
}

/** Opens the window; `onDone` runs after the API has the confirmation, `onClose` when the window is closed without paying */
export async function openRazorpayCheckout(opts: {
  signupId: string;
  start: RazorpayStart;
  description: string;
  getToken: () => Promise<string | null>;
  onDone: () => void;
  onClose: () => void;
}) {
  await load();
  const Razorpay = (window as unknown as { Razorpay: new (o: object) => { open: () => void } }).Razorpay;
  new Razorpay({
    key: opts.start.keyId,
    subscription_id: opts.start.subscriptionId,
    name: "Edulexa",
    description: opts.description,
    prefill: { email: opts.start.email },
    handler: async (r: RazorpayAnswer) => {
      await authenticatedFetch(
        `/api/signup/${opts.signupId}/razorpay`,
        { method: "POST", body: JSON.stringify({ paymentId: r.razorpay_payment_id, subscriptionId: r.razorpay_subscription_id, signature: r.razorpay_signature }) },
        opts.getToken,
      ).catch(() => undefined);
      opts.onDone();
    },
    modal: { ondismiss: opts.onClose },
  }).open();
}
