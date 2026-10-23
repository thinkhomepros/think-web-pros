import path from 'node:path';
import { createAi } from './ai.js';
import { createApp } from './app.js';
import { reportsFromEnv } from './reports.js';
import { dbFromEnv } from './db.js';
import { paymentsFromEnv } from './env.js';
import { securityFromEnv } from './security.js';
import { storeFromEnv } from './store.js';

const port = Number(process.env.PORT) || 3000;
const ai = createAi();
const store = storeFromEnv(process.env, path.resolve('data'));
const payments = paymentsFromEnv();
const app = createApp({ ai, store, reports: reportsFromEnv(process.env, path.resolve('data')), adminToken: process.env.ADMIN_TOKEN, payments, db: dbFromEnv(process.env, path.resolve('data')), publicUrl: process.env.PUBLIC_URL, ...securityFromEnv() });

app.listen(port, () => {
  console.log(`Think Web Pros Studio running at http://localhost:${port}`);
  console.log(ai ? `AI logo maker: live (${ai.model})` : 'AI logo maker: quick ideas only (set ANTHROPIC_API_KEY for live AI)');
  const on = [payments.stripe && `cards${payments.stripe.testMode ? ' (test mode)' : ''}`, payments.paypal && `PayPal/Venmo (${payments.paypal.env})`, payments.zelle && 'Zelle'].filter(Boolean);
  console.log(on.length ? `Payments: ${on.join(', ')}` : 'Payments: none set up (orders are taken without payment)');
});
