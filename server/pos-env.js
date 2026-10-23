import { createTerminal } from './terminal.js';

// The register's pieces (email and text receipts come from notify.js), each switched on by its environment variables (see docs/pos-setup.md).
// POS_FEE_PERCENT and POS_FEE_CENTS: what Think Web Pros keeps from each card payment on a shop's own Stripe
// account (Stripe's application fee), e.g. 0.5 and 5 for 0.5% + 5¢. Both 0 (the default) keeps nothing.
export function posFromEnv(env = process.env) {
  const pct = Math.max(0, Number(env.POS_FEE_PERCENT) || 0);
  const flat = Math.max(0, Math.round(Number(env.POS_FEE_CENTS) || 0));
  return {
    terminal: createTerminal({ secretKey: env.STRIPE_SECRET_KEY }),
    appFee: pct || flat ? (amount) => Math.min(amount - 1, Math.round((amount * pct) / 100) + flat) : null,
  };
}
