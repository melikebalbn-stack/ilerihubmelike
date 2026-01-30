// On-Premise Active Directory LDAP Integration
// Kullanıcı doğrulama ve bilgi çekme

import { Client } from 'ldapts';

// LDAP Filter özel karakterlerini escape et (LDAP Injection koruması)
function escapeLDAPFilter(str: string): string {
  return str
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\x00/g, '\\00')
    .replace(/\//g, '\\2f');
}

// LDAP Konfigürasyonu
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://192.168.2.20:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=ilerigroup,DC=com',
  usersDN: process.env.LDAP_USERS_DN || 'OU=ilerigroup,DC=ilerigroup,DC=com',
  bindDN: process.env.LDAP_BIND_DN || 'svc_ilerihub@ilerigroup.com',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
};

// LDAP Cache - kullanıcı listesi için (5 dakika)
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika
let ldapUsersCache: { data: LDAPUser[]; timestamp: number } | null = null;
let subordinatesCache: Map<string, { data: string[]; timestamp: number }> = new Map();

// Kullanıcı tipi
export interface LDAPUser {
  username: string;
  displayName: string;
  email: string | null;
  department: string | null;
  title: string | null;
  distinguishedName: string;
  memberOf: string[];
  ou: string | null; // Organizational Unit
  managerDN: string | null; // Yöneticinin DN'i
}

// Rol eşleme - OU veya grup bazlı
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'QUALITY_MANAGER' | 'HR_MANAGER' | 'USER';

// OU -> Rol eşlemesi (case-insensitive olarak kontrol edilecek)
const OU_ROLE_MAP: Record<string, UserRole> = {
  'information technology': 'ADMIN',
  'sistem geliştirme departmanı': 'ADMIN',
  'sistem gelistirme departmani': 'ADMIN',
  'bilgi teknolojileri': 'ADMIN',
  'it': 'ADMIN',
  'yonetim': 'SUPER_ADMIN',
  'üst yönetim': 'SUPER_ADMIN',
  'kalite': 'QUALITY_MANAGER',
  'kalite güvence': 'QUALITY_MANAGER',
  'insan kaynaklari': 'HR_MANAGER',
  'insan kaynakları': 'HR_MANAGER',
  'ik': 'HR_MANAGER',
};

// LDAP client oluştur
function createClient(): Client {
  return new Client({
    url: LDAP_CONFIG.url,
    timeout: 10000,
    connectTimeout: 10000,
  });
}

// Service account ile bağlan (okuma işlemleri için)
async function bindServiceAccount(client: Client): Promise<void> {
  await client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword);
}

// Kullanıcı kimlik doğrulama
export async function authenticateUser(username: string, password: string): Promise<LDAPUser | null> {
  const client = createClient();

  try {
    // Önce service account ile bağlan ve kullanıcıyı bul
    await bindServiceAccount(client);

    // Kullanıcıyı ara (sAMAccountName veya mail ile) - LDAP Injection korumalı
    const safeUsername = escapeLDAPFilter(username);
    console.log(`🔍 LDAP arama: ${username} -> DN: ${LDAP_CONFIG.usersDN}`);
    const { searchEntries } = await client.search(LDAP_CONFIG.usersDN, {
      scope: 'sub',
      filter: `(&(objectClass=user)(objectCategory=person)(|(sAMAccountName=${safeUsername})(mail=${safeUsername}@ilerigroup.com)))`,
      attributes: ['cn', 'sAMAccountName', 'mail', 'department', 'title', 'distinguishedName', 'memberOf', 'manager'],
    });

    if (searchEntries.length === 0) {
      console.log(`Kullanıcı bulunamadı: ${username}`);
      return null;
    }

    const userEntry = searchEntries[0];
    const userDN = userEntry.distinguishedName as string;

    await client.unbind();

    // Şimdi kullanıcının kendi credentials'ı ile doğrula
    const authClient = createClient();
    try {
      // Kullanıcı UPN formatında bind dene
      await authClient.bind(`${username}@ilerigroup.com`, password);
      await authClient.unbind();
    } catch (authError) {
      console.log(`Kimlik doğrulama başarısız: ${username}`);
      return null;
    }

    // Kullanıcı bilgilerini döndür
    const memberOf = Array.isArray(userEntry.memberOf)
      ? userEntry.memberOf as string[]
      : userEntry.memberOf
        ? [userEntry.memberOf as string]
        : [];

    // OU'yu DN'den çıkar
    const ouMatch = (userEntry.distinguishedName as string).match(/OU=([^,]+)/);
    const ou = ouMatch ? ouMatch[1] : null;

    // LDAP bazen array döndürüyor, ilk elemanı al veya string ise direkt kullan
    const getStringValue = (val: unknown): string | null => {
      if (Array.isArray(val)) {
        return val.length > 0 && typeof val[0] === 'string' ? val[0] : null;
      }
      return typeof val === 'string' && val.length > 0 ? val : null;
    };

    return {
      username: userEntry.sAMAccountName as string,
      displayName: getStringValue(userEntry.cn) || userEntry.sAMAccountName as string,
      email: getStringValue(userEntry.mail),
      department: getStringValue(userEntry.department),
      title: getStringValue(userEntry.title),
      distinguishedName: userDN,
      memberOf,
      ou,
      managerDN: getStringValue(userEntry.manager),
    };

  } catch (error) {
    console.error('LDAP kimlik doğrulama hatası:', error);
    return null;
  } finally {
    try {
      await client.unbind();
    } catch {
      // Zaten kapatılmış olabilir
    }
  }
}

