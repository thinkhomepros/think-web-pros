// Vercel entry: runs the Express API as a serverless function. vercel.json serves web/ as static files.
import { createAi } from '../server/ai.js';
import { createApp } from '../server/app.js';
import { paymentsFromEnv } from '../server/env.js';
import { storeFromEnv } from '../server/store.js';

// Orders go to Redis when its keys are set. Without it they fall back to /tmp, which Vercel wipes often.
const store = storeFromEnv(process.env, '/tmp/think-web-pros');
if (!store.durable) console.warn('Orders are kept in /tmp and will be lost. Add Upstash Redis under Vercel Storage.');

export default createApp({ ai: createAi(), store, adminToken: process.env.ADMIN_TOKEN, payments: paymentsFromEnv(), publicUrl: process.env.PUBLIC_URL });
