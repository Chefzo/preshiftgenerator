import { NextRequest, NextResponse } from "next/server";

/**
 * HTTP Basic Auth gate for the dashboard and brief APIs.
 *
 * The brief exposes guest PII (names, allergies, spend, visit history) and bills
 * Claude on demand, so it must not be world-readable. When DASHBOARD_USER and
 * DASHBOARD_PASSWORD are set, every matched route requires those credentials.
 *
 * If they are NOT set, the gate stays open so an initial demo deploy keeps
 * working — but that means the app is public. Set the env vars in production.
 *
 * The cron route (/api/cron/*) is intentionally excluded here: it authenticates
 * with its own CRON_SECRET bearer token (Vercel Cron sends that, not Basic auth).
 */
export function middleware(req: NextRequest) {
  const user = process.env.DASHBOARD_USER?.trim();
  const password = process.env.DASHBOARD_PASSWORD?.trim();

  // Not configured → don't lock anyone out (documented as public).
  if (!user || !password) return NextResponse.next();

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    const decoded = decodeBase64(header.slice(6));
    const sep = decoded.indexOf(":");
    if (sep !== -1) {
      const u = decoded.slice(0, sep);
      const p = decoded.slice(sep + 1);
      if (timingSafeEqual(u, user) && timingSafeEqual(p, password)) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Pre-Shift Brief", charset="UTF-8"' },
  });
}

function decodeBase64(b64: string): string {
  // atob is available in the edge runtime; decode UTF-8 safely.
  try {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** Length-constant string compare to avoid leaking credentials via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  // Protect everything except the cron endpoint, Next internals, and favicon.
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
