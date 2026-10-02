// Vercel function: Devcon8 ID numbers.
//
//   GET  /api/id            -> { total }            how many IDs have been claimed
//   GET  /api/id?u=handle   -> { id | null, total }  look up a handle's number (never assigns)
//   POST /api/id  {u}       -> { id, isNew, total }  claim a number for a handle
//
// Every X handle gets ONE permanent number. Numbers go 1, 2, 3 … and are never
// reused. The founder handle (FOUNDER_HANDLE, default "noelaiyub") is always #1.
//
// Storage: Upstash Redis through the Vercel Marketplace. Connecting it to the
// project adds KV_REST_API_URL and KV_REST_API_TOKEN automatically
// (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN also work).

// Finds the Redis connection whatever prefix Vercel gave it (KV_, STORAGE_, UPSTASH_ …).
function findEnv(suffixes) {
  for (const suf of suffixes) {
    if (process.env[suf.replace(/^_/, "")]) return process.env[suf.replace(/^_/, "")];
    const key = Object.keys(process.env).find((k) => k.endsWith(suf) && !k.includes("READ_ONLY") && process.env[k]);
    if (key) return process.env[key];
  }
  return "";
}
const REDIS_URL = findEnv(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL", "_KV_REST_API_URL", "_REST_API_URL", "_REDIS_REST_URL"]);
const REDIS_TOKEN = findEnv(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN", "_KV_REST_API_TOKEN", "_REST_API_TOKEN", "_REDIS_REST_TOKEN"]);
const FOUNDER = (process.env.FOUNDER_HANDLE || "noelaiyub").toLowerCase();
const IDS = "devcon8:ids";          // hash: handle -> number
const COUNTER = "devcon8:counter";  // last number given out
const CLAIMS_PER_HOUR = 30;         // per IP, stops bots from burning numbers

const clean = (v) => String(v || "").replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15);

// One atomic step in Redis: seed the founder as #1, then return the handle's
// existing number or hand out the next one. Two people can never get the same number.
const CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 0 then
  redis.call('SET', KEYS[2], 1)
  redis.call('HSET', KEYS[1], ARGV[2], 1)
end
local existing = redis.call('HGET', KEYS[1], ARGV[1])
if existing then return {tonumber(existing), 0, tonumber(redis.call('GET', KEYS[2]))} end
local id = redis.call('INCR', KEYS[2])
redis.call('HSET', KEYS[1], ARGV[1], id)
return {id, 1, id}`;

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(command)
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || `Redis HTTP ${r.status}`);
  return data.result;
}

async function total() {
  const n = await redis(["GET", COUNTER]);
  return n ? Number(n) : 0;
}

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    send(res, 503, { error: "ID service is not set up yet (connect Upstash Redis in Vercel → Storage)." });
    return;
  }
  try {
    if (req.method === "GET") {
      const u = clean(req.query.u).toLowerCase();
      if (!u) { send(res, 200, { total: await total() }); return; }
      let id = await redis(["HGET", IDS, u]);
      if (!id && u === FOUNDER) id = 1;
      send(res, 200, { id: id ? Number(id) : null, total: await total() });
      return;
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
      const u = clean((body && body.u) || req.query.u).toLowerCase();
      if (!u) { send(res, 400, { error: "Missing X handle" }); return; }

      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const hour = Math.floor(Date.now() / 3600000);
      const rlKey = `devcon8:rl:${ip}:${hour}`;
      const count = await redis(["INCR", rlKey]);
      if (count === 1) await redis(["EXPIRE", rlKey, 3700]);
      if (count > CLAIMS_PER_HOUR) { send(res, 429, { error: "Too many IDs from this network. Try again in an hour." }); return; }

      const [id, isNew, last] = await redis(["EVAL", CLAIM_SCRIPT, "2", IDS, COUNTER, u, FOUNDER]);
      send(res, 200, { id: Number(id), isNew: Number(isNew) === 1, total: Number(last) });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    send(res, 500, { error: "ID service error. Please try again." });
  }
}
