import { createPayPalPayments, createStripePayments, zelleFromEnv } from './payments.js';

// Payment providers from environment variables. Each one is off until its keys are set.
export function paymentsFromEnv(env = process.env) {
  return {
    stripe: createStripePayments({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET }),
    paypal: createPayPalPayments({ clientId: env.PAYPAL_CLIENT_ID, secret: env.PAYPAL_CLIENT_SECRET, env: env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox' }),
    zelle: zelleFromEnv(env),
  };
}
