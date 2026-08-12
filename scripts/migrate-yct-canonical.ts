/**
 * Yıllık Çalışma Takvimi canonical veri taşıma script'i.
 *
 * Varsayılan mod dry-run'dır; --confirm olmadan hiçbir veri yazmaz.
 *
 * Kullanım:
 *   npx tsx --env-file=.env scripts/migrate-yct-canonical.ts
 *   npx tsx --env-file=.env scripts/migrate-yct-canonical.ts --confirm
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'

const ANA_SORUMLU_SICIL = 'ILR-00447'
const OLUSTURAN_SICIL = 'ILR-00040'
const EXPECTED_DISTRIBUTION: Record<string, number> = {
  'ÇEVRE': 3, 'DIŞ KONTROL': 16, 'İÇ KONTROL': 3, 'İSG': 4,
  'SÖZLEŞME': 6, 'YASAL BİLDİRİM': 3, 'HUKUK': 2,
}

type Period = 'UC_YILDA_BIR' | 'YILLIK' | 'AYLIK' | 'OZEL' | 'IKI_AYDA_BIR' | 'ALTI_AYLIK' | 'TEK_SEFERLIK'
type State = 'PLANLANDI' | 'TASLAK'
type Row = {
  anaKonu: string; surec: string; disKurum: string | null
  periyot: Period; gecerlilikBaslangici: string | null; plananUygulamaTarihi: string | null
  nihaiSonTarih: string | null; yil: number; durum: State
}

const row = (anaKonu: string, surec: string, disKurum: string | null, periyot: Period,
  gecerlilikBaslangici: string | null, plananUygulamaTarihi: string | null,
  nihaiSonTarih: string | null, yil: number, durum: State): Row => ({
  anaKonu, surec, disKurum, periyot, gecerlilikBaslangici,
  plananUygulamaTarihi, nihaiSonTarih, yil, durum,
})

const records: Row[] = [
  row('ÇEVRE', 'BAĞLANTI İZNİ', 'Dış Kurum', 'UC_YILDA_BIR', '2026-06-15', '2029-05-15', '2029-05-25', 2029, 'PLANLANDI'),
  row('ÇEVRE', 'KİMYASAL DÖKÜNTÜ TATBİKATI', null, 'YILLIK', null, null, null, 2026, 'TASLAK'),
  row('ÇEVRE', 'ATIK BEYANI', null, 'YILLIK', null, null, null, 2026, 'TASLAK'),
  row('DIŞ KONTROL', 'İŞ EKİPMANLARI (TEZGAH/MAKİNE)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-22', '2026-12-01', '2026-12-22', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'BASINÇLI KAPLAR (KOMPRESÖR HAVA TANKI, HİDROFOR/GENLEŞME TANKI, BOYLER/AKÜMÜLASYON TANKI)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-22', '2026-12-01', '2026-12-22', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'KALDIRMA EKİPMANLARI (FORKLİFT, TRANSPALET, İSTİF MAKİNESİ, MONORAY VİNÇ, CARASKAL)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-22', '2026-12-01', '2026-12-22', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'SABİT İNİŞ MAHALLİNE HİZMET VEREN MAKİNE (YÜK ASANSÖRÜ)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-22', '2026-12-01', '2026-12-22', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'SABİTLENMEMİŞ YÜK KALDIRMA ATAŞMANLARI (VAKUMLU SAC KALDIRMA APARATI)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-22', '2026-12-01', '2026-12-22', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'YANGINDAN KORUNMA SİSTEMLERİ (YANGIN SU DEPOSU, YANGIN POMPA İSTASYONU, YANGIN DOLAPLARI, YANGIN HİDRANTI, YAĞMURLAMA SİSTEMLERİ)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'HAVALANDIRMA VE KLİMA TESİSATI', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'YANGIN POMPASI PERFORMANS TESTİ', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'ÇELİK STATİK SAKLAMA SİSTEMLERİ (ENDÜSTRİYEL RAF)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-24', '2026-12-01', '2026-12-24', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'YANGIN SÖNDÜRME CİHAZLARI', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-30', '2026-12-01', '2026-12-30', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'ELEKTRİK TESİSATI (ALÇAK GERİLİM TOPRAKLAMA, İÇ TESİSAT GÖZLE VE FONKSİYON KONTROLÜ)', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'YILDIRIMDAN KORUNMA TESİSATI', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'JENERATÖR', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'TRANSFORMATÖR', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('DIŞ KONTROL', 'ENDÜSTRİYEL KAPI', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2026-01-06', '2026-12-31', '2027-01-06', 2027, 'PLANLANDI'),
  row('DIŞ KONTROL', 'YANGIN ALGILAMA VE UYARI SİSTEMLERİ', 'Akredite Kurum / Satınalma (talep)', 'YILLIK', '2025-12-23', '2026-12-01', '2026-12-23', 2026, 'PLANLANDI'),
  row('İÇ KONTROL', 'MOTOPOMP/HİDRANT YANGIN TÜPLERİ AYLIK İŞLETME İÇİ KONTROLLERİ', 'Bakım', 'AYLIK', '2026-06-01', '2026-07-01', '2026-07-05', 2026, 'PLANLANDI'),
  row('İÇ KONTROL', 'DİSİPLİN KURULU/KVKK', null, 'YILLIK', null, '2026-12-25', '2026-12-30', 2026, 'PLANLANDI'),
  row('İÇ KONTROL', 'ÖNERİ SİSTEMİ', null, 'OZEL', null, '2026-08-01', '2026-08-10', 2026, 'PLANLANDI'),
  row('İSG', 'KURUL TOPLANTISI', null, 'IKI_AYDA_BIR', null, '2026-06-25', '2026-06-25', 2026, 'PLANLANDI'),
  row('İSG', 'TATBİKAT (YANGIN - GENEL TAHLİYE)', null, 'YILLIK', '2026-04-14', '2027-04-01', '2027-04-10', 2027, 'PLANLANDI'),
  row('İSG', 'İLKYARDIM/YETKİLİ PERSONELİN İLK MÜDAHALE KABİLİYETİ VE KONTROLÜ ÖLÇÜLMESİ', 'İş Yeri Hekimi', 'ALTI_AYLIK', null, null, null, 2026, 'TASLAK'),
  row('İSG', 'HİJYEN KONTROL', null, 'TEK_SEFERLIK', null, null, null, 2026, 'TASLAK'),
  row('SÖZLEŞME', 'TRANSAY-SERVİS', 'Satınalma (talep)', 'YILLIK', '2026-01-01', '2026-11-28', '2026-12-30', 2026, 'PLANLANDI'),
  row('SÖZLEŞME', 'TARHANA-YEMEK', 'Satınalma (talep)', 'YILLIK', '2026-01-01', '2026-11-28', '2026-12-30', 2026, 'PLANLANDI'),
  row('SÖZLEŞME', 'AKER-İSG UZMANI İŞ YERİ HEKİMİ', 'Satınalma (talep)', 'YILLIK', '2026-01-01', '2026-11-28', '2026-12-30', 2026, 'PLANLANDI'),
  row('SÖZLEŞME', 'FEN ÇEVRE-ÇEVRE', 'Satınalma (talep)', 'YILLIK', '2026-01-01', '2026-11-28', '2026-12-30', 2026, 'PLANLANDI'),
  row('SÖZLEŞME', 'ERCE-GÜVENLİK', 'Satınalma (talep)', 'YILLIK', '2026-03-01', '2026-11-28', '2026-12-30', 2026, 'PLANLANDI'),
  row('SÖZLEŞME', 'KOLO TEMİZLİK-SANAYİ ATIK', 'Satınalma (talep)', 'YILLIK', '2026-01-01', '2026-11-28', '2026-12-30', 2026, 'PLANLANDI'),
  row('YASAL BİLDİRİM', 'SGK', null, 'AYLIK', null, '2026-06-21', '2026-07-23', 2026, 'PLANLANDI'),
  row('YASAL BİLDİRİM', 'SGK-2', null, 'AYLIK', null, '2026-06-21', '2026-07-23', 2026, 'PLANLANDI'),
  row('YASAL BİLDİRİM', 'E-VİZİTE', null, 'AYLIK', null, '2026-06-21', '2026-07-23', 2026, 'PLANLANDI'),
  row('HUKUK', 'BEYHANİ İKİSİVRİ-24.09.2026 DURUŞMA VAR', 'Avukat', 'TEK_SEFERLIK', null, '2026-09-22', '2026-09-23', 2026, 'PLANLANDI'),
  row('HUKUK', 'SABRİ GEGÖZ-09.07.2026 DURUŞMA VAR', 'Avukat', 'TEK_SEFERLIK', null, '2026-07-07', '2026-07-08', 2026, 'PLANLANDI'),
]

const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
const distribution = (rows: Array<{ anaKonu: string }>) => rows.reduce<Record<string, number>>((acc, item) => {
  acc[item.anaKonu] = (acc[item.anaKonu] ?? 0) + 1
  return acc
}, {})
const countBy = <K extends string | number>(items: Row[], key: (item: Row) => K) => items.reduce<Record<string, number>>((acc, item) => {
  const value = String(key(item)); acc[value] = (acc[value] ?? 0) + 1; return acc
}, {})

async function resolveUserBySicil(sicilNo: string, label: string) {
  const personnel = await prisma.personnel.findUnique({
    where: { sicilNo },
    select: { id: true, sicilNo: true, adSoyad: true, aktif: true },
  })
  if (!personnel) throw new Error(`${label}: Personnel bulunamadı, sicil ${sicilNo}`)
  if (!personnel.aktif) throw new Error(`${label}: Personel aktif değil, sicil ${sicilNo}`)
  const user = await prisma.user.findUnique({
    where: { personnelId: personnel.id },
    select: { id: true, name: true, email: true, isActive: true },
  })
  if (!user) throw new Error(`${label}: Bu personele bağlı User bulunamadı, sicil ${sicilNo}`)
  if (!user.isActive) throw new Error(`${label}: Kullanıcı aktif değil, sicil ${sicilNo}`)
  return user
}

function connectionInfo(databaseUrl: string) {
  const parsed = new URL(databaseUrl)
  return { host: parsed.hostname, port: parsed.port || '5432', database: decodeURIComponent(parsed.pathname.replace(/^\//, '')) }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL tanımlı değil')
  const connection = connectionInfo(databaseUrl)
  console.log(`Bağlantı: host=${connection.host}:${connection.port}, database=${connection.database}`)

  if (records.length !== 37 || JSON.stringify(distribution(records)) !== JSON.stringify(EXPECTED_DISTRIBUTION)) {
    throw new Error('Canonical veri sayısı veya ana konu dağılımı beklenen değerlerle uyuşmuyor')
  }
  const keys = records.map(item => `${item.anaKonu}\u0000${item.surec}\u0000${item.yil}`)
  const duplicateKeys = [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))]
  if (duplicateKeys.length > 0) throw new Error(`Canonical records içinde mükerrer anaKonu+surec+yil var: ${duplicateKeys.join(', ')}`)

  const [department, anaSorumlu, olusturan] = await Promise.all([
    prisma.department.findFirst({
      where: { name: 'İnsan Varlıkları', code: 'IK', isActive: true },
      select: { id: true, name: true, code: true },
    }),
    resolveUserBySicil(ANA_SORUMLU_SICIL, 'Ana Sorumlu'),
    resolveUserBySicil(OLUSTURAN_SICIL, 'Oluşturan'),
  ])
  if (!department) throw new Error('Departman bulunamadı veya aktif değil: İnsan Varlıkları (IK)')

  console.log(`Ana Sorumlu: ${anaSorumlu.name ?? anaSorumlu.id} (sicil ${ANA_SORUMLU_SICIL})`)
  console.log(`Oluşturan: ${olusturan.name ?? olusturan.id} (sicil ${OLUSTURAN_SICIL})`)

  const existing = await prisma.yillikTakvimKaydi.findMany({
    where: { OR: records.map(item => ({ anaKonu: item.anaKonu, surec: item.surec, yil: item.yil })) },
    select: { anaKonu: true, surec: true, yil: true },
  })
  const existingKeys = new Set(existing.map(item => `${item.anaKonu}\u0000${item.surec}\u0000${item.yil}`))
  const pending = records.filter(item => !existingKeys.has(`${item.anaKonu}\u0000${item.surec}\u0000${item.yil}`))

  console.table({
    mod: process.argv.includes('--confirm') ? 'CONFIRM' : 'DRY-RUN',
    toplamCanonical: records.length, eklenecek: pending.length, atlanacak: records.length - pending.length,
    host: `${connection.host}:${connection.port}`, database: connection.database,
    departman: `${department.name} (${department.id})`,
  })
  console.log('\nAna konu dağılımı:'); console.table(Object.entries(distribution(records)).map(([anaKonu, adet]) => ({ anaKonu, adet })))
  console.log('\nYıl dağılımı:'); console.table(Object.entries(countBy(records, item => item.yil)).map(([yil, adet]) => ({ yil, adet })))
  console.log('\nDurum dağılımı:'); console.table(Object.entries(countBy(records, item => item.durum)).map(([durum, adet]) => ({ durum, adet })))
  const suspicious = records.filter(item => item.durum === 'PLANLANDI' && (!item.plananUygulamaTarihi || !item.nihaiSonTarih))
  console.log('\nŞüpheli satırlar (PLANLANDI ve tarih eksik):')
  console.table(suspicious.map(item => ({ yil: item.yil, anaKonu: item.anaKonu, surec: item.surec, plananUygulamaTarihi: item.plananUygulamaTarihi, nihaiSonTarih: item.nihaiSonTarih })))
  console.log('\nTASLAK satırları:')
  console.table(records.filter(item => item.durum === 'TASLAK').map(item => ({ yil: item.yil, anaKonu: item.anaKonu, surec: item.surec })))

  if (!process.argv.includes('--confirm')) {
    console.log('\nDRY-RUN tamamlandı. Hiçbir veri yazılmadı.')
    console.table(pending.map(item => ({ yil: item.yil, anaKonu: item.anaKonu, surec: item.surec })))
    return
  }

  let inserted = 0
  let skipped = records.length - pending.length
  for (const item of pending) {
    const outcome = await prisma.$transaction(async tx => {
      const duplicate = await tx.yillikTakvimKaydi.findFirst({
        where: { anaKonu: item.anaKonu, surec: item.surec, yil: item.yil }, select: { id: true },
      })
      if (duplicate) return false
      const created = await tx.yillikTakvimKaydi.create({ data: {
        yil: item.yil, departmentId: department.id, anaKonu: item.anaKonu, surec: item.surec,
        disKurum: item.disKurum, periyot: item.periyot, durum: item.durum, createdById: olusturan.id,
        ...(item.gecerlilikBaslangici && { gecerlilikBaslangici: utcDate(item.gecerlilikBaslangici) }),
        ...(item.plananUygulamaTarihi && { plananUygulamaTarihi: utcDate(item.plananUygulamaTarihi) }),
        ...(item.nihaiSonTarih && { nihaiSonTarih: utcDate(item.nihaiSonTarih) }),
      }, select: { id: true } })
      await tx.yillikTakvimKatilimci.create({ data: { kayitId: created.id, userId: anaSorumlu.id, rol: 'ANA_SORUMLU' } })
      await tx.yillikTakvimIslemGecmisi.create({ data: { kayitId: created.id, islemTuru: 'OLUSTUR', yapanId: olusturan.id, alan: 'seed-canonical-prod-migration' } })
      return true
    })
    if (outcome) inserted += 1
    else skipped += 1
  }

  const [total, grouped, invalidRelations] = await Promise.all([
    prisma.yillikTakvimKaydi.count(),
    prisma.yillikTakvimKaydi.groupBy({ by: ['anaKonu'], _count: { _all: true } }),
    prisma.yillikTakvimKaydi.count({ where: { OR: [
      { katilimcilar: { none: { userId: anaSorumlu.id, rol: 'ANA_SORUMLU' } } },
      { islemGecmisi: { none: { yapanId: olusturan.id, islemTuru: 'OLUSTUR', alan: 'seed-canonical-prod-migration' } } },
    ] } }),
  ])
  const actualDistribution = Object.fromEntries(grouped.map(item => [item.anaKonu, item._count._all]))
  console.table({ inserted, skipped, total, invalidRelations })
  console.table(grouped.map(item => ({ anaKonu: item.anaKonu, adet: item._count._all })))
  if (total !== 37 || invalidRelations !== 0 || JSON.stringify(actualDistribution) !== JSON.stringify(EXPECTED_DISTRIBUTION)) {
    throw new Error('Confirm sonrası doğrulama başarısız: toplam, dağılım veya ilişkiler beklenen durumda değil')
  }
  console.log('Canonical YCT veri taşıma ve doğrulama başarıyla tamamlandı.')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}).finally(async () => prisma.$disconnect())
