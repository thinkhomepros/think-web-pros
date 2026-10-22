import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { addReportRoutes, createReportFiles } from './reports.js';
import { checkOrder, createCounter, isBot, rateLimit, sameOrigin, securityHeaders } from './security.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(here, '..', 'web');
const MAX_PROMPT = 8000;

function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Limits: aiPerMinute/aiPerDay are per visitor; aiDailyTotal caps everyone together so the AI bill can't run away.
// human is the optional Turnstile check from security.js; counter is where rate limit counts are kept.
// reports is where "Report a problem" messages are kept (see reports.js).
export function createApp({ ai, store, reports = createReportFiles(path.join(tmpdir(), 'think-web-pros')), reportsPerHour = 5, adminToken, aiPerMinute = 10, aiPerDay = 100, aiDailyTotal = 1000, ordersPerHour = 10, human = null, counter = createCounter(), headers = true }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  if (headers) app.use(securityHeaders());
  app.use('/api', sameOrigin(), rateLimit(counter, 'api', [{ windowSec: 60, max: 300 }]));
  const humanOnly = human ? human.middleware : (req, res, next) => next();
  // Designs carry uploaded logos and photos as data URLs, so orders can be large. Vercel stops bodies over 4.5 MB.
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => res.json({ ai: Boolean(ai) }));

  const aiLimit = rateLimit(counter, 'ai', [
    { windowSec: 60, max: aiPerMinute },
    { windowSec: 86_400, max: aiPerDay },
    { windowSec: 86_400, max: aiDailyTotal, key: 'all' },
  ], 'Too many AI requests, try again shortly.');
  app.post('/api/ai/sample', aiLimit, humanOnly, async (req, res) => {
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

  const orderLimit = rateLimit(counter, 'orders', [{ windowSec: 3600, max: ordersPerHour }, { windowSec: 86_400, max: ordersPerHour * 4 }]);
  app.post('/api/orders', orderLimit, humanOnly, async (req, res) => {
    const order = req.body?.order;
    if (!order || typeof order !== 'object' || Array.isArray(order)) return res.status(400).json({ error: 'order is required' });
    // a bot filled in the hidden field: look like it worked, keep nothing
    if (isBot(order)) return res.status(201).json({ id: randomUUID(), status: 'New' });
    const problem = checkOrder(order, req.body.design);
    if (problem) return res.status(413).json({ error: problem });
    const email = String(order.email || '').trim();
    if (!String(order.business || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'business and a valid email are required' });
    }
    delete order.hp;
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
  // 10 wrong passwords from one address locks that address out for 15 minutes, so the token can't be guessed.
  const requireAdmin = async (req, res, next) => {
    const failKey = `admin-fail:${req.ip}`;
    if ((await counter(failKey, 900, 0)) >= 10) {
      res.set('Retry-After', '900');
      return res.status(429).json({ code: 'rate_limited', error: 'Too many wrong passwords. Try again in 15 minutes.' });
    }
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!adminToken || !token || !sameSecret(token, adminToken)) {
      await counter(failKey, 900);
      return res.status(401).json({ error: 'unauthorized' });
    }
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

  const reportLimit = rateLimit(counter, 'reports', [{ windowSec: 3600, max: reportsPerHour }, { windowSec: 86_400, max: reportsPerHour * 4 }], 'You’ve sent several reports already. Please wait a while and try again.');
  addReportRoutes(app, { reports, limit: reportLimit, humanOnly, requireAdmin });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
  // the old studio guide page now lives inside the studio as the tour and Help panel
  app.get(['/guide', '/guide.html'], (req, res) => res.redirect(301, '/builder'));
  app.use(express.static(WEB_DIR, { extensions: ['html'] }));
  // Bad JSON or a body that's too big gets a plain answer; nothing about the server's insides is sent back.
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('Request failed:', err.message);
    res.status(status).json({ error: status === 413 ? 'request is too large' : status < 500 ? 'bad request' : 'server error' });
  });
  return app;
}
