import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Rol bazlı erişim kontrolü
    // Not: /tasks tüm kullanıcılara açık - sayfa içinde viewMode ile kişisel/departman filtreleme yapılıyor
    const roleRequirements: Record<string, string[]> = {
      '/settings': ['ADMIN', 'SUPER_ADMIN'],
      '/calibration': ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER'],
      '/fire-safety': ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER'],
    };

    // Path için gerekli roller var mı kontrol et
    for (const [protectedPath, allowedRoles] of Object.entries(roleRequirements)) {
      if (path.startsWith(protectedPath)) {
        if (!token?.role || !allowedRoles.includes(token.role as string)) {
          // Yetkisiz erişim - dashboard'a yönlendir
          return NextResponse.redirect(new URL('/dashboard?error=unauthorized', req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/calibration/:path*',
    '/tasks/:path*',
    '/fire-safety/:path*',
    '/settings/:path*',
    '/employees/:path*',
    '/departments/:path*',
    '/announcements/:path*',
    '/documents/:path*',
    '/leaves/:path*',
    '/attendance/:path*',
    '/helpdesk/:path*',
    '/meetings/:path*',
  ],
};
