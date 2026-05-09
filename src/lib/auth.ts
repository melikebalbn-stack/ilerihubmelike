import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authenticateUser, determineUserRole, getEmailFromDN } from '@/lib/ldap';
import { prisma } from '@/lib/prisma';
import { UserRoleEnum as Role, LoginStatus } from '@/generated/prisma';
import { inferRoleFromJobTitle, extractGroupCNs } from '@/lib/ldap-sync';
import { checkRateLimit, resetRateLimit, getRateLimitKey } from '@/lib/rate-limit';

// Login log fonksiyonu
async function logLogin(data: {
  email: string;
  username?: string;
  name?: string;
  department?: string;
  role?: string;
  status: LoginStatus;
  errorMessage?: string;
}) {
  try {
    await prisma.loginLog.create({
      data: {
        email: data.email,
        username: data.username,
        name: data.name,
        department: data.department,
        role: data.role,
        status: data.status,
        errorMessage: data.errorMessage,
      }
    });
  } catch (error) {
    console.error('Login log kaydedilemedi:', error);
  }
}

// Email-bazlı rol override'ları — LDAP'tan gelen role'u ezer.
// Kayıt sıralaması: en yüksek yetkiliden aşağıya.
const ROLE_OVERRIDES: Record<string, Role> = {
  // SUPER_ADMIN — üst yönetim + sistem sahibi
  'halit.ileri@ilerigroup.com': Role.SUPER_ADMIN,
  'gurhan.horbay@ilerigroup.com': Role.SUPER_ADMIN,
  'koray.ileri@ilerigroup.com': Role.SUPER_ADMIN,
  'melike.balaban@ilerigroup.com': Role.SUPER_ADMIN,
  'melih.dilben@ilerigroup.com': Role.SUPER_ADMIN,
  // ADMIN — operasyonel yönetim
  'hilmi.ileri@ilerigroup.com': Role.ADMIN,
  'eren.ileri@ilerigroup.com': Role.ADMIN,
  'kadir.kocakoglu@ilerigroup.com': Role.ADMIN,
  // QUALITY_MANAGER
  'sami.tekoglu@ilerigroup.com': Role.QUALITY_MANAGER,
};

// Geriye uyumluluk: bazı eski kod yolları SUPER_ADMIN_EMAILS array'i bekliyor
const SUPER_ADMIN_EMAILS = Object.entries(ROLE_OVERRIDES)
  .filter(([, role]) => role === Role.SUPER_ADMIN)
  .map(([email]) => email);

// LDAP rolünü Prisma Role enum'una dönüştür
function mapLdapRoleToPrismaRole(ldapRole: string, email?: string): Role {
  // Email-bazlı override (SUPER_ADMIN/ADMIN/QUALITY_MANAGER vs.)
  if (email && ROLE_OVERRIDES[email.toLowerCase()]) {
    return ROLE_OVERRIDES[email.toLowerCase()];
  }

  const roleMap: Record<string, Role> = {
    'SUPER_ADMIN': Role.SUPER_ADMIN,
    'ADMIN': Role.ADMIN,
    'HR_MANAGER': Role.HR_MANAGER,
    'QUALITY_MANAGER': Role.QUALITY_MANAGER,
    'IT_MANAGER': Role.IT_MANAGER,
    'DEPT_HEAD': Role.DEPT_HEAD,
    'SUPERVISOR': Role.SUPERVISOR,
    'EMPLOYEE': Role.EMPLOYEE,
    'USER': Role.EMPLOYEE, // USER -> EMPLOYEE mapping
  };
  return roleMap[ldapRole] || Role.EMPLOYEE;
}

