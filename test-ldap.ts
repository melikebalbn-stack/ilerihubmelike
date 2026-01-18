// LDAP bağlantı testi
import { Client } from 'ldapts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://192.168.2.20:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=ilerigroup,DC=com',
  usersDN: process.env.LDAP_USERS_DN || 'OU=ilerigroup,DC=ilerigroup,DC=com',
  bindDN: process.env.LDAP_BIND_DN || 'svc_ilerihub@ilerigroup.com',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
};

async function testLDAP() {
  console.log('🔧 LDAP Yapılandırması:');
  console.log('  URL:', LDAP_CONFIG.url);
  console.log('  Base DN:', LDAP_CONFIG.baseDN);
  console.log('  Users DN:', LDAP_CONFIG.usersDN);
  console.log('  Bind DN:', LDAP_CONFIG.bindDN);
  console.log('  Bind Password:', LDAP_CONFIG.bindPassword ? '****' : 'BOŞ!');
  console.log('');

  const client = new Client({
    url: LDAP_CONFIG.url,
    timeout: 10000,
    connectTimeout: 10000,
  });

  try {
    console.log('1️⃣ Service account ile bağlantı testi...');
    await client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword);
    console.log('   ✅ Service account bağlantısı başarılı');

    // melih.dilben kullanıcısını ara
    console.log('\n2️⃣ melih.dilben kullanıcısını arıyorum...');
    const { searchEntries } = await client.search(LDAP_CONFIG.usersDN, {
      scope: 'sub',
      filter: '(&(objectClass=user)(objectCategory=person)(sAMAccountName=melih.dilben))',
      attributes: ['cn', 'sAMAccountName', 'mail', 'department', 'distinguishedName', 'userAccountControl'],
    });

    if (searchEntries.length === 0) {
      console.log('   ❌ Kullanıcı bulunamadı!');

      // Alternatif arama yap
      console.log('\n3️⃣ Tüm kullanıcılarda "melih" aranıyor...');
      const { searchEntries: allEntries } = await client.search(LDAP_CONFIG.usersDN, {
        scope: 'sub',
        filter: '(&(objectClass=user)(objectCategory=person)(cn=*melih*))',
        attributes: ['cn', 'sAMAccountName', 'mail', 'distinguishedName'],
        sizeLimit: 10,
      });

      if (allEntries.length > 0) {
        console.log(`   Bulunan kullanıcılar (${allEntries.length}):`);
        allEntries.forEach(entry => {
          console.log(`   - ${entry.sAMAccountName} (${entry.cn}) - ${entry.mail || 'email yok'}`);
        });
      } else {
        console.log('   Hiç "melih" içeren kullanıcı bulunamadı.');
      }
    } else {
      const user = searchEntries[0];
      console.log('   ✅ Kullanıcı bulundu:');
      console.log('      CN:', user.cn);
      console.log('      sAMAccountName:', user.sAMAccountName);
      console.log('      Email:', user.mail);
      console.log('      Department:', user.department);
      console.log('      DN:', user.distinguishedName);
      console.log('      userAccountControl:', user.userAccountControl);

      // userAccountControl 514 veya 66050 ise hesap devre dışı
      const uac = Number(user.userAccountControl);
      if (uac & 2) {
        console.log('   ⚠️ UYARI: Hesap DEVRE DIŞI (disabled)!');
      }
    }

    await client.unbind();
    console.log('\n✅ Test tamamlandı');

  } catch (error) {
    console.error('\n❌ LDAP Hatası:', error);
  }
}

testLDAP();
