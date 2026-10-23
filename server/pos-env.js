import { createMailer, createTexter } from './pos.js';
import { createTerminal } from './terminal.js';

// The register's pieces, each switched on by its environment variables (see docs/pos-setup.md).
// POS_FEE_PERCENT and POS_FEE_CENTS: what Think Web Pros keeps from each card payment on a shop's own Stripe
// account (Stripe's application fee), e.g. 0.5 and 5 for 0.5% + 5¢. Both 0 (the default) keeps nothing.
export function posFromEnv(env = process.env) {
  const pct = Math.max(0, Number(env.POS_FEE_PERCENT) || 0);
  const flat = Math.max(0, Math.round(Number(env.POS_FEE_CENTS) || 0));
  return {
    terminal: createTerminal({ secretKey: env.STRIPE_SECRET_KEY }),
    mailer: createMailer({ apiKey: env.RESEND_API_KEY, from: env.RECEIPT_FROM }),
    texter: createTexter({ sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM }),
    appFee: pct || flat ? (amount) => Math.min(amount - 1, Math.round((amount * pct) / 100) + flat) : null,
  };
}
