/**
 * ELITE SHOPS - Secure Discord Order Relay (Cloudflare Worker)
 *
 * WHY IT EXISTS:
 *   The Discord webhook URL is a secret. If it sits in the public website
 *   code, anyone can copy it and post fake order messages to your Discord.
 *   This Worker hides the webhook: the website talks to this Worker, and
 *   ONLY this Worker holds the real webhook URL. The webhook never appears
 *   in your public site code again.
 *
 * SECURITY FEATURES:
 *   - Discord webhook URL is a SECRET (env binding), never in the client
 *   - Requires a shared secret token from the site (Authorization header)
 *   - Rate-limits each IP (one order per 10 seconds) to stop spam
 *   - Sanitizes / limits every field
 *   - Only allows POST (with preflight handling for CORS)
 *
 * HOW TO DEPLOY (5 min, free):
 *   1. Go to https://dash.cloudflare.com  ->  Workers & Pages  ->  Create
 *   2. Choose "Create Worker"  ->  name it e.g. "eliteshops-orders"
 *   3. Delete the default code, paste THIS whole file, click Save & Deploy
 *   4. In Settings -> Variables and Secrets -> add Secrets:
 *        DISCORD_WEBHOOK_URL = <paste your Discord webhook URL>
 *        ORDERS_SECRET       = <paste the token from js/main.js>
 *   5. After deploy, copy your Worker URL like:
 *        https://eliteshops-orders.<your-subdomain>.workers.dev/api/order
 *   6. Put that URL into js/main.js -> WORKER_URL
 *   7. Commit & push - orders now go through this proxy, webhook stays hidden
 */

const RATE_LIMIT_WINDOW = 10000; // ms
const rateMap = new Map();       // simple per-IP limiter

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    const WEBHOOK = env.DISCORD_WEBHOOK_URL; // secret
    const SECRET = env.ORDERS_SECRET;        // shared token with the website

    // Preflight (browser CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    // 1) Auth: shared secret
    const auth = request.headers.get('Authorization') || '';
    if (auth !== 'Bearer ' + SECRET) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    // 2) Rate limit per IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const last = rateMap.get(ip) || 0;
    if (now - last < RATE_LIMIT_WINDOW) {
      return json({ ok: false, error: 'Too many requests' }, 429);
    }
    rateMap.set(ip, now);
    if (rateMap.size > 1000) rateMap.clear();

    // 3) Parse + sanitize input
    let data;
    try {
      data = await request.json();
    } catch (e) {
      return json({ ok: false, error: 'Invalid JSON' }, 400);
    }

    const username = String((data.username || '').trim()).slice(0, 40);
    const product  = String((data.product  || '').trim()).slice(0, 80);
    const qty = Math.max(1, Math.min(99, parseInt(data.qty, 10) || 1));
    const total = Number(data.total) || 0;

    if (!username || !product) {
      return json({ ok: false, error: 'Missing fields' }, 400);
    }

    // 4) Forward to Discord (safe payload built server-side)
    const payload = {
      username: 'ELITE SHOPS Store',
      embeds: [{
        title: 'New purchase request',
        color: 11141290,
        fields: [
          { name: 'Customer', value: username, inline: true },
          { name: 'Product',  value: product,  inline: true },
          { name: 'Quantity', value: String(qty), inline: true },
          { name: 'Total',    value: '$' + total.toFixed(2), inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return json({ ok: false, error: 'Discord error ' + res.status }, 502);
    }
    return json({ ok: true }, 200);
  }
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS)
  });
}