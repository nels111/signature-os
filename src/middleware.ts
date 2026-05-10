import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes, static files, and API auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // API key auth for Jaz (Bearer token)
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const apiKey = process.env.API_KEY;
      if (apiKey && token === apiKey) {
        // API key is valid -- skip session check, let route handle it
        // Set a header the route can check
        const response = NextResponse.next();
        response.headers.set('x-api-auth', 'true');
        return response;
      }
    }

    // Session-based auth check for browser users
    const sessionToken = request.cookies.get('authjs.session-token')?.value
      || request.cookies.get('__Secure-authjs.session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
  }

  // Dashboard routes require session
  if (pathname.startsWith('/dashboard')) {
    const sessionToken = request.cookies.get('authjs.session-token')?.value
      || request.cookies.get('__Secure-authjs.session-token')?.value;

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
