import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { redisFromEnv } from './security.js';

/* ---------- shared data store ----------
   Owner accounts, shops, products, stock and shop orders live here, for both the online store and the register.
   Upstash Redis when it is connected (it lasts and every server sees the same data), otherwise JSON files under
   DATA_DIR, otherwise memory (tests). Every key gets the "twp:" prefix. Values are JSON. */

const P = 'twp:';

// "id" or "id|variant": the field a product (or one size/color of it) is counted under.
export const stockKey = (id, variant) => (variant ? `${id}|${variant}` : String(id));

// Same product twice in one sale becomes one line, so a count can't be checked twice.
function mergeLines(lines) {
  const m = new Map();
  for (const l of lines || []) {
    const qty = Math.floor(Number(l.qty));
    if (!l || !l.id || !(qty > 0)) continue;
    const k = stockKey(l.id, l.variant);
    const e = m.get(k) || { id: String(l.id), variant: l.variant || '', qty: 0, key: k };
    e.qty += qty;
    m.set(k, e);
  }
  return [...m.values()];
}

// Checks every line first and only then takes them all, so a sale never takes half its items.
const TAKE_LUA = `
local short = {}
for i = 1, #ARGV, 2 do
  local have = redis.call('HGET', KEYS[1], ARGV[i])
  if have and tonumber(have) < tonumber(ARGV[i + 1]) then
    table.insert(short, ARGV[i]); table.insert(short, have)
  end
end
if #short > 0 then return short end
for i = 1, #ARGV, 2 do
  if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 1 then redis.call('HINCRBY', KEYS[1], ARGV[i], -tonumber(ARGV[i + 1])) end
end
return short`;

function redisBackend({ url, token, fetchImpl = fetch }) {
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
  const one = async (cmd) => (await run([cmd]))[0];
  const parse = (s) => (s == null ? null : JSON.parse(s));
  return {
    durable: true,
    get: async (k) => parse(await one(['GET', P + k])),
    getMany: async (keys) => (keys.length ? (await one(['MGET', ...keys.map((k) => P + k)])).map(parse) : []),
    set: async (k, v, { ttlSec } = {}) => void (await one(['SET', P + k, JSON.stringify(v), ...(ttlSec ? ['EX', String(ttlSec)] : [])])),
    claim: async (k, v) => (await one(['SET', P + k, JSON.stringify(v), 'NX'])) === 'OK',
    del: async (k) => void (await one(['DEL', P + k])),
    // the next number in a sequence: order numbers start after `start`
    next: async (k, start = 0) => Number((await run([['SET', P + k, String(start), 'NX'], ['INCR', P + k]]))[1]),
    zadd: async (k, score, m) => void (await one(['ZADD', P + k, String(score), m])),
    zrem: async (k, m) => void (await one(['ZREM', P + k, m])),
    zrange: async (k, { limit = 500 } = {}) => one(['ZRANGE', P + k, '0', String(limit - 1), 'REV']),
    async takeStock(shopId, lines) {
      const L = mergeLines(lines);
      if (!L.length) return { ok: true };
      const out = await one(['EVAL', TAKE_LUA, '1', `${P}shop:${shopId}:stock`, ...L.flatMap((l) => [l.key, String(l.qty)])]);
      if (!out?.length) return { ok: true };
      const short = [];
      for (let i = 0; i < out.length; i += 2) {
        const l = L.find((x) => x.key === out[i]);
        short.push({ id: l.id, variant: l.variant, have: Math.max(0, Number(out[i + 1])), want: l.qty });
      }
      return { ok: false, short };
    },
    async putStock(shopId, lines) {
      const L = mergeLines(lines);
      if (!L.length) return;
      // only counts that exist go back up; an untracked item stays untracked
      const lua = `for i = 1, #ARGV, 2 do if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 1 then redis.call('HINCRBY', KEYS[1], ARGV[i], tonumber(ARGV[i + 1])) end end return 1`;
      await one(['EVAL', lua, '1', `${P}shop:${shopId}:stock`, ...L.flatMap((l) => [l.key, String(l.qty)])]);
    },
    async getStock(shopId) {
      const flat = (await one(['HGETALL', `${P}shop:${shopId}:stock`])) || [];
      const o = {};
      for (let i = 0; i < flat.length; i += 2) o[flat[i]] = Number(flat[i + 1]);
      return o;
    },
    async setStock(shopId, map) {
      const k = `${P}shop:${shopId}:stock`;
      const del = Object.keys(map).filter((f) => map[f] == null || map[f] === '');
      const put = Object.entries(map).filter(([, n]) => n != null && n !== '').flatMap(([f, n]) => [f, String(Math.max(0, Math.floor(Number(n)) || 0))]);
      const cmds = [];
      if (del.length) cmds.push(['HDEL', k, ...del]);
      if (put.length) cmds.push(['HSET', k, ...put]);
      if (cmds.length) await run(cmds);
    },
  };
}

