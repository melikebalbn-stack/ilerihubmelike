import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authenticateUser, determineUserRole, getEmailFromDN } from '@/lib/ldap';
import { prisma } from '@/lib/prisma';
import { Role, LoginStatus } from '@/generated/prisma';
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

// Üst yönetim e-postaları - otomatik SUPER_ADMIN
const SUPER_ADMIN_EMAILS = [
  'halit.ileri@ilerigroup.com',
  'gurhan.horbay@ilerigroup.com',
  'hilmi.ileri@ilerigroup.com',
  'eren.ileri@ilerigroup.com',
  'koray.ileri@ilerigroup.com',
  'melike.balaban@ilerigroup.com',
  'melih.dilben@ilerigroup.com',
];

// LDAP rolünü Prisma Role enum'una dönüştür
function mapLdapRoleToPrismaRole(ldapRole: string, email?: string): Role {
  // Üst yönetim için otomatik SUPER_ADMIN
  if (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return Role.SUPER_ADMIN;
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
          const userEmail = (typeof ldapUser.email === 'string' ? ldapUser.email.trim() : null) || `${ldapUser.username}@ilerigroup.com`;

          // Kullanıcıyı veritabanına kaydet veya güncelle (upsert)
          const prismaRole = mapLdapRoleToPrismaRole(role, userEmail);

          // FIX #16: DB hata yönetimi - retry mekanizması ve hata izleme
          const maxRetries = 3;
          let dbSyncSuccess = false;
          let lastDbError: unknown = null;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              await prisma.user.upsert({
                where: { email: userEmail },
                update: {
                  name: ldapUser.displayName,
                  department: ldapUser.department,
                  jobTitle: ldapUser.title,
                  role: prismaRole,
                  isActive: true,
                },
                create: {
                  id: `ad_${ldapUser.username}`,
                  email: userEmail,
                  name: ldapUser.displayName,
                  department: ldapUser.department,
                  jobTitle: ldapUser.title,
                  role: prismaRole,
                  isActive: true,
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
    async jwt({ token, user }) {
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || '';
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
