const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const MAX_SCORE = 100000;           // anything above this is rejected
const day = () => new Date().toISOString().slice(0, 10); // UTC day
const okW = (w) => /^0x[a-fA-F0-9]{40}$/.test(w);
const okX = (x) => /^[A-Za-z0-9_]{1,15}$/.test(x);

async function topRows(d) {
  const flat = await redis.zrange('lb:' + d, 0, 19, { rev: true, withScores: true });
  const rows = [];
  for (let i = 0; i < flat.length; i += 2) {
    const p = (await redis.hgetall('p:' + d + ':' + flat[i])) || {};
    rows.push({ name: p.name || '?', x: p.x || '', best: Number(flat[i + 1]) });
  }
  return rows; // wallets are NOT exposed publicly
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return res.status(200).json({ rows: await topRows(day()) });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
    const rl = 'rl:' + ip;
    const n = await redis.incr(rl);
    if (n === 1) await redis.expire(rl, 60);
    if (n > 12) return res.status(429).json({ error: 'slow down' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const name = String(b.name || '').replace(/[<>&"]/g, '').trim().slice(0, 14);
    const x = String(b.x || '').replace(/^@/, '');
    const wallet = String(b.wallet || '').toLowerCase();
    const score = Math.floor(Number(b.score));
    if (!name || !okX(x) || !okW(wallet) || !(score > 0 && score <= MAX_SCORE))
      return res.status(400).json({ error: 'invalid' });

    const d = day();
    await redis.zadd('lb:' + d, { gt: true }, { score, member: wallet }); // keeps the best score only
    await redis.hset('p:' + d + ':' + wallet, { name, x });
    await redis.expire('lb:' + d, 60 * 60 * 24 * 7);
    await redis.expire('p:' + d + ':' + wallet, 60 * 60 * 24 * 7);
    return res.status(200).json({ rows: await topRows(d) });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
