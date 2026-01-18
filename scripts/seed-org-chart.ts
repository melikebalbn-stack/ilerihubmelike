import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || "postgresql://ilerihub_user:ileri2024secure@localhost:5432/ilerihub";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Sistem Gelistirme departmani olusturuluyor...');

  // Sistem Gelistirme Departmani olustur
  const sistemGelistirme = await prisma.orgUnit.upsert({
    where: { code: 'SIS-GEL' },
    update: {},
    create: {
      code: 'SIS-GEL',
      name: 'Sistem Gelistirme',
      shortName: 'SG',
      description: 'Yazilim gelistirme, IT altyapi ve sistem yonetimi',
      unitType: 'DEPARTMENT',
      level: 1,
      location: 'Merkez Ofis',
      approvedHeadcount: 6,
      isActive: true
    }
  });

  console.log('Departman olusturuldu:', sistemGelistirme.id);

  // Personeller
  const personeller = [
    {
      displayName: 'Melih Dilben',
      email: 'melih.dilben@ilerigroup.com',
      positionTitle: 'Sistem Gelistirme Muduru',
      employmentStatus: 'ACTIVE' as const,
      title: 'Mudur'
    },
    {
      displayName: 'Melike Balaban',
      email: 'melike.balaban@ilerigroup.com',
      positionTitle: 'Sistem Gelistirme Muhendisi',
      employmentStatus: 'ACTIVE' as const,
      title: 'Muhendis'
    },
    {
      displayName: 'Enes Efe Aydinçakir',
      email: 'enes.aydinçakir@ilerigroup.com',
      positionTitle: 'IT Uzman Yardimcisi',
      employmentStatus: 'ACTIVE' as const,
      title: 'Uzman Yardimcisi'
    },
    // Bos pozisyonlar
    {
      displayName: 'IT Uzmani',
      email: null,
      positionTitle: 'IT Uzmani',
      employmentStatus: 'VACANT' as const,
      title: null
    },
    {
      displayName: 'Grafik Tasarim Uzmani',
      email: null,
      positionTitle: 'Grafik Tasarim Uzmani',
      employmentStatus: 'VACANT' as const,
      title: null
    },
    {
      displayName: 'Sistem Gelistirme Muhendisi',
      email: null,
      positionTitle: 'Sistem Gelistirme Muhendisi',
      employmentStatus: 'VACANT' as const,
      title: null
    }
  ];

  // Melih Dilben'i bul veya olustur (yonetici olacak)
  let yonetici = null;

  for (const p of personeller) {
    // Email varsa unique key olarak kullan
    let existing = null;
    if (p.email) {
      existing = await prisma.orgEmployee.findFirst({
        where: { email: p.email }
      });
    }

    if (existing) {
      console.log('Personel zaten var, guncelleniyor:', p.displayName);
      const updated = await prisma.orgEmployee.update({
        where: { id: existing.id },
        data: {
          displayName: p.displayName,
          positionTitle: p.positionTitle,
          employmentStatus: p.employmentStatus,
          title: p.title,
          orgUnitId: sistemGelistirme.id
        }
      });
      if (p.positionTitle?.includes('Muduru')) {
        yonetici = updated;
      }
    } else {
      console.log('Yeni personel ekleniyor:', p.displayName);
      const created = await prisma.orgEmployee.create({
        data: {
          userId: p.email || undefined,
          email: p.email,
          displayName: p.displayName,
          positionTitle: p.positionTitle,
          employmentStatus: p.employmentStatus,
          title: p.title,
          orgUnitId: sistemGelistirme.id,
          isActive: true
        }
      });
      if (p.positionTitle?.includes('Muduru')) {
        yonetici = created;
      }
    }
  }

  // Headcount guncelle (sadece aktif personel)
  const activeCount = await prisma.orgEmployee.count({
    where: {
      orgUnitId: sistemGelistirme.id,
      employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] },
      isActive: true
    }
  });

  await prisma.orgUnit.update({
    where: { id: sistemGelistirme.id },
    data: {
      headcount: activeCount,
      managerName: 'Melih Dilben',
      managerEmail: 'melih.dilben@ilerigroup.com'
    }
  });

  console.log('\nBasarili!');
  console.log('- Departman: Sistem Gelistirme');
  console.log('- Aktif Personel:', activeCount);
  console.log('- Bos Pozisyon:', personeller.filter(p => p.employmentStatus === 'VACANT').length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
