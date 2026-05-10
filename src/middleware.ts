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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes, static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

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
