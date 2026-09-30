// Vercel serverless function: GET /api/avatar?u=<x_handle>
// Fetches the public X profile picture server-side and returns it from your
// own domain, so the browser can draw and export it on the canvas.
// Responses are cached on Vercel's edge for a day, which also keeps you well
// under unavatar.io's free rate limit.

const clean = (v) => String(v || "").replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15);

async function tryImage(url) {
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "devcon8-id/1.0" } });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.startsWith("image/")) return null;
  return { type, buf: Buffer.from(await r.arrayBuffer()) };
}

async function fromFxTwitter(u) {
  const r = await fetch(`https://api.fxtwitter.com/${u}`, { headers: { "user-agent": "devcon8-id/1.0" } });
  if (!r.ok) return null;
  const data = await r.json();
  const url = data && data.user && data.user.avatar_url;
  if (!url) return null;
  return tryImage(url.replace("_normal.", "_400x400."));
}

export default async function handler(req, res) {
  const u = clean(req.query.u);
  if (!u) { res.status(400).json({ error: "Missing handle" }); return; }

  const sources = [
    () => tryImage(`https://unavatar.io/x/${u}?fallback=false`),
    () => tryImage(`https://unavatar.io/twitter/${u}?fallback=false`),
    () => fromFxTwitter(u)
  ];

  for (const source of sources) {
    try {
      const img = await source();
      if (img) {
        res.setHeader("Content-Type", img.type);
        res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).send(img.buf);
        return;
      }
    } catch (e) { /* try the next source */ }
  }

  res.setHeader("Cache-Control", "public, s-maxage=600");
  res.status(404).json({ error: "Profile picture not found" });
}
