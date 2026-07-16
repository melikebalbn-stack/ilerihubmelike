// Login kök-sebep fix: withAuth yerine getToken tabanlı custom middleware.
// Tüm redirect'ler forwarded host'tan (publicBase) kurulur — req.url'den DEĞİL;
// host sızıntısının (localhost:3000) kök sebebi buydu. nginx proxy_redirect yaması
// artık yalnızca EMNİYET KEMERİ — app doğru public host'u emit ediyor.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isInsanVarliklari } from '@/lib/auth/personnel-access';

function publicBase(req: NextRequest) {
  // nginx `Host $host` set ediyor → host header = public host (hub.ilerigroup.com).
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    // KRİTİK: public site https → __Secure- cookie'yi oku, yoksa oturumlu kullanıcı da login'e düşer.
    secureCookie: (process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
  });

  const path = req.nextUrl.pathname;

  // (a) Oturumsuz → /login (forwarded host'tan; callbackUrl relative path)
  if (!token) {
    const url = new URL('/login', publicBase(req));
    url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // (b) Oturumlu-ama-yetkisiz: rol/permission mantığı AYNEN korunur — yalnız redirect
  //     host'u publicBase(req)'e taşındı (req.url DEĞİL).
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
      const userRole = (token?.role as string) || '';
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
        if (isInsanVarliklari((token?.department as string) || '')) {
          continue;
        }
      }

      if (!hasRole) {
        // Yetkisiz erişim - dashboard'a yönlendir (host publicBase'den, req.url DEĞİL)
        return NextResponse.redirect(new URL('/dashboard?error=unauthorized', publicBase(req)));
      }
    }
  }

  return NextResponse.next();
}

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
