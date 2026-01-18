import { searchLDAPUsers, getAllLDAPUsers } from '../src/lib/ldap';

async function main() {
  console.log('AD kullanıcı kontrolü başlıyor...\n');

  // Emek araması
  console.log('=== "emek" araması ===');
  const emekUsers = await searchLDAPUsers('emek');
  console.log(`Bulunan: ${emekUsers.length} kullanıcı`);
  emekUsers.forEach(u => console.log(`  - ${u.username} | ${u.displayName} | ${u.email}`));

  // Dede araması
  console.log('\n=== "dede" araması ===');
  const dedeUsers = await searchLDAPUsers('dede');
  console.log(`Bulunan: ${dedeUsers.length} kullanıcı`);
  dedeUsers.forEach(u => console.log(`  - ${u.username} | ${u.displayName} | ${u.email}`));

  // ibrahim.bozkurt araması
  console.log('\n=== "ibrahim" araması ===');
  const ibrahimUsers = await searchLDAPUsers('ibrahim');
  console.log(`Bulunan: ${ibrahimUsers.length} kullanıcı`);
  ibrahimUsers.forEach(u => console.log(`  - ${u.username} | ${u.displayName} | ${u.email}`));

  // Toplam kullanıcı
  console.log('\n=== Toplam AD kullanıcı sayısı ===');
  const allUsers = await getAllLDAPUsers();
  console.log(`Toplam: ${allUsers.length} aktif kullanıcı`);
}

main().catch(console.error);
