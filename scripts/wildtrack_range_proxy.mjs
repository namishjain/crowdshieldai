import http from "node:http";
import { Readable } from "node:stream";

const cameras = new Map([
  ["camera_01", "1sGUnExmJM2_tFuBd9LNlexf0LN2m0_c-"],
  ["camera_02", "1OnaRN2qYhZ2n4rSaNZQJzQPd1Cl2fluk"],
  ["camera_03", "1I7ARLVVfZqdZTbYG_TPEfDt1Bc8N35Lb"],
  ["camera_04", "1sXn70X-bV_YGPv43r4-iMtK_Js09eUVB"],
  ["camera_05", "1ExTyezMWqmLefi2kJTQwYxZivJuag7G5"],
  ["camera_06", "1NM4kNjdyiC6JioOT90s9vFmMUkeSnV0z"],
]);
const port = Number(process.env.CROWD_PROXY_PORT || 8781);
const maxBytes = Number(process.env.CROWD_DATA_MAX_BYTES || 1_850_000_000);
// WILDTRACK's MP4 index is at EOF and the initial media segment must include
// enough bytes for a short excerpt. This is an explicit bounded range, not a
// whole-file GET; six such ranges remain below the aggregate 1.85 GB cap.
const maxRange = 64 * 1024 * 1024;
let transferred = 0;
const metadata = new Map();

async function sourceInfo(cameraId) {
  if (metadata.has(cameraId)) return metadata.get(cameraId);
  const id = cameras.get(cameraId);
  const warning = await fetch(`https://drive.google.com/uc?export=download&id=${id}`);
  if (!warning.ok) throw new Error(`Google Drive metadata failed for ${cameraId}: HTTP ${warning.status}`);
  const html = await warning.text();
  const uuid = html.match(/name="uuid"\s+value="([^"]+)"/)?.[1];
  if (!uuid) throw new Error(`Could not read the range-download token for ${cameraId}; source page changed.`);
  const url = new URL("https://drive.usercontent.google.com/download");
  for (const [key, value] of Object.entries({ id, export: "download", confirm: "t", uuid })) url.searchParams.set(key, value);
  const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
  if (probe.status !== 206) throw new Error(`Source ${cameraId} did not honor a one-byte range request (HTTP ${probe.status}).`);
  const contentRange = probe.headers.get("content-range") || "";
  const total = Number(contentRange.split("/")[1]);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error(`Source size unavailable for ${cameraId}.`);
  await probe.arrayBuffer();
  const info = { url, total };
  metadata.set(cameraId, info);
  return info;
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, transferred_bytes: transferred, limit_bytes: maxBytes }));
    return;
  }
  const cameraId = req.url?.split("?")[0].replace(/^\//, "").replace(/\.mp4$/, "");
  if (!cameraId || !cameras.has(cameraId)) {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("Unknown camera source"); return;
  }
  try {
    const { url, total } = await sourceInfo(cameraId);
    res.setHeader("accept-ranges", "bytes");
    res.setHeader("content-type", "video/mp4");
    res.setHeader("cache-control", "no-store");
    res.setHeader("content-length", String(total));
    if (req.method === "HEAD") { res.writeHead(200); res.end(); return; }
    if (req.method !== "GET") { res.writeHead(405); res.end(); return; }

    const header = req.headers.range || "bytes=0-";
    const match = header.match(/^bytes=(\d+)-(\d*)$/);
    if (!match) { res.writeHead(416, { "content-range": `bytes */${total}` }); res.end(); return; }
    const start = Number(match[1]);
    if (start >= total) { res.writeHead(416, { "content-range": `bytes */${total}` }); res.end(); return; }
    let end = match[2] ? Number(match[2]) : start + maxRange - 1;
    if (start === 0 && end - start + 1 < maxRange) end = start + maxRange - 1;
    end = Math.min(end, total - 1, start + maxRange - 1);
    const reserved = end - start + 1;
    if (transferred + reserved > maxBytes) {
      res.writeHead(429, { "content-type": "text/plain", "retry-after": "0" });
      res.end("The protected WILDTRACK transfer budget is exhausted; no full-source download is allowed.");
      return;
    }
    transferred += reserved;
    console.log(`[RANGE] ${cameraId}: bytes ${start}-${end} (${(reserved / 1_000_000).toFixed(1)} MB)`);
    const controller = new AbortController();
    res.on("close", () => { if (!res.writableEnded) controller.abort(); });
    const upstream = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal });
    if (upstream.status !== 206 || !upstream.body) {
      transferred -= reserved;
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`Upstream rejected byte range: HTTP ${upstream.status}`);
      return;
    }
    res.setHeader("content-range", `bytes ${start}-${end}/${total}`);
    res.setHeader("content-length", String(reserved));
    res.writeHead(206);
    await new Promise((resolve, reject) => {
      Readable.fromWeb(upstream.body).on("error", reject).pipe(res).on("finish", resolve).on("error", reject);
    });
  } catch (error) {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end(error instanceof Error ? error.message : "Range proxy failed");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[WILDTRACK] local byte-range proxy listening on 127.0.0.1:${port}; transfer cap ${maxBytes} bytes`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  console.log(`[WILDTRACK] total source bytes served: ${transferred}`);
  server.close(() => process.exit(0));
});
