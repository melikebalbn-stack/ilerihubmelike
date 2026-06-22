// AD kullanıcılarını departmana göre listele
import { Client } from 'ldapts';
import * as dotenv from 'dotenv';

dotenv.config();

const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://192.168.2.20:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=ilerigroup,DC=com',
  usersDN: process.env.LDAP_USERS_DN || 'DC=ilerigroup,DC=com',
  bindDN: process.env.LDAP_BIND_DN || 'svc_ilerihub@ilerigroup.com',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
};

async function main() {
  const client = new Client({
    url: LDAP_CONFIG.url,
    timeout: 10000,
    connectTimeout: 10000,
  });

  try {
    console.log('AD\'ye bağlanılıyor...');
    console.log('URL:', LDAP_CONFIG.url);
    console.log('Search DN:', LDAP_CONFIG.usersDN);

    await client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword);
    console.log('Bağlantı başarılı!\n');

    const { searchEntries } = await client.search(LDAP_CONFIG.usersDN, {
      scope: 'sub',
      filter: '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))',
      attributes: ['sAMAccountName', 'cn', 'mail', 'department', 'distinguishedName'],
    });

    // İşten ayrılanları filtrele
    const activeUsers = searchEntries.filter(e => {
      const dn = e.distinguishedName as string;
      return !dn.includes('OU=IstenAyrilanlar') && !((e.sAMAccountName as string)?.startsWith('$'));
    });

    console.log(`Toplam aktif kullanıcı: ${activeUsers.length}\n`);

    // Departmana göre grupla
    const byDepartment = new Map<string, Array<{username: string, name: string, email: string}>>();

    for (const user of activeUsers) {
      // LDAP bazen array döndürebilir
      const deptRaw = user.department;
      const dept = String(Array.isArray(deptRaw) ? deptRaw[0] : deptRaw || 'Tanımsız');
      const usernameRaw = user.sAMAccountName;
      const username = String(Array.isArray(usernameRaw) ? usernameRaw[0] : usernameRaw || '');
      const nameRaw = user.cn;
      const name = String(Array.isArray(nameRaw) ? nameRaw[0] : nameRaw || '');
      const emailRaw = user.mail;
      const email = String(Array.isArray(emailRaw) ? emailRaw[0] : emailRaw || '');

      if (!byDepartment.has(dept)) {
        byDepartment.set(dept, []);
      }
      byDepartment.get(dept)!.push({ username, name, email });
    }

    // Departmanları alfabetik sırala ve listele
    const sortedDepts = Array.from(byDepartment.keys()).sort((a, b) => a.localeCompare(b, 'tr'));

    for (const dept of sortedDepts) {
      const users = byDepartment.get(dept)!;
      console.log(`\n📁 ${dept} (${users.length} kişi)`);
      console.log('─'.repeat(50));

      users.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      for (const u of users) {
        console.log(`   ${u.username.padEnd(20)} | ${u.name}`);
      }
    }

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    await client.unbind();
  }
}

main();
