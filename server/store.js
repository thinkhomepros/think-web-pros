import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// File-backed order store: one JSON file per order under DATA_DIR/orders.
// Good enough to run a pilot; swap for Postgres (or similar) before taking real volume.
export function createStore(dataDir) {
  const dir = path.join(dataDir, 'orders');
  const ready = mkdir(dir, { recursive: true });

  return {
    async saveOrder(record) {
      await ready;
      await writeFile(path.join(dir, `${record.id}.json`), JSON.stringify(record, null, 2));
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
        return JSON.parse(await readFile(path.join(dir, `${id}.json`), 'utf8'));
      } catch {
        return null;
      }
    },
  };
}
