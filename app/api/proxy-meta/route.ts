/**
 * GET /api/proxy-meta?url=<encodedUrl>
 *
 * Server-side proxy for token metadata JSON (IPFS, j7tracker, custom hosts).
 * Avoids CORS errors when fetching metadata URIs directly from the browser.
 * Returns only { image } from the metadata to keep responses tiny.
 *
 * Caches successful responses for 10 minutes via Cache-Control.
 */

import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS  = 5_000;
const ALLOWED_FIELDS = ["image", "name", "symbol", "description"] as const;

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  // Only allow http/https (no file://, data://, etc.)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json({ error: "protocol not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      signal:  AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }

    const json = await res.json();

    // Return only the safe fields we actually need
    const filtered: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (json[field] !== undefined) filtered[field] = json[field];
    }

    return NextResponse.json(filtered, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
