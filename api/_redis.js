// Finds the Upstash/Vercel KV credentials whatever prefix Vercel gave them.
const { Redis } = require('@upstash/redis');

function config() {
  const e = process.env;
  let url = e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL;
  let token = e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN;
  if (!url || !token) {
    const k = Object.keys(e).find((n) => /(REST_API_URL|REDIS_REST_URL)$/.test(n));
    if (k) {
      url = e[k];
      token = e[k.replace(/URL$/, 'TOKEN')];
    }
  }
  return { url, token };
}

module.exports = function getRedis() {
  const { url, token } = config();
  if (!url || !token) throw new Error('Redis credentials not found in environment variables');
  return new Redis({ url, token });
};
