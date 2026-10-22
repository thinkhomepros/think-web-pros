import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/* ---------- security headers ----------
   vercel.json is the one list of headers. Vercel sends them on the live site; this middleware sends the same ones
   when the server runs on its own (npm run dev, Docker), so local testing sees the real Content-Security-Policy. */
export function loadHeaderRules(file = path.join(here, '..', 'vercel.json')) {
  const { headers = [] } = JSON.parse(readFileSync(file, 'utf8'));
  return headers.map(({ source, headers: list }) => ({
    match: new RegExp(`^${source.split('(.*)').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*)')}$`),
    list,
  }));
}

export function securityHeaders(rules = loadHeaderRules()) {
  return (req, res, next) => {
    for (const { match, list } of rules) if (match.test(req.path)) for (const { key, value } of list) res.setHeader(key, value);
    next();
  };
}

/* ---------- rate limits ----------
   Counts live in Redis when it is set up (Upstash, the same database the orders use), so every Vercel instance
   shares them. Without Redis each instance counts on its own, which still slows a single attacker down. */
export function redisFromEnv(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function createCounter({ redis = null, fetchImpl = fetch, now = Date.now } = {}) {
  const local = new Map();
  function localHit(key, windowSec, add) {
    const t = now();
    let e = local.get(key);
    if (!e || t >= e.reset) {
      e = { count: 0, reset: t + windowSec * 1000 };
      local.set(key, e);
      if (local.size > 50_000) for (const [k, v] of local) if (t >= v.reset) local.delete(k);
    }
    e.count += add;
    return e.count;
  }
  async function redisHit(key, windowSec, add) {
    const k = `twp:rl:${key}`;
    const cmds = add ? [['SET', k, 0, 'EX', windowSec, 'NX'], ['INCRBY', k, add]] : [['GET', k]];
    const res = await fetchImpl(`${redis.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redis.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`Redis ${res.status}`);
    const out = await res.json();
    return Number(out[out.length - 1]?.result) || 0;
  }
  // Adds `add` to the count for this window and returns the new count (add 0 to read it).
  return async function hit(key, windowSec, add = 1) {
    if (redis) {
      try {
        return await redisHit(key, windowSec, add);
      } catch (err) {
        console.warn('Rate limit store unavailable, counting locally:', err.message);
      }
    }
    return localHit(key, windowSec, add);
  };
}

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

// rules: [{ windowSec, max, key?: 'ip' | 'all' }]. 'all' counts every visitor together (a total cap).
export function rateLimit(counter, name, rules, message = 'Too many requests. Please wait a minute and try again.') {
  return async (req, res, next) => {
    for (const r of rules) {
      const who = r.key === 'all' ? 'all' : clientIp(req);
      const count = await counter(`${name}:${r.windowSec}:${who}`, r.windowSec);
      if (count > r.max) {
        res.set('Retry-After', String(r.windowSec));
        return res.status(429).json({ code: 'rate_limited', error: message });
      }
    }
    next();
  };
}

/* ---------- requests from other websites ----------
   Browsers say which site a request came from. The API only takes posts from its own pages, so another site
   can't use a visitor's browser to send orders or spend AI credit. Server-to-server calls (no Origin) still pass;
   the Stripe webhook has its own signature check. */
export function sameOrigin(allowed = []) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const from = req.get('origin');
    if (!from) return next();
    let host;
    try {
      host = new URL(from).host;
    } catch {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (host === req.get('host') || allowed.includes(host)) return next();
    res.status(403).json({ error: 'forbidden' });
  };
}

/* ---------- human check (Cloudflare Turnstile) ----------
   Off until TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set. When on, the first order or AI request from a
   browser gets a 403 'challenge'; the page solves Turnstile (usually invisibly) and retries with the token, and the
   server answers with a signed cookie so the visitor isn't checked again for a few hours. */
const PASS_COOKIE = 'twp_human';
const PASS_HOURS = 6;

export function createHumanCheck({ siteKey, secretKey, fetchImpl = fetch, now = Date.now } = {}) {
  if (!siteKey || !secretKey) return null;
  const sign = (exp) => createHmac('sha256', secretKey).update(`human:${exp}`).digest('base64url');

  function hasPass(req) {
    const raw = (req.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(`${PASS_COOKIE}=`));
    if (!raw) return false;
    const [exp, sig] = raw.slice(PASS_COOKIE.length + 1).split('.');
    if (!exp || !sig || Number(exp) < now()) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(sign(exp));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async function verify(token, ip) {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const d = await res.json().catch(() => ({}));
    return d.success === true;
  }

  return {
    siteKey,
    middleware: async (req, res, next) => {
      if (hasPass(req)) return next();
      const token = req.get('x-turnstile-token');
      if (token && token.length < 4096) {
        let ok = false;
        try {
          ok = await verify(token, clientIp(req));
        } catch (err) {
          console.error('Turnstile check failed:', err.message);
          return res.status(503).json({ code: 'challenge_unavailable', error: 'The security check is unavailable. Try again in a moment.' });
        }
        if (ok) {
          const exp = now() + PASS_HOURS * 3600_000;
          res.append('Set-Cookie', `${PASS_COOKIE}=${exp}.${sign(exp)}; Path=/api; Max-Age=${PASS_HOURS * 3600}; HttpOnly; Secure; SameSite=Lax`);
          return next();
        }
      }
      res.status(403).json({ code: 'challenge', siteKey, error: 'Please complete the security check.' });
    },
  };
}

/* ---------- order checks ---------- */
export const LIMITS = { orderBytes: 64 * 1024, designBytes: 4 * 1024 * 1024, business: 160, email: 254, text: 5000 };

// Returns an error message, or null when the order looks fine.
export function checkOrder(order, design) {
  if (JSON.stringify(order).length > LIMITS.orderBytes) return 'order is too large';
  if (design != null && JSON.stringify(design).length > LIMITS.designBytes) return 'design is too large';
  if (String(order.business || '').length > LIMITS.business) return 'business name is too long';
  if (String(order.email || '').length > LIMITS.email) return 'email is too long';
  for (const v of Object.values(order)) if (typeof v === 'string' && v.length > LIMITS.text) return 'a field is too long';
  return null;
}

// Hidden form field people never see. Bots that fill in every field fill it in too.
export const isBot = (order) => typeof order.hp === 'string' && order.hp.trim() !== '';

export function checkAdminToken(token) {
  if (!token) return 'ADMIN_TOKEN is not set, so admin pages stay locked.';
  if (token.length < 16) return 'ADMIN_TOKEN is shorter than 16 characters. Use a long random one (see README, Security).';
  return null;
}

// Everything above, set up from environment variables. Each piece stays off (or uses its default) until set.
export function securityFromEnv(env = process.env) {
  const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
  const warning = checkAdminToken(env.ADMIN_TOKEN);
  if (warning) console.warn(warning);
  return {
    counter: createCounter({ redis: redisFromEnv(env) }),
    human: createHumanCheck({ siteKey: env.TURNSTILE_SITE_KEY, secretKey: env.TURNSTILE_SECRET_KEY }),
    aiPerDay: num(env.AI_PER_DAY, 100),
    aiDailyTotal: num(env.AI_DAILY_TOTAL, 1000),
  };
}
