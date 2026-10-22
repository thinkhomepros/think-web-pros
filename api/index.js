// Vercel entry: runs the Express API as a serverless function. vercel.json serves web/ as static files.
import { createAi } from '../server/ai.js';
import { createApp } from '../server/app.js';
import { reportsFromEnv } from '../server/reports.js';
import { securityFromEnv } from '../server/security.js';
import { createStore } from '../server/store.js';

// Only /tmp is writable on Vercel, and it doesn't last between requests.
const store = createStore(process.env.DATA_DIR || '/tmp/think-web-pros');

export default createApp({ ai: createAi(), store, reports: reportsFromEnv(process.env, '/tmp/think-web-pros'), adminToken: process.env.ADMIN_TOKEN, ...securityFromEnv() });
