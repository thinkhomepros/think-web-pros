# Think Web Pros Studio

Think Web Pros builds websites for small businesses. In the Studio, an owner designs their site, uploads or creates a logo, tweaks the style as much as they like, and then buys the site along with web services (hosting, domain, POS and more).

![Eight site styles](docs/screenshots/eight-styles.png)

## What's here

| Path | What it is |
| --- | --- |
| `web/` | The Studio front end: plain HTML, CSS and JavaScript, no build step. |
| `web/js/app.js` | The designer, plans and checkout, owner dashboard, and admin views. |
| `web/js/platform.js` | Connects the Studio to the server (AI logo maker and order submission). |
| `server/` | Node + Express server that serves the Studio and the API. |
| `test/` | Server tests (`npm test`). |

## Run it

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env   # optional, then fill in values
npm run dev            # http://localhost:3000
```

Set environment variables in your shell or host (the server doesn't read `.env` on its own; use `node --env-file=.env server/index.js` if you want it to):

- `ANTHROPIC_API_KEY` turns on the live AI logo maker. Without it, the logo maker uses its built-in quick ideas.
- `ADMIN_TOKEN` unlocks `GET /api/orders`. Without it, orders can be placed but not read over the API.
- `DATA_DIR` is where orders are saved (default `data/`).

Or with Docker:

```bash
docker build -t think-web-pros .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=... -e ADMIN_TOKEN=... -v twp-data:/app/data think-web-pros
```

## Host it on Vercel

`vercel.json` serves `web/` as static files and runs the API from `api/index.js` as a serverless function. In Vercel choose **Add New > Project**, import this repo, and deploy with the defaults. Add `ANTHROPIC_API_KEY` (optional) and `ADMIN_TOKEN` under **Settings > Environment Variables**, then redeploy. Every push to `main` redeploys.

Limits to know before taking real orders: orders are saved to the function's temporary disk, so they don't last, and Vercel caps request bodies at 4.5 MB, so orders with large uploaded photos are rejected (checkout still finishes in the browser). Move orders to a database and photos to file storage first.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Liveness check. |
| GET | `/api/config` | `{ ai: true/false }`, whether the live AI logo maker is on. |
| POST | `/api/ai/sample` | `{ prompt, json? }` → `{ text, json? }`. Rate limited per IP. The API key stays on the server. |
| POST | `/api/orders` | `{ order, design }` from checkout. Saved as JSON under `DATA_DIR/orders`. |
| GET | `/api/orders` | Admin list (`Authorization: Bearer <ADMIN_TOKEN>`). |
| GET | `/api/orders/:id` | One order with its full design. |

## Where things stand

The Studio started as a single-file prototype. It now runs as a real web app, but some parts are still demo-only:

- **Designs and the admin view live in the browser** (localStorage and IndexedDB). Orders are also sent to the server.
- **Checkout does not charge a card.** Next step: Stripe Checkout or Stripe Billing for the setup fee and monthly plan.
- **No accounts yet.** Next step: owner sign-in so designs sync across devices, and staff sign-in for the admin view.
- **Orders are stored as files.** Fine for a pilot; move to a database (e.g. Postgres) before real volume.
- **Address lookup** uses a free OpenStreetMap service with a demo fallback; production should use Google Places or Mapbox with a key.

## Screenshots

| Computer | Phone |
| --- | --- |
| ![Pages and toolbar](docs/screenshots/one-toolbar-pages-at-bottom.png) | ![Editing pane on a phone](docs/screenshots/bottom-editing-pane-phone.png) |
