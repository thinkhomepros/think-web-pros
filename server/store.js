import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// File-backed order store: one JSON file per order under DATA_DIR/orders.
// Fine on a computer or a server with a disk. On Vercel only /tmp is writable and it is wiped often, so use createRedisStore there.
export function createStore(dataDir) {
  const dir = path.join(dataDir, 'orders');
  const ready = mkdir(dir, { recursive: true });
  const file = (id) => path.join(dir, `${id}.json`);

  const store = {
    durable: !dataDir.startsWith('/tmp'),
    async saveOrder(record) {
      await ready;
      await writeFile(file(record.id), JSON.stringify(record, null, 2));
      return record;
    },
    async listOrders() {
      await ready;
      const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
      const orders = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))));
      return orders.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    },
    async getOrder(id) {
      await ready;
      try {
        return JSON.parse(await readFile(file(id), 'utf8'));
      } catch {
        return null;
      }
    },
    async updateOrder(id, change) {
      const record = await store.getOrder(id);
      if (!record) return null;
      return store.saveOrder(change(record) || record);
    },
  };
  return store;
}

// Redis over HTTPS (Upstash, which Vercel offers under Storage). Orders survive restarts and every server sees the same ones.
// Designs are kept under their own key because they carry photos and can be large.
export function createRedisStore({ url, token, fetchImpl = fetch }) {
  const base = url.replace(/\/$/, '');
  async function run(commands) {
    const res = await fetchImpl(`${base}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Redis request failed (${res.status})`);
    const out = await res.json();
    const failed = out.find((r) => r.error);
    if (failed) throw new Error(`Redis: ${failed.error}`);
    return out.map((r) => r.result);
  }
  const parse = (s) => (s ? JSON.parse(s) : null);

  const store = {
    durable: true,
    async saveOrder(record) {
      const { design, ...summary } = record;
      const cmds = [
        ['SET', `order:${record.id}`, JSON.stringify(summary)],
        ['ZADD', 'orders', String(Date.parse(record.receivedAt) || Date.now()), record.id],
      ];
      await run(cmds);
      if (design !== undefined) {
        // a very large design shouldn't lose the order; keep the order and note the design didn't fit
        try {
          await run([['SET', `design:${record.id}`, JSON.stringify(design)]]);
        } catch (err) {
          console.error('Design not stored:', err.message);
          await run([['SET', `order:${record.id}`, JSON.stringify({ ...summary, designNotStored: true })]]);
        }
      }
      return record;
    },
    async listOrders() {
      const [ids] = await run([['ZRANGE', 'orders', '0', '499', 'REV']]);
      if (!ids?.length) return [];
      const [values] = await run([['MGET', ...ids.map((id) => `order:${id}`)]]);
      return values.map(parse).filter(Boolean);
    },
    async getOrder(id) {
      const [order, design] = await run([['GET', `order:${id}`], ['GET', `design:${id}`]]);
      const record = parse(order);
      return record && { ...record, design: parse(design) };
    },
    async updateOrder(id, change) {
      const [order] = await run([['GET', `order:${id}`]]);
      const record = parse(order);
      if (!record) return null;
      const next = change(record) || record;
      await run([['SET', `order:${id}`, JSON.stringify(next)]]);
      return next;
    },
  };
  return store;
}

// Picks Redis when its keys are set (Vercel's Upstash integration adds KV_REST_API_* or UPSTASH_REDIS_REST_*), otherwise files.
export function storeFromEnv(env, fallbackDir) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (url && token) return createRedisStore({ url, token });
  return createStore(env.DATA_DIR || fallbackDir);
}
