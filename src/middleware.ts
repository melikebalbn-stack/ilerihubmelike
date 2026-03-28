import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Rol bazlı erişim kontrolü
    // Not: /tasks tüm kullanıcılara açık - sayfa içinde viewMode ile kişisel/departman filtreleme yapılıyor
    // Not: /calibration tüm kullanıcılara açık - yazma yetkileri API ve frontend'de kontrol ediliyor
    const roleRequirements: Record<string, string[]> = {
      '/settings': ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER'],
      '/fire-safety': ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER'],
      '/personnel': ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'],
    };

    // Path için gerekli roller var mı kontrol et
    for (const [protectedPath, allowedRoles] of Object.entries(roleRequirements)) {
      if (path.startsWith(protectedPath)) {
        const userRole = token?.role as string || '';
        const hasRole = allowedRoles.includes(userRole);

        // /settings için Kalite departmanı da erişebilir
        if (!hasRole && protectedPath === '/settings') {
          const dept = ((token?.department as string) || '').toLowerCase();
          const ou = ((token?.ou as string) || '').toLowerCase();
          const isKalite = dept.includes('kalite') || dept.includes('laboratuvar') ||
                           ou.includes('kalite') || ou.includes('laboratuvar');
          if (isKalite) {
            continue; // Kalite departmanı erişebilir
          }
        }

        // /personnel için İK departmanı da erişebilir
        if (!hasRole && protectedPath === '/personnel') {
          const dept = ((token?.department as string) || '').toLowerCase();
          const isHR = dept.includes('insan') || dept.includes('human') || dept.includes('hr') || dept.includes('ik');
          if (isHR) {
            continue;
          }
        }

        if (!hasRole) {
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
    '/personnel/:path*',
  ],
};
