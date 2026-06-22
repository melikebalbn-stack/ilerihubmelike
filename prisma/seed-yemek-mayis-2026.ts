import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL bulunamadi');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface MenuGun {
  tarih: string;
  items: string[];
  notes?: string;
  isHoliday?: boolean;
  holidayName?: string;
}

const MAYIS_2026: MenuGun[] = [
  { tarih: '2026-05-01', items: ['Sehriye Corba', 'Eksili Kofte', 'Bulgur Pilavi', 'Meyve', 'Salata Bar'],
    notes: 'Kalori: Corba 136, Kofte 280, Pilav 251, Meyve 72' },
  { tarih: '2026-05-02', items: ['Yavan Corba', 'Firinda Tavuk', 'Firin Makarna', 'Baklava', 'Salata Bar'],
    notes: 'Kalori: Corba 144, Tavuk 291, Makarna 332, Baklava 486' },
  { tarih: '2026-05-03', items: ['Sehriye Corba', 'Izgara Kofte', 'Bulgur Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Kalori: Corba 136, Kofte 200, Pilav 251, Icecek 122' },
  { tarih: '2026-05-04', items: ['Mercimek Corba', 'Pilic Sinitzel', 'Makarna', 'Meyve', 'Salata Bar'],
    notes: 'Kalori: Corba 76, Pilic 474, Makarna 229, Meyve 72' },
  { tarih: '2026-05-05', items: ['Krm Pilic Corba', 'Ispanak', 'Borek', 'Sobiyet Tatlisi', 'Salata Bar'],
    notes: 'Kalori: Corba 110, Ispanak 162, Borek 246, Tatli 522' },
  { tarih: '2026-05-06', items: ['Sehriye Corba', 'Sahan Kofte', 'Bulgur Pilavi', 'Meyve', 'Salata Bar'],
    notes: 'Kalori: Corba 136, Kofte 244, Pilav 251, Meyve 72' },
  { tarih: '2026-05-07', items: ['Krm Mantar Corba', 'Etli Kurufasulye', 'Pirinc Pilav', 'Krem Sokola', 'Salata Bar'],
    notes: 'Kalori: Corba 160, Fasulye 172, Pilav 332, Tatli 216' },
  { tarih: '2026-05-08', items: ['Yesil Mercimek Corba', 'Firin Baget', 'Arpa Sehriye Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Kalori: Corba 121, Baget 396, Pilav 225, Icecek 122' },
  { tarih: '2026-05-09', items: ['Ezogelin Corba', 'Hindi Kavurma', 'Pirinc Pilav', 'Meyve', 'Salata Bar'],
    notes: 'Kalori: Corba 95, Hindi 225, Pilav 332, Meyve 72' },
  { tarih: '2026-05-10', items: ['Yavan Corba', 'Orman Kebabi', 'Bulgur Pilavi', 'Magnolia', 'Salata Bar'],
    notes: 'Kalori: Corba 144, Kebap 256, Pilav 251, Tatli 381' },
  { tarih: '2026-05-11', items: ['Domates Corbasi', 'Izmir Kofte', 'Bulgur Pilavi', 'Supangle', 'Salata Bar'],
    notes: 'Kalori: Corba 50, Kofte 197, Pilav 251, Tatli 159' },
  { tarih: '2026-05-12', items: ['Krm Pilic Corba', 'Patlican Musakka', 'Pirinc Pilav', 'Meyve', 'Salata Bar'],
    notes: 'Kalori: Corba 110, Musakka 131, Pilav 332, Meyve 72' },
  { tarih: '2026-05-13', items: ['Sehriye Corba', 'Arnavut Tavuk', 'Makarna', 'Peynir Tatlisi', 'Salata Bar'],
    notes: 'Kalori: Corba 136, Tavuk 285, Makarna 229, Tatli 179' },
  { tarih: '2026-05-14', items: ['Mercimek Corba', 'Karisik Dolma (Kabak-Biber)', 'Patatesli Borek', 'Revani', 'Salata Bar'],
    notes: 'Kalori: Corba 76, Dolma 56, Borek 408, Tatli 348' },
  { tarih: '2026-05-15', items: ['Ezogelin Corba', 'Pilic Izgara', 'Pirinc Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Kalori: Corba 95, Pilic 203, Pilav 332, Icecek 122' },
  { tarih: '2026-05-16', items: ['Dugun Corba', 'Etli Nohut', 'Pirinc Pilav', 'Irmik Helvasi', 'Salata Bar'],
    notes: 'Kalori: Corba 93, Nohut 285, Pilav 332, Tatli 532' },
  { tarih: '2026-05-17', items: ['Ezogelin Corba', 'Tas Kebabi', 'Pirinc Pilavi', 'Meyve', 'Salata Bar'],
    notes: 'Kalori: Corba 95, Kebap 213, Pilav 332, Meyve 72' },
  { tarih: '2026-05-18', items: ['Domates Corba', 'Barbeku Sos Tavuk Fajita (Sos Yaninda)', 'Pirinc Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Kalori: Corba 50, Fajita 226, Pilav 332, Icecek 122' },
  { tarih: '2026-05-19', items: ['Ezogelin Corba', 'Karniyarik', 'Pirinc Pilav', 'Magnolia', 'Salata Bar'],
    notes: 'Kalori: Corba 95, Karniyarik 191, Pilav 332, Tatli 381' },
  { tarih: '2026-05-20', items: ['Yavan Corba', 'Sebzeli Kofte', 'Makarna', 'Meyve', 'Salata Bar'],
    notes: 'Kalori: Corba 144, Kofte 251, Makarna 229, Meyve 72' },
  { tarih: '2026-05-21', items: ['Dugun Corbasi', 'Etli Kuru Fasulye', 'Sehriye Pilavi', 'Profiterol', 'Salata Bar'],
    notes: 'Kalori: Corba 93, Fasulye 172, Pilav 225, Tatli 429' },
  { tarih: '2026-05-22', items: ['Domates Corba', 'Tavuk Doner', 'Pirinc Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Kalori: Corba 50, Doner 241, Pilav 332, Icecek 122' },
  { tarih: '2026-05-23', items: ['Yesil Mercimek Corba', 'Pilic Izgara', 'Bulgur Pilavi', 'Komposto', 'Salata Bar'],
    notes: 'Kalori: Corba 121, Pilic 203, Pilav 251, Komposto 125' },
  { tarih: '2026-05-24', items: ['Krm Pilic Corba', 'Etli Kabak Dolmasi', 'Tepsi Boregi', 'Kadayif/Yogurt', 'Salata Bar'],
    notes: 'Kalori: Corba 110, Dolma 234, Borek 375, Tatli 299' },
  { tarih: '2026-05-25', items: ['Sehriye Corba', 'Izgara Kofte', 'Bulgur Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Kalori: Corba 136, Kofte 200, Pilav 251, Icecek 122' },
  { tarih: '2026-05-26', items: ['Yayla Corba', 'Karniyarik', 'Makarna', 'Baklava', 'Salata Bar'],
    notes: 'Arife Gunu. Kalori: Corba 98, Karniyarik 191, Makarna 229, Baklava 486',
    isHoliday: true, holidayName: 'Arife Gunu' },
  { tarih: '2026-05-27', items: ['Krm Domates Corbasi', 'Pilic Izgara', 'Bulgur Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Bayramin 1. Gunu. Kalori: Corba 50, Pilic 203, Pilav 251, Icecek 122',
    isHoliday: true, holidayName: 'Bayramin 1. Gunu' },
  { tarih: '2026-05-28', items: ['Mercimek Corba', 'Sebzeli Kebap', 'Pirinc Pilavi', 'Meyve', 'Salata Bar'],
    notes: 'Bayramin 2. Gunu. Kalori: Corba 76, Kebap 247, Pilav 332, Meyve 72',
    isHoliday: true, holidayName: 'Bayramin 2. Gunu' },
  { tarih: '2026-05-29', items: ['Ezogelin Corba', 'Et Kavurma', 'Pirinc Pilavi', 'Sutlac', 'Salata Bar'],
    notes: 'Bayramin 3. Gunu. Kalori: Corba 95, Kavurma 414, Pilav 332, Sutlac 268',
    isHoliday: true, holidayName: 'Bayramin 3. Gunu' },
  { tarih: '2026-05-30', items: ['Yavan Corba', 'Etli Turlu', 'Makarna', 'Meyve', 'Salata Bar'],
    notes: 'Bayramin 4. Gunu. Kalori: Corba 144, Turlu 221, Makarna 229, Meyve 72',
    isHoliday: true, holidayName: 'Bayramin 4. Gunu' },
  { tarih: '2026-05-31', items: ['Sehriye Corba', 'Izgara Kofte', 'Bulgur Pilavi', 'Kola/Fanta', 'Salata Bar'],
    notes: 'Kalori: Corba 136, Kofte 200, Pilav 251, Icecek 122' },
];

async function main() {
  console.log('Mayis 2026 yemek menusu yukleniyor (3. Bolge)...');
  console.log(`Toplam: ${MAYIS_2026.length} gun\n`);

  let inserted = 0;
  let updated = 0;

  for (const gun of MAYIS_2026) {
    const date = new Date(gun.tarih + 'T00:00:00.000Z');

    const existing = await prisma.dailyMenu.findUnique({ where: { date } });

    await prisma.dailyMenu.upsert({
      where: { date },
      create: {
        date,
        items: gun.items,
        notes: gun.notes ?? null,
        isHoliday: gun.isHoliday ?? false,
        holidayName: gun.holidayName ?? null,
        createdByName: 'Sistem - Mayis 2026 Seed',
      },
      update: {
        items: gun.items,
        notes: gun.notes ?? null,
        isHoliday: gun.isHoliday ?? false,
        holidayName: gun.holidayName ?? null,
      },
    });

    if (existing) {
      updated++;
      console.log(`  [GUNCEL] ${gun.tarih} - ${gun.items[1]}`);
    } else {
      inserted++;
      console.log(`  [YENI] ${gun.tarih} - ${gun.items[1]}`);
    }
  }

  console.log('\n--- OZET ---');
  console.log(`Yeni eklenen: ${inserted}`);
  console.log(`Guncellenen: ${updated}`);
  console.log(`Toplam: ${inserted + updated} / ${MAYIS_2026.length}`);

  const mayisCount = await prisma.dailyMenu.count({
    where: {
      date: {
        gte: new Date('2026-05-01T00:00:00.000Z'),
        lte: new Date('2026-05-31T00:00:00.000Z'),
      },
    },
  });
  console.log(`\nDB'de Mayis 2026 toplam kayit: ${mayisCount}`);

  if (mayisCount !== 31) {
    console.error(`HATA: 31 bekleniyor, ${mayisCount} bulundu`);
    process.exit(1);
  }
  console.log('Dogrulama basarili.');
}

main()
  .catch((e) => {
    console.error('HATA:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