// Kullanıcının rolünü belirle
// ÖNCELİK: Unvan (Müdür/Manager) + Departman kombinasyonu
export function determineUserRole(user: LDAPUser): UserRole {
  const titleLower = user.title?.toLowerCase() || '';
  const ouLower = user.ou?.toLowerCase() || '';
  const deptLower = user.department?.toLowerCase() || '';

  // Müdür/Manager unvanı kontrolü
  const isManager = titleLower.includes('müdür') ||
                    titleLower.includes('mudur') ||
                    titleLower.includes('manager') ||
                    titleLower.includes('direktör') ||
                    titleLower.includes('direktor');

  // Üst yönetim kontrolü (Genel Müdür, CEO vb.)
  if (titleLower.includes('genel müdür') ||
      titleLower.includes('genel mudur') ||
      titleLower.includes('ceo') ||
      ouLower === 'üst yönetim' ||
      ouLower === 'yonetim') {
    console.log(`🎯 Rol: ${user.title} -> SUPER_ADMIN`);
    return 'SUPER_ADMIN';
  }

  // Sadece müdür/manager unvanına sahip olanlar yönetici rolü alır
  if (isManager) {
    // IT/Sistem departmanı müdürü
    if (ouLower.includes('sistem') || ouLower.includes('bilgi teknoloji') || ouLower === 'it' ||
        deptLower.includes('sistem') || deptLower.includes('bilgi teknoloji') || deptLower.includes('it')) {
      console.log(`🎯 Rol: ${user.title} (${user.department}) -> ADMIN`);
      return 'ADMIN';
    }

    // Kalite departmanı müdürü
    if (ouLower.includes('kalite') || deptLower.includes('kalite')) {
      console.log(`🎯 Rol: ${user.title} (${user.department}) -> QUALITY_MANAGER`);
      return 'QUALITY_MANAGER';
    }

    // İK departmanı müdürü
    if (ouLower.includes('insan') || ouLower.includes('hr') ||
        deptLower.includes('insan') || deptLower.includes('hr')) {
      console.log(`🎯 Rol: ${user.title} (${user.department}) -> HR_MANAGER`);
      return 'HR_MANAGER';
    }

    // Diğer departman müdürleri
    console.log(`🎯 Rol: ${user.title} (${user.department}) -> DEPT_HEAD`);
    return 'USER'; // DEPT_HEAD rolü yoksa USER olarak devam
  }

  // Müdür/Manager unvanı olmayan herkes USER
  console.log(`🎯 Rol: ${user.title || 'unvan yok'} -> USER`);
  return 'USER';
}

