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
