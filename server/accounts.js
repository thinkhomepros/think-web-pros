import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { rateLimit } from './security.js';

/* ---------- owner accounts ----------
   A business owner signs up with email and password and gets one shop. Logins last 30 days in an HttpOnly cookie
   (twp_session). A register device can send the same token as "Authorization: Bearer ...".
   Passwords are scrypt-hashed; sessions are stored by the SHA-256 of their token, so a leaked database can't log in. */

const scrypt = promisify(scryptCb);
export const SESSION_DAYS = 30;
const COOKIE = 'twp_session';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha = (s) => createHash('sha256').update(s).digest('hex');

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function checkPassword(pw, stored) {
  const [kind, salt, key] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const want = Buffer.from(key, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), want.length);
  return timingSafeEqual(want, got);
}

export function slugify(name) {
  return String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'shop';
}

function readCookie(req, name) {
  for (const part of String(req.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}
function sessionToken(req) {
  const bearer = (req.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  return bearer ? bearer[1] : readCookie(req, COOKIE);
}
function setCookie(req, res, token, maxAgeSec) {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
}

// What the owner's own browser may see about their shop (no secrets).
export function publicShop(s) {
  if (!s) return null;
  const { id, slug, name, email, createdAt, stripeAccount, chargesEnabled, taxRate, published, settings, active } = s;
  return { id, slug, name, email, createdAt, active: Boolean(active), payments: { connected: Boolean(stripeAccount), chargesEnabled: Boolean(chargesEnabled) }, taxRate: taxRate || 0, published: published || null, settings: settings || {} };
}

export async function startSession(db, { userId, shopId }) {
  const token = randomBytes(32).toString('base64url');
  await db.set(`session:${sha(token)}`, { userId, shopId, at: Date.now() }, { ttlSec: SESSION_DAYS * 86_400 });
  return token;
}

// Finds the signed-in owner. Sets req.user = { id, email, role:'owner' } and req.shop (the full shop record).
export async function loadOwner(db, req) {
  const token = sessionToken(req);
  if (!token || token.length > 200) return null;
  const s = await db.get(`session:${sha(token)}`);
  if (!s) return null;
  const [user, shop] = await db.getMany([`user:${s.userId}`, `shop:${s.shopId}`]);
  if (!user || !shop) return null;
  return { user: { id: user.id, email: user.email, name: user.name || '', role: 'owner' }, shop, token };
}

export function ownerAuth(db) {
  return async (req, res, next) => {
    try {
      const who = await loadOwner(db, req);
      if (!who) return res.status(401).json({ code: 'signed_out', error: 'Please sign in again.' });
      req.user = who.user;
      req.shop = who.shop;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Gives a new shop a web address that isn't taken: harbor-pine, then harbor-pine-2, ...
async function claimSlug(db, name, shopId) {
  const base = slugify(name);
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (await db.claim(`shop-slug:${slug}`, shopId)) return slug;
  }
  const slug = `${base}-${randomBytes(3).toString('hex')}`;
  await db.claim(`shop-slug:${slug}`, shopId);
  return slug;
}

export function addAccountRoutes(app, { db, counter, humanOnly = (req, res, next) => next() }) {
  const signupLimit = rateLimit(counter, 'signup', [{ windowSec: 3600, max: 5 }, { windowSec: 86_400, max: 20 }], 'Too many new accounts from here. Please try again later.');
  const loginLimit = rateLimit(counter, 'login', [{ windowSec: 900, max: 20 }], 'Too many sign-in attempts. Please wait 15 minutes.');

  app.post('/api/account/signup', signupLimit, humanOnly, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const business = String(req.body?.business || '').trim().slice(0, 80);
    if (!EMAIL.test(email) || email.length > 254) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
    if (!business) return res.status(400).json({ error: 'Please enter your business name.' });
    const userId = randomUUID();
    const shopId = randomUUID();
    if (!(await db.claim(`user-email:${email}`, userId))) return res.status(409).json({ code: 'taken', error: 'There’s already an account with that email. Try signing in.' });
    const now = new Date().toISOString();
    const slug = await claimSlug(db, business, shopId);
    await db.set(`user:${userId}`, { id: userId, email, name: String(req.body?.name || '').trim().slice(0, 80), password: await hashPassword(password), shopId, createdAt: now });
    const shop = { id: shopId, slug, name: business, ownerId: userId, email, createdAt: now, taxRate: 0, settings: {} };
    await db.set(`shop:${shopId}`, shop);
    await db.zadd('shops', Date.now(), shopId);
    const token = await startSession(db, { userId, shopId });
    setCookie(req, res, token, SESSION_DAYS * 86_400);
    res.status(201).json({ user: { id: userId, email }, shop: publicShop(shop), token });
  });

  app.post('/api/account/login', loginLimit, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    // 8 wrong passwords for one email locks it for 15 minutes, wherever they come from
    const failKey = `login-fail:${sha(email)}`;
    if ((await counter(failKey, 900, 0)) >= 8) return res.status(429).json({ error: 'Too many wrong passwords for this account. Try again in 15 minutes.' });
    const userId = EMAIL.test(email) ? await db.get(`user-email:${email}`) : null;
    const user = userId ? await db.get(`user:${userId}`) : null;
    const ok = user ? await checkPassword(password, user.password) : (await hashPassword('timing'), false);
    if (!ok) {
      await counter(failKey, 900);
      return res.status(401).json({ error: 'That email and password don’t match.' });
    }
    const token = await startSession(db, { userId: user.id, shopId: user.shopId });
    setCookie(req, res, token, SESSION_DAYS * 86_400);
    const shop = await db.get(`shop:${user.shopId}`);
    res.json({ user: { id: user.id, email: user.email }, shop: publicShop(shop), token });
  });

  app.post('/api/account/logout', async (req, res) => {
    const token = sessionToken(req);
    if (token && token.length <= 200) await db.del(`session:${sha(token)}`);
    setCookie(req, res, '', 0);
    res.json({ ok: true });
  });

  app.get('/api/account/me', async (req, res) => {
    const who = await loadOwner(db, req);
    if (!who) return res.status(401).json({ code: 'signed_out', error: 'Not signed in.' });
    res.json({ user: who.user, shop: publicShop(who.shop) });
  });
}