// Tüm kullanıcıları listele (CACHED - 5 dakika)
export async function getAllLDAPUsers(): Promise<LDAPUser[]> {
  // Cache kontrolü
  const now = Date.now();
  if (ldapUsersCache && (now - ldapUsersCache.timestamp) < CACHE_TTL) {
    console.log('📦 LDAP kullanıcı cache\'den döndürülüyor');
    return ldapUsersCache.data;
  }

  const client = createClient();

  try {
    console.log('🔍 LDAP kullanıcı sorgusu yapılıyor...');
    await bindServiceAccount(client);

    const { searchEntries } = await client.search(LDAP_CONFIG.usersDN, {
      scope: 'sub',
      filter: '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))',
      attributes: ['cn', 'sAMAccountName', 'mail', 'department', 'title', 'distinguishedName', 'memberOf', 'manager'],
    });

    const users = searchEntries.map(entry => {
      const memberOf = Array.isArray(entry.memberOf)
        ? entry.memberOf as string[]
        : entry.memberOf
          ? [entry.memberOf as string]
          : [];

      const ouMatch = (entry.distinguishedName as string).match(/OU=([^,]+)/);

      // LDAP bazen array döndürüyor, ilk elemanı al veya string ise direkt kullan
      const getStringValue = (val: unknown): string | null => {
        if (Array.isArray(val)) {
          return val.length > 0 && typeof val[0] === 'string' ? val[0] : null;
        }
        return typeof val === 'string' && val.length > 0 ? val : null;
      };

      return {
        username: entry.sAMAccountName as string,
        displayName: getStringValue(entry.cn) || entry.sAMAccountName as string,
        email: getStringValue(entry.mail),
        department: getStringValue(entry.department),
        title: getStringValue(entry.title),
        distinguishedName: entry.distinguishedName as string,
        memberOf,
        ou: ouMatch ? ouMatch[1] : null,
        managerDN: getStringValue(entry.manager),
      };
    }).filter(user => {
      // Sistem hesaplarını filtrele
      if (!user.username || user.username.startsWith('$')) return false;
      // İşten ayrılanları filtrele (IstenAyrilanlar OU'sunda olanlar)
      if (user.distinguishedName.includes('OU=IstenAyrilanlar')) return false;
      return true;
    });

    // Cache'e kaydet
    ldapUsersCache = { data: users, timestamp: now };
    console.log(`✅ LDAP ${users.length} kullanıcı cache'lendi`);

    return users;

  } catch (error) {
    console.error('LDAP kullanıcı listesi hatası:', error);
    return [];
  } finally {
    await client.unbind();
  }
}

// Kullanıcı ara (cache'li getAllLDAPUsers üzerinden filtreleme - daha hızlı)
export async function searchLDAPUsers(query: string): Promise<LDAPUser[]> {
  // Cache'li kullanıcı listesinden filtrele
  const allUsers = await getAllLDAPUsers();
  const queryLower = query.toLowerCase();

  return allUsers.filter(user => {
    return (
      user.displayName?.toLowerCase().includes(queryLower) ||
      user.username?.toLowerCase().includes(queryLower) ||
      user.email?.toLowerCase().includes(queryLower)
    );
  }).slice(0, 50); // sizeLimit: 50
}

// Bir kullanıcının astlarını (direct reports) getir (cache'li getAllLDAPUsers üzerinden)
export async function getDirectReports(managerDN: string): Promise<LDAPUser[]> {
  // Cache'li kullanıcı listesinden filtrele
  const allUsers = await getAllLDAPUsers();
  const managerDNLower = managerDN.toLowerCase();

  return allUsers.filter(user =>
    user.managerDN?.toLowerCase() === managerDNLower
  );
}

// Dahili: Tüm kullanıcı haritasını cache'le (subordinates için)
let userHierarchyCache: { data: Map<string, { email: string | null; managerDN: string | null }>; timestamp: number } | null = null;

async function getUserHierarchyMap(): Promise<Map<string, { email: string | null; managerDN: string | null }>> {
  const now = Date.now();
  if (userHierarchyCache && (now - userHierarchyCache.timestamp) < CACHE_TTL) {
    return userHierarchyCache.data;
  }

  const client = createClient();

  try {
    await bindServiceAccount(client);

    const { searchEntries } = await client.search(LDAP_CONFIG.usersDN, {
      scope: 'sub',
      filter: '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))',
      attributes: ['mail', 'distinguishedName', 'manager'],
    });

    const userMap = new Map<string, { email: string | null; managerDN: string | null }>();

    const getStringValue = (val: unknown): string | null => {
      if (Array.isArray(val)) {
        return val.length > 0 && typeof val[0] === 'string' ? val[0] : null;
      }
      return typeof val === 'string' && val.length > 0 ? val : null;
    };

    for (const entry of searchEntries) {
      const dn = entry.distinguishedName as string;
      if (dn.includes('OU=IstenAyrilanlar')) continue;

      userMap.set(dn.toLowerCase(), {
        email: getStringValue(entry.mail),
        managerDN: getStringValue(entry.manager),
      });
    }

    userHierarchyCache = { data: userMap, timestamp: now };
    console.log(`✅ Kullanıcı hiyerarşisi cache'lendi (${userMap.size} kullanıcı)`);

    return userMap;
  } finally {
    await client.unbind();
  }
}

