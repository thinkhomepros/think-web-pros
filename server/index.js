import path from 'node:path';
import { createAi } from './ai.js';
import { createApp } from './app.js';
import { createStore } from './store.js';

const port = Number(process.env.PORT) || 3000;
const ai = createAi();
const store = createStore(path.resolve(process.env.DATA_DIR || 'data'));
const app = createApp({ ai, store, adminToken: process.env.ADMIN_TOKEN });

app.listen(port, () => {
  console.log(`Think Web Pros Studio running at http://localhost:${port}`);
  console.log(ai ? `AI logo maker: live (${ai.model})` : 'AI logo maker: quick ideas only (set ANTHROPIC_API_KEY for live AI)');
});
