import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authenticateUser, determineUserRole, getEmailFromDN } from '@/lib/ldap';
import { prisma } from '@/lib/prisma';
import { Role, LoginStatus } from '@/generated/prisma';

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
    CredentialsProvider({
      id: 'ldap',
      name: 'ILERI Active Directory',
      credentials: {
        username: { label: 'Kullanıcı Adı', type: 'text', placeholder: 'ornek.kullanici' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Kullanıcı adı ve şifre gerekli');
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

          // Debug: LDAP'tan gelen verileri logla
          console.log('🔐 Login - LDAP Kullanıcı Bilgileri:', {
            username: ldapUser.username,
            displayName: ldapUser.displayName,
            email: ldapUser.email,
            department: ldapUser.department,
            ou: ldapUser.ou,
            distinguishedName: ldapUser.distinguishedName,
            determinedRole: role,
          });

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
          try {
            await prisma.user.upsert({
              where: { email: userEmail },
              update: {
                name: ldapUser.displayName,
                department: ldapUser.department,
                role: prismaRole,
                isActive: true,
              },
              create: {
                id: `ad_${ldapUser.username}`,
                email: userEmail,
                name: ldapUser.displayName,
                department: ldapUser.department,
                role: prismaRole,
                isActive: true,
              },
            });
          } catch (dbError) {
            // Veritabanı hatası login'i engellemeyecek, sadece logla
            console.error('Kullanıcı veritabanına kaydedilemedi:', dbError);
          }

          // Üst yönetim için session role'ünü de SUPER_ADMIN yap
          const sessionRole = SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase()) ? 'SUPER_ADMIN' : role;

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