// NextAuth için tip genişletmeleri
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      username: string;
      role: string;
      department: string | null;
      title: string | null;
      distinguishedName: string;
      ou: string | null;
      managerDN: string | null;
      managerEmail: string | null;
      /** PR-Y2: Aktif rollerden gelen permission key'leri (login + token refresh'te yüklenir) */
      permissions?: string[];
    };
  }
  interface User {
    id: string;
    username: string;
    role: string;
    department: string | null;
    title: string | null;
    distinguishedName: string;
    ou: string | null;
    managerDN: string | null;
    managerEmail: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username: string;
    role: string;
    department: string | null;
    title: string | null;
    distinguishedName: string;
    ou: string | null;
    managerDN: string | null;
    managerEmail: string | null;
    /** PR-Y2.1: gerçek User.id (cuid). LDAP DN değil — permission lookup'ları bunu kullanır. */
    id?: string;
    /** PR-Y2.1: Provider'ın orijinal kimliği (LDAP DN, AD sub vs.) — audit/debug için. */
    providerSub?: string | null;
    /** PR-Y2: yetki yükleme cache'i (5 dakikada bir yenilenir) */
    permissions?: string[];
    permissionsLoadedAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Blue-collar login (Sicil No + TC Son 4 Hane)
    CredentialsProvider({
      id: 'bluecollar',
      name: 'Mavi Yaka Girişi',
      credentials: {
        employeeId: { label: 'Sicil No', type: 'text', placeholder: '12345' },
        tcLastFour: { label: 'TC Son 4 Hane', type: 'text', placeholder: '1234' },
      },
      async authorize(credentials, req) {
        if (!credentials?.employeeId || !credentials?.tcLastFour) {
          throw new Error('Sicil numarası ve TC son 4 hane gerekli');
        }

        // TC son 4 hane doğrulama - sadece 4 rakam
        if (!/^\d{4}$/.test(credentials.tcLastFour)) {
          throw new Error('TC son 4 hane 4 rakamdan oluşmalıdır');
        }

        // Rate limiting kontrolü
        const forwardedFor = req?.headers?.['x-forwarded-for'];
        const ip = typeof forwardedFor === 'string'
          ? forwardedFor.split(',')[0].trim()
          : 'unknown';

        const rateLimitKey = getRateLimitKey(ip, `bc_${credentials.employeeId}`);
        const rateLimitResult = checkRateLimit(rateLimitKey, {
          windowMs: 15 * 60 * 1000,  // 15 dakika
          maxAttempts: 5,  // 5 başarısız deneme
        });

        if (!rateLimitResult.success) {
          await logLogin({
            email: `bluecollar_${credentials.employeeId}@ilerigroup.com`,
            username: credentials.employeeId,
            status: LoginStatus.FAILED,
            errorMessage: `Rate limit aşıldı. ${rateLimitResult.resetIn} saniye bekleyin.`,
          });
          throw new Error(`Çok fazla başarısız deneme. ${Math.ceil(rateLimitResult.resetIn / 60)} dakika sonra tekrar deneyin.`);
        }

        try {
          // Veritabanında kullanıcıyı bul
          const user = await prisma.user.findUnique({
            where: { employeeId: credentials.employeeId },
          });

          if (!user) {
            await logLogin({
              email: `bluecollar_${credentials.employeeId}@ilerigroup.com`,
              username: credentials.employeeId,
              status: LoginStatus.FAILED,
              errorMessage: 'Sicil numarası bulunamadı',
            });
            throw new Error('Sicil numarası bulunamadı');
          }

          // TC son 4 hane kontrolü
          if (!user.tcLastFour || user.tcLastFour !== credentials.tcLastFour) {
            await logLogin({
              email: user.email,
              username: credentials.employeeId,
              status: LoginStatus.FAILED,
              errorMessage: 'TC son 4 hane eşleşmiyor',
            });
            throw new Error('TC son 4 hane hatalı');
          }

          // Aktif kullanıcı kontrolü
          if (!user.isActive) {
            await logLogin({
              email: user.email,
              username: credentials.employeeId,
              status: LoginStatus.FAILED,
              errorMessage: 'Kullanıcı hesabı aktif değil',
            });
            throw new Error('Kullanıcı hesabı aktif değil');
          }

          // Başarılı login - rate limit sayacını sıfırla
          resetRateLimit(rateLimitKey);

          // Başarılı login'i logla
          await logLogin({
            email: user.email,
            username: credentials.employeeId,
            name: user.name ?? undefined,
            department: user.department ?? undefined,
            role: user.role,
            status: LoginStatus.SUCCESS,
          });

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            username: credentials.employeeId,
            role: user.role,
            department: user.department,
            title: user.jobTitle,
            distinguishedName: `employeeId=${credentials.employeeId}`,
            ou: null,
            managerDN: null,
            managerEmail: null,
          };
        } catch (error) {
          if (error instanceof Error && error.message !== 'Sicil numarası bulunamadı' &&
              error.message !== 'TC son 4 hane hatalı' &&
              error.message !== 'Kullanıcı hesabı aktif değil') {
            await logLogin({
              email: `bluecollar_${credentials.employeeId}@ilerigroup.com`,
              username: credentials.employeeId,
              status: LoginStatus.FAILED,
              errorMessage: error.message,
            });
          }
          throw error;
        }
      },
    }),
    // LDAP login (Active Directory)
    CredentialsProvider({
      id: 'ldap',
      name: 'ILERI Active Directory',
      credentials: {
        username: { label: 'Kullanıcı Adı', type: 'text', placeholder: 'ornek.kullanici' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Kullanıcı adı ve şifre gerekli');
        }

        // Rate limiting kontrolü - Brute force koruması
        // IP adresi headers'dan alınıyor (nginx proxy arkasında)
        const forwardedFor = req?.headers?.['x-forwarded-for'];
        const ip = typeof forwardedFor === 'string'
          ? forwardedFor.split(',')[0].trim()
          : 'unknown';

        const rateLimitKey = getRateLimitKey(ip, credentials.username);
        const rateLimitResult = checkRateLimit(rateLimitKey, {
          windowMs: 15 * 60 * 1000,  // 15 dakika
          maxAttempts: 5,  // 5 başarısız deneme
        });

        if (!rateLimitResult.success) {
          // Rate limit log
          await logLogin({
            email: `${credentials.username}@ilerigroup.com`,
            username: credentials.username,
            status: LoginStatus.FAILED,
            errorMessage: `Rate limit aşıldı. ${rateLimitResult.resetIn} saniye bekleyin.`,
          });
          throw new Error(`Çok fazla başarısız deneme. ${Math.ceil(rateLimitResult.resetIn / 60)} dakika sonra tekrar deneyin.`);
        }

        try {
          // LDAP ile kimlik doğrulama
          const ldapUser = await authenticateUser(
            credentials.username,
            credentials.password
          );

          if (!ldapUser) {
            throw new Error('Geçersiz kullanıcı adı veya şifre');
          }

          // Kullanıcı rolünü belirle
          const role = determineUserRole(ldapUser);

          // FIX #17: Production'da hassas LDAP bilgilerini loglama
          if (process.env.NODE_ENV !== 'production') {
            console.log('[AUTH] LDAP login:', {
              username: ldapUser.username,
              role: role,
            });
          }

          // Manager email'ini al
          let managerEmail: string | null = null;
          if (ldapUser.managerDN) {
            managerEmail = await getEmailFromDN(ldapUser.managerDN);
          }

          // NextAuth user objesi döndür
          // Email fallback: LDAP'tan email gelmezse username@domain kullan
          // Not: ldapUser.email zaten string | null olarak geliyor (ldap.ts'de getStringValue ile)
          // PR-EMAIL-NORMALIZE: DB email lowercase invariant — LDAP'tan gelen casing'i normalize et
          const userEmail = (
            (typeof ldapUser.email === 'string' ? ldapUser.email.trim() : null) ||
            `${ldapUser.username}@ilerigroup.com`
          ).toLowerCase();

          // Kullanıcıyı veritabanına kaydet veya güncelle (upsert)
          const baseRole = mapLdapRoleToPrismaRole(role, userEmail);
          const prismaRole = inferRoleFromJobTitle(ldapUser.title, baseRole);

          // FIX #16: DB hata yönetimi - retry mekanizması ve hata izleme
          const maxRetries = 3;
          let dbSyncSuccess = false;
          let lastDbError: unknown = null;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // PR-Y4-PRE: AD grup CN listesi
              const groups = extractGroupCNs(ldapUser.memberOf);
              await prisma.user.upsert({
                where: { email: userEmail },
                update: {
                  name: ldapUser.displayName,
                  department: ldapUser.department,
                  jobTitle: ldapUser.title,
                  role: prismaRole,
                  isActive: true,
                  groups,
                },
                create: {
                  id: `ad_${ldapUser.username}`,
                  email: userEmail,
                  name: ldapUser.displayName,
                  department: ldapUser.department,
                  jobTitle: ldapUser.title,
                  role: prismaRole,
                  isActive: true,
                  groups,
                },
              });
              dbSyncSuccess = true;
              break;
            } catch (dbError) {
              lastDbError = dbError;
              if (attempt < maxRetries) {
                // Exponential backoff: 100ms, 200ms, 400ms
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
              }
            }
          }

          if (!dbSyncSuccess) {
            // Tüm retry'lar başarısız - detaylı log ve hata izleme
            console.error('[AUTH] DB sync failed after retries:', {
              email: userEmail,
              username: ldapUser.username,
              error: lastDbError instanceof Error ? lastDbError.message : String(lastDbError),
              timestamp: new Date().toISOString(),
            });
            // Login devam eder ama kullanıcı DB'de olmayabilir
            // İleride bir background job ile sync edilebilir
          }

          // Üst yönetim için session role'ünü de SUPER_ADMIN yap
          const sessionRole = SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase()) ? 'SUPER_ADMIN' : role;

          // Başarılı login - rate limit sayacını sıfırla
          resetRateLimit(rateLimitKey);

          // Başarılı login'i logla
          await logLogin({
            email: userEmail,
            username: ldapUser.username ?? undefined,
            name: ldapUser.displayName ?? undefined,
            department: ldapUser.department ?? undefined,
            role: sessionRole,
            status: LoginStatus.SUCCESS,
          });

          return {
            id: ldapUser.distinguishedName,
            name: ldapUser.displayName,
            email: userEmail,
            username: ldapUser.username,
            role: sessionRole,
            department: ldapUser.department,
            title: ldapUser.title,
            distinguishedName: ldapUser.distinguishedName,
            ou: ldapUser.ou,
            managerDN: ldapUser.managerDN,
            managerEmail: managerEmail,
          };
        } catch (error) {
          // Başarısız login'i logla
          const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
          await logLogin({
            email: credentials?.username ? `${credentials.username}@ilerigroup.com` : 'unknown',
            username: credentials?.username,
            status: LoginStatus.FAILED,
            errorMessage: errorMsg,
          });

          console.error('Kimlik doğrulama hatası:', error);
          throw new Error('Giriş yapılırken bir hata oluştu');
        }
      },
    }),
  ],
  callbacks: {
    // Open Redirect koruması - sadece kendi domain'imize yönlendirmelere izin ver
    async redirect({ url, baseUrl }) {
      // Relative URL'ler güvenli
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Aynı origin'deki URL'ler güvenli
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        if (urlObj.origin === baseUrlObj.origin) {
          return url;
        }
      } catch {
        // Invalid URL, baseUrl'e dön
      }
      // Diğer tüm durumlar - ana sayfaya yönlendir
      return baseUrl;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.username = user.username;
        token.role = user.role;
        token.department = user.department;
        token.title = user.title;
        token.distinguishedName = user.distinguishedName;
        token.ou = user.ou;
        token.managerDN = user.managerDN;
        token.managerEmail = user.managerEmail;
        // Email'i de token'a kaydet
        if (user.email) {
          token.email = user.email;
        }

        // PR-Y2.1: Gerçek User.id (cuid) çözümle.
        // LDAP provider `user.id` olarak DN döndürüyor (`ad_*` create path'i hariç),
        // ama user_role.user_id DB'de cuid formatında. Login'de email ile DB'den çek.
        // Bluecollar provider zaten cuid döndürüyor (User.id'den alıyor).
        token.providerSub = user.id ?? null;
        if (user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email.toLowerCase() },
              select: { id: true },
            });
            if (dbUser) {
              token.id = dbUser.id;
            } else {
              token.id = user.id;
              console.warn('[auth.jwt] User email DB\'de bulunamadı:', user.email);
            }
          } catch (err) {
            console.error('[auth.jwt] DB lookup hatası:', err);
            token.id = user.id;
          }
        } else {
          token.id = user.id;
        }
      }

      // PR-Y2.1: Eski JWT'leri sessizce düzelt — token.id yoksa email ile DB'den çek.
      // Login path'i yukarıda hallediyor; bu blok refresh path'i için (eski cookie'ler).
      // token.sub DN olabileceği için cuid değil; doğru kimlik için email lookup zorunlu.
      if (!token.id && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: (token.email as string).toLowerCase() },
            select: { id: true },
          });
          if (dbUser) {
            token.providerSub = (token.sub as string | undefined) ?? token.providerSub ?? null;
            token.id = dbUser.id;
            // Cache'i sıfırla; yeni cuid ile permissions tekrar yüklensin
            token.permissionsLoadedAt = undefined;
          }
        } catch (err) {
          console.error('[auth.jwt] refresh DB lookup hatası:', err);
        }
      }

      // PR-Y2: Permission yükleme.
      // - Login anında (`user` mevcut) zorla yükle
      // - `update()` tetiklenirse yükle
      // - 5 dakikadan eski ise yükle (rol değişimini hızla yansıtmak için)
      // - Hata olursa eski değerleri koru, login akışını engelleme
      const FIVE_MIN_MS = 5 * 60 * 1000;
      const now = Date.now();
      const stale = !token.permissionsLoadedAt || (now - token.permissionsLoadedAt) > FIVE_MIN_MS;
      const shouldLoadPermissions = !!user || trigger === 'update' || stale;
      // PR-Y2.1: token.id (cuid) öncelikli — yukarıda set edildi.
      // Eski oturumlar (henüz token.id yoksa) için fallback: token.sub.
      const userId = token.id ?? (token.sub as string | undefined);

      if (shouldLoadPermissions && userId) {
        try {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: {
              role: {
                select: {
                  rolePermissions: { select: { permission: { select: { key: true } } } },
                },
              },
            },
          });
          const keys = new Set<string>();
          for (const ur of userRoles) {
            for (const rp of ur.role.rolePermissions) keys.add(rp.permission.key);
          }
          token.permissions = [...keys];
          token.permissionsLoadedAt = now;
        } catch (err) {
          console.error('[auth] permission yükleme hatası:', err);
          // Eski permissions korunur
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // PR-Y2.1: cuid öncelikli; eski JWT'ler için sub fallback
        session.user.id = token.id || token.sub || '';
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.title = token.title;
        session.user.distinguishedName = token.distinguishedName;
        session.user.ou = token.ou;
        session.user.managerDN = token.managerDN;
        session.user.managerEmail = token.managerEmail;
        // Email fallback: token'da email yoksa username'den oluştur
        if (!session.user.email || typeof session.user.email !== 'string') {
          session.user.email = token.email as string || `${token.username}@ilerigroup.com`;
        }
        // LDAP'tan gelen email casing tutarsız olabilir (Erol.Sahin@... vs erol.sahin@...).
        // DB'de email lowercase saklanıyor; Prisma findUnique case-sensitive olduğu için
        // session'da da normalize ediyoruz — yoksa endpoint'lerde 401 patlar.
        if (session.user.email && typeof session.user.email === 'string') {
          session.user.email = session.user.email.toLowerCase();
        }
        // PR-Y2: JWT'deki permissions'ı session'a aktar
        session.user.permissions = token.permissions ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 saat (iş günü)
  },
  secret: process.env.NEXTAUTH_SECRET,
};