// Memory, optionally saved to one JSON file per key. One server process at a time, so a simple queue keeps
// stock changes from overlapping.
function localBackend(dir) {
  const mem = new Map();
  const ready = dir ? mkdir(dir, { recursive: true }) : Promise.resolve();
  const file = (k) => path.join(dir, `${encodeURIComponent(k)}.json`);
  async function read(k) {
    if (mem.has(k)) return mem.get(k);
    if (!dir) return undefined;
    await ready;
    try {
      const v = JSON.parse(await readFile(file(k), 'utf8'));
      mem.set(k, v);
      return v;
    } catch {
      return undefined;
    }
  }
  async function write(k, v) {
    if (v === undefined) mem.delete(k);
    else mem.set(k, v);
    if (!dir) return;
    await ready;
    if (v === undefined) await rm(file(k), { force: true });
    else await writeFile(file(k), JSON.stringify(v));
  }
  let queue = Promise.resolve();
  const locked = (fn) => (queue = queue.then(fn, fn));
  const live = (e) => e && (!e.exp || e.exp > Date.now());
  const val = async (k) => {
    const e = await read(k);
    return live(e) ? e.v : null;
  };
  const stockOf = async (shopId) => (await val(`shop:${shopId}:stock`)) || {};
  return {
    durable: Boolean(dir) && !dir.startsWith('/tmp'),
    get: val,
    getMany: (keys) => Promise.all(keys.map(val)),
    set: (k, v, { ttlSec } = {}) => write(k, { v, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 }),
    claim: (k, v) => locked(async () => {
      if (live(await read(k))) return false;
      await write(k, { v, exp: 0 });
      return true;
    }),
    del: (k) => write(k, undefined),
    next: (k, start = 0) => locked(async () => {
      const n = ((await val(k)) ?? start) + 1;
      await write(k, { v: n, exp: 0 });
      return n;
    }),
    zadd: (k, score, m) => locked(async () => {
      const z = (await val(k)) || {};
      z[m] = Number(score);
      await write(k, { v: z, exp: 0 });
    }),
    zrem: (k, m) => locked(async () => {
      const z = (await val(k)) || {};
      delete z[m];
      await write(k, { v: z, exp: 0 });
    }),
    zrange: async (k, { limit = 500 } = {}) => Object.entries((await val(k)) || {}).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([m]) => m),
    takeStock: (shopId, lines) => locked(async () => {
      const L = mergeLines(lines);
      const s = await stockOf(shopId);
      const short = L.filter((l) => l.key in s && s[l.key] < l.qty).map((l) => ({ id: l.id, variant: l.variant, have: Math.max(0, s[l.key]), want: l.qty }));
      if (short.length) return { ok: false, short };
      for (const l of L) if (l.key in s) s[l.key] -= l.qty;
      await write(`shop:${shopId}:stock`, { v: s, exp: 0 });
      return { ok: true };
    }),
    putStock: (shopId, lines) => locked(async () => {
      const s = await stockOf(shopId);
      for (const l of mergeLines(lines)) if (l.key in s) s[l.key] += l.qty;
      await write(`shop:${shopId}:stock`, { v: s, exp: 0 });
    }),
    getStock: async (shopId) => ({ ...(await stockOf(shopId)) }),
    setStock: (shopId, map) => locked(async () => {
      const s = await stockOf(shopId);
      for (const [f, n] of Object.entries(map)) {
        if (n == null || n === '') delete s[f];
        else s[f] = Math.max(0, Math.floor(Number(n)) || 0);
      }
      await write(`shop:${shopId}:stock`, { v: s, exp: 0 });
    }),
  };
}

export function createDb({ redis = null, dir = null, fetchImpl } = {}) {
  return redis ? redisBackend({ ...redis, fetchImpl }) : localBackend(dir);
}

export function dbFromEnv(env, fallbackDir) {
  const redis = redisFromEnv(env);
  return redis ? createDb({ redis }) : createDb({ dir: path.join(env.DATA_DIR || fallbackDir, 'db') });
}