// Bir kullanıcının tüm astlarını (recursive) getir - hiyerarşik olarak
// OPTİMİZE: Tek LDAP sorgusu ile tüm kullanıcıları çekip bellekte hiyerarşi oluştur (CACHED)
export async function getAllSubordinates(managerDN: string): Promise<string[]> {
  // Cache kontrolü - bu yönetici için daha önce hesaplandı mı?
  const now = Date.now();
  const cacheKey = managerDN.toLowerCase();
  const cached = subordinatesCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`📦 Subordinates cache'den döndürülüyor: ${managerDN.substring(0, 30)}...`);
    return cached.data;
  }

  try {
    const userMap = await getUserHierarchyMap();

    // Bellekte recursive olarak astları bul
    const allSubordinateEmails: string[] = [];
    const visited = new Set<string>();

    function findSubordinates(targetManagerDN: string) {
      const targetDNLower = targetManagerDN.toLowerCase();

      for (const [dn, user] of userMap.entries()) {
        if (user.managerDN?.toLowerCase() === targetDNLower && !visited.has(dn)) {
          visited.add(dn);
          if (user.email) {
            allSubordinateEmails.push(user.email.toLowerCase());
          }
          // Bu kişinin de astlarını bul (recursive - ama bellekte)
          findSubordinates(dn);
        }
      }
    }

    findSubordinates(managerDN);

    // Cache'e kaydet
    subordinatesCache.set(cacheKey, { data: allSubordinateEmails, timestamp: now });
    console.log(`✅ ${allSubordinateEmails.length} ast cache'lendi`);

    return allSubordinateEmails;

  } catch (error) {
    console.error('getAllSubordinates hatası:', error);
    return [];
  }
}

// Bağlantı testi
export async function testLDAPConnection(): Promise<boolean> {
  const client = createClient();

  try {
    await bindServiceAccount(client);
    await client.unbind();
    return true;
  } catch (error) {
    console.error('LDAP bağlantı testi başarısız:', error);
    return false;
  }
}

// DN'den email adresini al
export async function getEmailFromDN(dn: string): Promise<string | null> {
  if (!dn) return null;

  const client = createClient();

  try {
    await bindServiceAccount(client);

    const { searchEntries } = await client.search(dn, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['mail'],
    });

    if (searchEntries.length > 0 && searchEntries[0].mail) {
      return searchEntries[0].mail as string;
    }

    return null;
  } catch (error) {
    console.error('DN\'den email alma hatası:', error);
    return null;
  } finally {
    try {
      await client.unbind();
    } catch {
      // Zaten kapatılmış olabilir
    }
  }
}

// Organizational Unit (OU) yapısı
export interface ADOrgUnit {
  dn: string;
  name: string;
  description: string | null;
  parentDN: string | null;
  path: string; // Tam OU yolu
  level: number; // Hiyerarşi seviyesi
  employeeCount: number;
  managerDN: string | null;
  managerName: string | null;
  managerEmail: string | null;
}

// OU Cache
let ouCache: { data: ADOrgUnit[]; timestamp: number } | null = null;
const OU_CACHE_TTL = 10 * 60 * 1000; // 10 dakika

