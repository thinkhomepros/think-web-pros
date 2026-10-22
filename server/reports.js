import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { redisFromEnv } from './security.js';

/* ---------- problem reports ----------
   Visitors use "Report a problem" in the studio or on the landing page. A report has what happened, an optional email
   and screenshot, and details the page adds by itself (page, browser, screen, preview device, recent errors).
   Reports are kept in Redis when it is set up (so they survive on Vercel), otherwise as files. */

export const REPORT_STATUSES = ['New', 'In progress', 'Fixed'];
export const REPORT_LIMITS = { what: 5000, email: 254, field: 500, errors: 20, error: 1000, shotBytes: 3 * 1024 * 1024 };
const SHOT = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const ID = /^[0-9a-f-]{36}$/;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Turns what the browser sent into a clean record, or returns { error } when it can't be used.
export function cleanReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'report is required' };
  const what = typeof input.what === 'string' ? input.what.trim() : '';
  if (!what) return { error: 'Please say what happened.' };
  if (what.length > REPORT_LIMITS.what) return { error: 'The description is too long.' };
  const email = text(input.email, REPORT_LIMITS.email + 1);
  if (email && (email.length > REPORT_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'That email address doesn’t look right.' };
  const shot = typeof input.screenshot === 'string' ? input.screenshot : '';
  if (shot && (shot.length > REPORT_LIMITS.shotBytes || !SHOT.test(shot))) return { error: 'The screenshot must be a PNG, JPG or WebP image under 2 MB.' };
  const env = input.env && typeof input.env === 'object' ? input.env : {};
  const errors = Array.isArray(input.errors) ? input.errors.slice(-REPORT_LIMITS.errors).map((e) => text(e, REPORT_LIMITS.error)).filter(Boolean) : [];
  return {
    report: {
      what,
      email,
      page: text(input.page, REPORT_LIMITS.field),
      where: text(input.where, 40),
      env: {
        browser: text(env.browser, REPORT_LIMITS.field),
        platform: text(env.platform, 100),
        screen: text(env.screen, 40),
        window: text(env.window, 40),
        touch: env.touch === true,
        language: text(env.language, 40),
        preview: text(env.preview, 60),
      },
      errors,
      screenshot: shot || null,
    },
  };
}

export function createReportFiles(dataDir) {
  const dir = path.join(dataDir, 'reports');
  const ready = mkdir(dir, { recursive: true });
  const file = (id) => path.join(dir, `${id}.json`);
  const store = {
    async save(record) {
      await ready;
      await writeFile(file(record.id), JSON.stringify(record));
      return record;
    },
    async list() {
      await ready;
      const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
      const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))));
      return all.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map(({ screenshot, ...r }) => ({ ...r, hasScreenshot: Boolean(screenshot) }));
    },
    async get(id) {
      await ready;
      try {
        return JSON.parse(await readFile(file(id), 'utf8'));
      } catch {
        return null;
      }
    },
    async setStatus(id, status) {
      const record = await store.get(id);
      if (!record) return null;
      record.status = status;
      record.updatedAt = new Date().toISOString();
      await store.save(record);
      const { screenshot, ...summary } = record;
      return { ...summary, hasScreenshot: Boolean(screenshot) };
    },
  };
  return store;
}

// Upstash Redis over HTTPS. The screenshot has its own key so the list stays small.
export function createReportRedis({ url, token, fetchImpl = fetch }) {
  async function run(commands) {
    const res = await fetchImpl(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Redis request failed (${res.status})`);
    const out = await res.json();
    const failed = out.find((r) => r.error);
    if (failed) throw new Error(`Redis: ${failed.error}`);
    return out.map((r) => r.result);
  }
  const parse = (s) => (s ? JSON.parse(s) : null);
  return {
    async save(record) {
      const { screenshot, ...summary } = record;
      const cmds = [
        ['SET', `twp:report:${record.id}`, JSON.stringify({ ...summary, hasScreenshot: Boolean(screenshot) })],
        ['ZADD', 'twp:reports', String(Date.parse(record.receivedAt) || Date.now()), record.id],
      ];
      if (screenshot) cmds.push(['SET', `twp:report-shot:${record.id}`, screenshot]);
      await run(cmds);
      return record;
    },
    async list() {
      const [ids] = await run([['ZRANGE', 'twp:reports', '0', '499', 'REV']]);
      if (!ids?.length) return [];
      const [values] = await run([['MGET', ...ids.map((id) => `twp:report:${id}`)]]);
      return values.map(parse).filter(Boolean);
    },
    async get(id) {
      const [rec, shot] = await run([['GET', `twp:report:${id}`], ['GET', `twp:report-shot:${id}`]]);
      const record = parse(rec);
      return record && { ...record, screenshot: shot || null };
    },
    async setStatus(id, status) {
      const [rec] = await run([['GET', `twp:report:${id}`]]);
      const record = parse(rec);
      if (!record) return null;
      const next = { ...record, status, updatedAt: new Date().toISOString() };
      await run([['SET', `twp:report:${id}`, JSON.stringify(next)]]);
      return next;
    },
  };
}

export function reportsFromEnv(env, fallbackDir) {
  const redis = redisFromEnv(env);
  return redis ? createReportRedis(redis) : createReportFiles(env.DATA_DIR || fallbackDir);
}

// Adds the report routes. Sending one is rate limited and bot checked like orders; reading and updating them is admin only.
export function addReportRoutes(app, { reports, limit, humanOnly, requireAdmin }) {
  app.post('/api/reports', limit, humanOnly, async (req, res) => {
    const input = req.body?.report;
    // a bot filled in the hidden field: look like it worked, keep nothing
    if (input && typeof input.hp === 'string' && input.hp.trim()) return res.status(201).json({ id: randomUUID() });
    const { report, error } = cleanReport(input);
    if (error) return res.status(400).json({ error });
    const record = { id: randomUUID(), receivedAt: new Date().toISOString(), status: 'New', ...report };
    try {
      await reports.save(record);
    } catch (err) {
      console.error('Report not stored:', err.message);
      return res.status(503).json({ error: 'We couldn’t save your report just now. Please try again in a minute.' });
    }
    res.status(201).json({ id: record.id });
  });
  app.get('/api/reports', requireAdmin, async (req, res) => res.json(await reports.list()));
  app.get('/api/reports/:id', requireAdmin, async (req, res) => {
    const record = ID.test(req.params.id) ? await reports.get(req.params.id) : null;
    record ? res.json(record) : res.status(404).json({ error: 'not found' });
  });
  app.patch('/api/reports/:id', requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (!REPORT_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${REPORT_STATUSES.join(', ')}` });
    const record = ID.test(req.params.id) ? await reports.setStatus(req.params.id, status) : null;
    record ? res.json(record) : res.status(404).json({ error: 'not found' });
  });
}
