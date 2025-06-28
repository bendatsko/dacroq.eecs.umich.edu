import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ALLOWED_USERS } from '@/config/allowed-users';

// Constants for configuration
const MAX_REDIRECTS = 3;
const REDIRECT_COUNT_HEADER = 'x-redirect-count';

export function middleware(request: NextRequest) {
  try {
    // Track redirect count to prevent infinite loops
    const currentRedirectCount = parseInt(request.headers.get(REDIRECT_COUNT_HEADER) || '0');
    if (currentRedirectCount >= MAX_REDIRECTS) {
      console.error('Maximum redirect count exceeded');
      return new NextResponse('Too many redirects', { status: 500 });
    }

    // Protocol enforcement layer
    if (!request.url.startsWith('http') && process.env.NODE_ENV === 'production') {
      const response = NextResponse.redirect(
        `http://${request.headers.get('host')}${request.nextUrl.pathname}${request.nextUrl.search}`,
        301
      );
      response.headers.set(REDIRECT_COUNT_HEADER, (currentRedirectCount + 1).toString());
      return response;
    }

    // Route classification and validation
    const isPublicPath =
      request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/api/auth') ||
      request.nextUrl.pathname.startsWith('/demo');

    const isDashboardWithDemoSession =
      request.nextUrl.pathname.startsWith('/dashboard') &&
      request.cookies.get('session')?.value &&
      isDemoSessionValid(request.cookies.get('session')?.value);

    if (isPublicPath || isDashboardWithDemoSession) {
      return NextResponse.next();
    }

    // Session validation layer
    const session = request.cookies.get('session');
    if (!session) {
      return createRedirectResponse(request, '/login', currentRedirectCount);
    }

    try {
      const sessionData = parseAndValidateSession(session.value);
      
      // Temporal validation
      if (sessionData.exp < Math.floor(Date.now() / 1000)) {
        return createRedirectResponse(request, '/login', currentRedirectCount);
      }

      // Authorization validation for non-demo sessions
      if (!isDemoSession(sessionData)) {
        const isAllowed = ALLOWED_USERS.some(user => user.email === sessionData.email);
        if (!isAllowed) {
          return createRedirectResponse(request, '/login', currentRedirectCount);
        }
      }

      return NextResponse.next();
    } catch (error) {
      console.error('Session validation error:', error);
      return createRedirectResponse(request, '/login', currentRedirectCount);
    }
  } catch (error) {
    console.error('Middleware error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

/**
 * Helper Functions
 */

function createRedirectResponse(request: NextRequest, path: string, currentRedirectCount: number): NextResponse {
  const redirectUrl = new URL(path, request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set(REDIRECT_COUNT_HEADER, (currentRedirectCount + 1).toString());
  return response;
}

function parseAndValidateSession(sessionValue: string): any {
  try {
    const sessionData = JSON.parse(Buffer.from(sessionValue, 'base64').toString());
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('Invalid session data format');
    }
    if (!sessionData.exp || typeof sessionData.exp !== 'number') {
      throw new Error('Missing or invalid expiration time');
    }
    if (!sessionData.email || typeof sessionData.email !== 'string') {
      throw new Error('Missing or invalid email');
    }
    return sessionData;
  } catch (error) {
    throw new Error(`Session parsing failed: ${error.message}`);
  }
}

function isDemoSession(sessionData: any): boolean {
  return sessionData.email === 'demo@umich.edu';
}

function isDemoSessionValid(sessionValue: string): boolean {
  try {
    const sessionData = parseAndValidateSession(sessionValue);
    return isDemoSession(sessionData) && sessionData.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// Configure which routes should be processed by this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};