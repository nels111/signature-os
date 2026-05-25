import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Constant-time string comparison to prevent timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// Mutating HTTP methods we require CSRF protection on.
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Hosts allowed to originate cookie-authenticated mutations. Anything else is
// rejected as a likely cross-site request. Populated from APP_URL and the
// canonical production hostnames.
function buildAllowedOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>();
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try { allowed.add(new URL(appUrl).origin); } catch {}
  }
  // Always allow the host the request came in on (covers preview deploys and
  // localhost in dev).
  const host = req.headers.get('host');
  if (host) {
    // Honour the original scheme behind a proxy; default to https in prod.
    const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '') || 'https';
    allowed.add(`${proto}://${host}`);
  }
  // Canonical hostnames for SigOS.
  ['https://os.signature-cleans.co.uk', 'https://signature-cleans.co.uk'].forEach((o) => allowed.add(o));
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3200');
    allowed.add('http://localhost:3000');
  }
  return allowed;
}

/**
 * Defence-in-depth CSRF check for cookie-authenticated state changes.
 *
 * NextAuth's session cookie is HttpOnly + SameSite=Lax which already blocks
 * the obvious form-based CSRF. This adds Origin/Referer validation so that:
 *   - Same-origin form posts that bypass SameSite still need a matching Origin
 *   - Embedded iframes and proxies that strip SameSite can't replay the cookie
 *   - Bearer-token (server-to-server) calls are exempt (no cookie involved)
 */
function checkCsrf(req: NextRequest): NextResponse | null {
  if (!UNSAFE_METHODS.has(req.method)) return null;

  // Bearer-token auth means the caller proved possession of the API key, so
  // the request can't be a confused-deputy cookie attack.
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return null;

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // No Origin and no Referer: refuse. Browsers always send at least one for
  // unsafe methods; only non-browser clients omit both, and those should use
  // a Bearer token.
  if (!origin && !referer) {
    return NextResponse.json({ error: 'Origin or Referer required' }, { status: 403 });
  }

  const allowed = buildAllowedOrigins(req);

  if (origin) {
    if (!allowed.has(origin)) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    return null;
  }

  // Origin missing (rare but happens), validate Referer's origin instead.
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!allowed.has(refOrigin)) {
        return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Malformed Referer' }, { status: 403 });
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes, static files, public quote tracking, and external webhooks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/quotes/track/') ||
    pathname.startsWith('/q/track/') ||
    // Twilio webhooks come from Twilio's servers (no Origin/session cookie)
    pathname.startsWith('/api/webhooks/twilio/')
  ) {
    return NextResponse.next();
  }

  // CSRF defence-in-depth for cookie-authenticated state changes.
  // Runs before any auth checks so cross-origin attempts get rejected even
  // if they include a valid session cookie.
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  // Strip any incoming x-api-auth header (prevent injection)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-api-auth');

  // API routes: check Bearer token or session cookie
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const apiKey = process.env.API_KEY;
      if (apiKey && safeEqual(token, apiKey)) {
        // API key valid -- set request header so route handlers can skip session check
        requestHeaders.set('x-api-auth', 'true');
        return NextResponse.next({
          request: { headers: requestHeaders },
        });
      }
    }

    // Session-based auth check for browser users
    const sessionToken = request.cookies.get('authjs.session-token')?.value
      || request.cookies.get('__Secure-authjs.session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Dashboard routes require session
  if (pathname.startsWith('/dashboard')) {
    const sessionToken = request.cookies.get('authjs.session-token')?.value
      || request.cookies.get('__Secure-authjs.session-token')?.value;

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