// AD'den tüm OU'ları çek
export async function getAllOUs(): Promise<ADOrgUnit[]> {
  const now = Date.now();
  if (ouCache && (now - ouCache.timestamp) < OU_CACHE_TTL) {
    console.log('📦 OU cache\'den döndürülüyor');
    return ouCache.data;
  }

  const client = createClient();

  try {
    console.log('🔍 AD OU sorgusu yapılıyor...');
    await bindServiceAccount(client);

    // Tüm OU'ları çek
    const { searchEntries } = await client.search(LDAP_CONFIG.baseDN, {
      scope: 'sub',
      filter: '(objectClass=organizationalUnit)',
      attributes: ['name', 'description', 'distinguishedName', 'managedBy'],
    });

    // Kullanıcıları da çek (OU bazlı sayım için)
    const allUsers = await getAllLDAPUsers();

    // OU bazlı kullanıcı sayısı hesapla
    const ouUserCounts = new Map<string, number>();
    for (const user of allUsers) {
      // Kullanıcının OU'sunu DN'den çıkar
      const ouMatches = user.distinguishedName.match(/OU=([^,]+)/g);
      if (ouMatches && ouMatches.length > 0) {
        // İlk OU (en yakın)
        const primaryOU = ouMatches[0].replace('OU=', '');
        ouUserCounts.set(primaryOU, (ouUserCounts.get(primaryOU) || 0) + 1);
      }
    }

    const getStringValue = (val: unknown): string | null => {
      if (Array.isArray(val)) {
        return val.length > 0 && typeof val[0] === 'string' ? val[0] : null;
      }
      return typeof val === 'string' && val.length > 0 ? val : null;
    };

    const ous: ADOrgUnit[] = [];

    for (const entry of searchEntries) {
      const dn = entry.distinguishedName as string;
      const name = getStringValue(entry.name) || '';

      // Sistem OU'larını atla
      if (['Builtin', 'Computers', 'Domain Controllers', 'ForeignSecurityPrincipals',
           'Keys', 'Managed Service Accounts', 'Microsoft Exchange Security Groups',
           'IstenAyrilanlar', 'Users'].includes(name)) {
        continue;
      }

      // Parent OU'yu bul
      const dnParts = dn.split(',');
      const parentParts = dnParts.slice(1);
      const parentDN = parentParts.length > 0 && parentParts[0].startsWith('OU=')
        ? parentParts.join(',')
        : null;

      // OU path'ini oluştur (hiyerarşik)
      const ouMatches = dn.match(/OU=([^,]+)/g) || [];
      const path = ouMatches.map(m => m.replace('OU=', '')).reverse().join(' > ');
      const level = ouMatches.length;

      // Manager bilgisini al
      const managedByDN = getStringValue(entry.managedBy);
      let managerName: string | null = null;
      let managerEmail: string | null = null;

      if (managedByDN) {
        // Manager bilgisini kullanıcı listesinden bul
        const manager = allUsers.find(u => u.distinguishedName.toLowerCase() === managedByDN.toLowerCase());
        if (manager) {
          managerName = manager.displayName;
          managerEmail = manager.email;
        }
      }

      ous.push({
        dn,
        name,
        description: getStringValue(entry.description),
        parentDN,
        path,
        level,
        employeeCount: ouUserCounts.get(name) || 0,
        managerDN: managedByDN,
        managerName,
        managerEmail,
      });
    }

    // Seviyeye göre sırala
    ous.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'tr'));

    // Cache'e kaydet
    ouCache = { data: ous, timestamp: now };
    console.log(`✅ AD ${ous.length} OU cache'lendi`);

    return ous;

  } catch (error) {
    console.error('AD OU listesi hatası:', error);
    return [];
  } finally {
    await client.unbind();
  }
}

// OU'ları hiyerarşik yapıya dönüştür
export interface ADOrgTree extends ADOrgUnit {
  children: ADOrgTree[];
}

export async function getOUHierarchy(): Promise<ADOrgTree[]> {
  const ous = await getAllOUs();

  // DN -> OU map
  const ouMap = new Map<string, ADOrgTree>();

  // Önce tüm OU'ları map'e ekle
  for (const ou of ous) {
    ouMap.set(ou.dn.toLowerCase(), { ...ou, children: [] });
  }

  // Hiyerarşiyi oluştur
  const roots: ADOrgTree[] = [];

  for (const ou of ous) {
    const node = ouMap.get(ou.dn.toLowerCase())!;

    if (ou.parentDN) {
      const parent = ouMap.get(ou.parentDN.toLowerCase());
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent bulunamadı, root olarak ekle
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// OU cache'ini temizle
export function clearOUCache(): void {
  ouCache = null;
  console.log('🗑️ OU cache temizlendi');
}

// Departman bazlı çalışan sayıları
export async function getDepartmentStats(): Promise<Map<string, { count: number; manager: string | null }>> {
  const allUsers = await getAllLDAPUsers();
  const stats = new Map<string, { count: number; manager: string | null }>();

  for (const user of allUsers) {
    const dept = user.department || 'Tanımsız';
    const current = stats.get(dept) || { count: 0, manager: null };
    current.count++;
    stats.set(dept, current);
  }

  return stats;
}
