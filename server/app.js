import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(here, '..', 'web');
const MAX_PROMPT = 8000;

// Fixed-window limiter keyed by IP, so the AI endpoint can't be used to run up the API bill.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || now - entry.start > windowMs) {
      hits.set(req.ip, { start: now, count: 1 });
      return next();
    }
    if (++entry.count > max) return res.status(429).json({ code: 'rate_limited', error: 'Too many AI requests, try again shortly.' });
    next();
  };
}

function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createApp({ ai, store, adminToken, aiPerMinute = 10 }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  // Designs carry uploaded logos and photos as data URLs, so orders can be large.
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => res.json({ ai: Boolean(ai) }));

  app.post('/api/ai/sample', rateLimit({ windowMs: 60_000, max: aiPerMinute }), async (req, res) => {
    if (!ai) return res.status(503).json({ code: 'not_granted', error: 'AI is not configured on this server.' });
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) return res.status(400).json({ code: 'bad_request', error: 'prompt is required' });
    if (prompt.length > MAX_PROMPT) return res.status(413).json({ code: 'too_long', error: 'prompt is too long' });
    try {
      res.json(await ai.complete(prompt, { json: Boolean(req.body.json) }));
    } catch (err) {
      if (err.code === 'refused') return res.status(422).json({ code: 'refused', error: err.message });
      console.error('AI request failed:', err.message);
      res.status(502).json({ code: 'server_error', error: 'The AI request failed.' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    const order = req.body?.order;
    if (!order || typeof order !== 'object') return res.status(400).json({ error: 'order is required' });
    const email = String(order.email || '').trim();
    if (!String(order.business || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'business and a valid email are required' });
    }
    const record = {
      id: randomUUID(),
      clientOrderId: String(order.id || ''),
      receivedAt: new Date().toISOString(),
      status: 'New',
      order,
      design: req.body.design ?? null,
    };
    await store.saveOrder(record);
    res.status(201).json({ id: record.id, status: record.status });
  });

  // Admin reads require ADMIN_TOKEN; without one set they stay locked.
  const requireAdmin = (req, res, next) => {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!adminToken || !token || !sameSecret(token, adminToken)) return res.status(401).json({ error: 'unauthorized' });
    next();
  };
  app.get('/api/orders', requireAdmin, async (req, res) => {
    const orders = await store.listOrders();
    res.json(orders.map(({ design, ...summary }) => summary));
  });
  app.get('/api/orders/:id', requireAdmin, async (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).json({ error: 'not found' });
    const order = await store.getOrder(req.params.id);
    order ? res.json(order) : res.status(404).json({ error: 'not found' });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
  // the old studio guide page now lives inside the studio as the tour and Help panel
  app.get(['/guide', '/guide.html'], (req, res) => res.redirect(301, '/builder'));
  app.use(express.static(WEB_DIR, { extensions: ['html'] }));
  return app;
}
