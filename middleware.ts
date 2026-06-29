import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin trying to access driver dashboard → redirect to admin
    if (pathname.startsWith('/dashboard') && token?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    // Driver trying to access admin → redirect to dashboard
    if (pathname.startsWith('/admin') && token?.role === 'driver') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;
        // Public routes
        if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname === '/api/drivers/names') return true;
        // All other routes require a token
        return !!token;
      },
    },
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
  ],
};
