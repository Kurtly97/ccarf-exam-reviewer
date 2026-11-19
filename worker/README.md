# CCAR-F Ask Proxy (Cloudflare Worker)

Proxies "ask a follow-up" requests from the exam reviewer app to the Claude API,
so the Anthropic API key never reaches the browser. Gated by a shared passphrase,
with a per-day limit split out per name (name is free text, just used to divide
the quota — it isn't checked against any list).

## One-time setup

From this `worker/` directory:

```bash
npm install
npx wrangler login
```

Create the KV namespace used for rate-limit tracking:

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
```

Copy the `id` it prints into `wrangler.toml` under `[[kv_namespaces]]`, replacing
`REPLACE_WITH_KV_NAMESPACE_ID`.

Set your secrets (these are never written to any file or committed to git):

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ASK_PASSPHRASE
```

For `ASK_PASSPHRASE`, enter the single shared passphrase you'll give to everyone who
should have access. Matching is case-insensitive and ignores extra whitespace.

## Deploy

```bash
npx wrangler deploy
```

This prints your Worker's URL, e.g. `https://ccarf-ask-proxy.your-subdomain.workers.dev`.

Paste that URL into `ASK_WORKER_URL` near the top of `../app.jsx`.

## Lock down CORS (recommended once you know your GitHub Pages URL)

Edit `wrangler.toml` and set:

```toml
[vars]
ALLOWED_ORIGIN = "https://yourusername.github.io"
```

Then redeploy with `npx wrangler deploy`.

## Adjusting the daily limit

Edit `DAILY_LIMIT` in `wrangler.toml` (currently `30`) and redeploy.

## Local testing

```bash
npx wrangler dev
```

This runs the Worker on `http://localhost:8787`. Temporarily point `ASK_WORKER_URL`
in `app.jsx` at that address while testing, and set `ASK_WORKER_URL` back to the
deployed URL before publishing the frontend.
