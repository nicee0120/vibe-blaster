// Admin only: /api/export?key=YOUR_ADMIN_KEY&day=2026-10-21
// Default day = yesterday (UTC), i.e. the day you pay out today.
const getRedis = require('./_redis.js');

module.exports = async (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.query.key !== key) return res.status(401).send('unauthorized');
  let redis;
  try { redis = getRedis(); } catch (e) { return res.status(500).send('Database not connected: ' + e.message); }
  const d = req.query.day || new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const flat = await redis.zrange('lb:' + d, 0, 19, { rev: true, withScores: true });
  const lines = ['rank,wallet,name,x,score,reward'];
  for (let i = 0; i < flat.length; i += 2) {
    const p = (await redis.hgetall('p:' + d + ':' + flat[i])) || {};
    const rank = i / 2 + 1;
    lines.push([rank, flat[i], p.name || '', '@' + (p.x || ''), flat[i + 1], rank <= 3 ? 'token + 0.1 Sepolia ETH' : 'token'].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.status(200).send(lines.join('\n'));
};
