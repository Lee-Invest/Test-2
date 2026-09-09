import Stripe from "stripe";

// True only when a plausible real Stripe secret key is configured. The
// .env.example placeholder ("sk_test_51exampleXXX...") and any missing key
// both resolve to false, so environments without a real Stripe account can
// still exercise the rest of the checkout flow (see app/api/checkout/route.ts).
export const isStripeConfigured = Boolean(
  process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes("example")
);

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});
