import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const departments = [
  {
    name: 'Asansör',
    code: 'ASANSOR',
    adOuName: 'Asansor',
    adOuDn: 'OU=Asansor,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 1,
  },
  {
    name: 'Sistem Geliştirme',
    code: 'IT',
    adOuName: 'information technology',
    adOuDn: 'OU=information technology,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 2,
  },
  {
    name: 'İnsan Varlıkları',
    code: 'IK',
    adOuName: 'insan Kaynaklari',
    adOuDn: 'OU=insan Kaynaklari,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 3,
  },
  {
    name: 'Kalite',
    code: 'KALITE',
    adOuName: 'Kalite',
    adOuDn: 'OU=Kalite,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 4,
  },
  {
    name: 'Muhasebe',
    code: 'MUHASEBE',
    adOuName: 'Muhasebe',
    adOuDn: 'OU=Muhasebe,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 5,
  },
  {
    name: 'Mühendislik',
    code: 'MUHENDISLIK',
    adOuName: 'Muhendislik',
    adOuDn: 'OU=Muhendislik,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 6,
  },
  {
    name: 'Satınalma',
    code: 'SATINALMA',
    adOuName: 'Satinalma',
    adOuDn: 'OU=Satinalma,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 7,
  },
  {
    name: 'Satış Pazarlama',
    code: 'SATIS',
    adOuName: 'Satis Pazarlama',
    adOuDn: 'OU=Satis Pazarlama,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 8,
  },
  {
    name: 'Üretim',
    code: 'URETIM',
    adOuName: 'Uretim',
    adOuDn: 'OU=Uretim,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 9,
  },
  {
    name: 'Üretim Planlama',
    code: 'URETIM_PLANLAMA',
    adOuName: 'Uretim Planlama',
    adOuDn: 'OU=Uretim Planlama,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 10,
  },
  {
    name: 'Yönetim',
    code: 'YONETIM',
    adOuName: 'Yonetim',
    adOuDn: 'OU=Yonetim,OU=ilerigroup,DC=ilerigroup,DC=com',
    sortOrder: 11,
  },
];

async function main() {
  console.log('Departmanlar ekleniyor...');

  for (const dept of departments) {
    const existing = await prisma.department.findUnique({
      where: { code: dept.code },
    });

    if (existing) {
      // Güncelle
      await prisma.department.update({
        where: { code: dept.code },
        data: {
          name: dept.name,
          adOuName: dept.adOuName,
          adOuDn: dept.adOuDn,
          sortOrder: dept.sortOrder,
          isActive: true,
        },
      });
      console.log(`✓ Güncellendi: ${dept.name}`);
    } else {
      // Yeni ekle
      await prisma.department.create({
        data: dept,
      });
      console.log(`✓ Eklendi: ${dept.name}`);
    }
  }

  // Sonuçları göster
  const allDepts = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  console.log('\n=== Departman Listesi ===');
  allDepts.forEach((d, i) => {
    console.log(`${i + 1}. ${d.name} (${d.code}) -> AD: ${d.adOuName}`);
  });
  console.log(`\nToplam: ${allDepts.length} departman`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
