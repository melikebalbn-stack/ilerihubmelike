/**
 * Servis Yönetimi — Personnel.serviceRoute/serviceStop GÖÇ SCRIPT'İ.
 *
 * BU BİR MIGRATION DEĞİLDİR. prisma/ dizinine yazmaz, migration üretmez.
 * Kanonik kaynak YALNIZ Personnel — User.serviceRoute/serviceStop hiç
 * OKUNMAZ (yalnız --check-conflicts tanı listesinde GÖSTERİM amaçlı
 * karşılaştırılır, Personnel'in üzerine hiç yazılmaz).
 * OvertimePersonnel.serviceRoute bu script'te HİÇ okunmaz (sözlük
 * doğrulaması ayrı bir adım, bu script'in kapsamı dışında).
 *
 * DRY-RUN VARSAYILAN. --apply bayrağı olmadan hiçbir yazma işlemi olmaz.
 * --apply modu, servis_guzergah/servis_durak/servis_personel_atama/
 * servis_personel_durum/servis_islem_gecmisi tablolarının GERÇEKTEN var
 * olmasını gerektirir (bkz. faz1-a-kapsami-migration.sql) — bu yüzden
 * Servis* tabloları PRISMA CLIENT'TA HENÜZ TANIMLI DEĞİL (migration
 * uygulanmadı) ve bu tablolara erişim TİPLİ PRISMA API'Sİ YERİNE
 * $queryRaw/$executeRaw ile yapılır — aksi halde bu script migration
 * uygulanana kadar DERLENEMEZ bile. Dry-run modu YALNIZ Personnel/User
 * (mevcut, tipli) okuduğu için migration'dan ÖNCE de sorunsuz çalışır.
 *
 * Çalıştırma:
 *   npx tsx --env-file=.env docs/servis-yonetimi/goc-personnel-servis-atama.ts --db=<beklenen_db_adi>
 *   npx tsx --env-file=.env docs/servis-yonetimi/goc-personnel-servis-atama.ts --db=<beklenen_db_adi> --apply
 *
 * --db ZORUNLU: script, DATABASE_URL'in bağlandığı current_database()'i
 * bu değerle karşılaştırır, uyuşmazsa DURUR. "Yanlış ortamda kazayla
 * çalıştırma" riskine karşı tek kapı budur — env doğru olsa bile operatör
 * hedefi AÇIKÇA yazmak zorunda.
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '/home/elif/ilerihub/src/generated/prisma'

// ============================================================================
// TR-NORMALİZE — upper(translate(...)) + [^A-Z0-9] deseni, DÜZ upper() YOK.
// ============================================================================

const TR_MAP: Record<string, string> = {
  ç: 'C', ğ: 'G', ş: 'S', ö: 'O', ü: 'U', ı: 'I', İ: 'I',
  Ç: 'C', Ğ: 'G', Ş: 'S', Ö: 'O', Ü: 'U',
}

function normalizeTR(input: string | null | undefined): string {
  if (!input) return ''
  const translated = input
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
  // toUpperCase() (locale'siz) — translate SONRASI çağrılıyor, artık Türkçe
  // özel karakter kalmadığı için 'i'.toUpperCase() güvenle 'I' verir
  // (toLocaleUpperCase('tr') KULLANILMADI — o, İ/I hatasını AYNEN üretirdi).
  return translated.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// ============================================================================
// SÖZLÜK — MASTER md ve prod envanterinden (servis-veri-envanteri-20260823.txt)
// ============================================================================

const CANONICAL_ROUTES = [
  'ARAPÇEŞME', 'AYDOS-KURTKÖY', 'BEYLİKBAĞI GÜZELTEPE', 'BEYLİKBAĞI ULAŞTEPE',
  'DARICA', 'GEBZE DEVELİ', 'İZMİT', 'KAVACIK-BEYKOZ', 'KAYNARCA-KARTAL',
  'KAYNARCA PENDİK', 'TOSB SERVİS', 'ÜSKÜDAR',
]
const CANONICAL_ROUTE_BY_NORM = new Map(CANONICAL_ROUTES.map((r) => [normalizeTR(r), r]))

// Karara bağlı, EŞLEŞTİRME YAPILMAYAN terimler — İK karar verecek. Bunlar
// canonik sözlükte YOK, ayrı bir kova (normalizeTR ile canonical'a otomatik
// eşleşmeyen ama bilinen/isimlendirilmiş terimler).
const KARARA_BAGLI_TERIMLER = ['ARAPEŞME', 'GEBZE', 'BELEDİYE', 'BEYKOZ KAVACIK']
const KARARA_BAGLI_NORM = new Set(KARARA_BAGLI_TERIMLER.map(normalizeTR))

const KENDI_GELIYOR_NORM = normalizeTR('KENDİ GELİYOR')

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const dbArg = args.find((a) => a.startsWith('--db='))
const EXPECTED_DB = dbArg?.slice('--db='.length)

if (!EXPECTED_DB) {
  console.error('❌ --db=<beklenen_veritabani_adi> ZORUNLU. Örnek: --db=ilerihub_dev_elif')
  process.exit(1)
}

// ============================================================================
// SINIFLANDIRMA TİPLERİ
// ============================================================================

type PersonelRow = {
  id: string
  sicilNo: string | null
  serviceRoute: string | null
  serviceStop: string | null
  aktif: boolean
}

type Siniflandirma =
  | { tur: 'ROTA_COZULDU'; kanonikRota: string; durak: string | null }
  | { tur: 'KARARA_BAGLI'; hamDeger: string }
  | { tur: 'KENDI_GELIYOR'; durakVarMi: boolean }
  | { tur: 'ESLESMEDI_ROTA'; hamDeger: string }
  | { tur: 'DURAK_VAR_ROTA_YOK'; durak: string }
  | { tur: 'BOS' } // ne route ne stop dolu — bu sorguya hiç girmemeli ama savunma amaçlı

function siniflandir(row: PersonelRow): Siniflandirma {
  const route = row.serviceRoute?.trim() || ''
  const stop = row.serviceStop?.trim() || ''

  if (!route && !stop) return { tur: 'BOS' }
  if (!route && stop) return { tur: 'DURAK_VAR_ROTA_YOK', durak: stop }

  const normRoute = normalizeTR(route)
  if (normRoute === KENDI_GELIYOR_NORM) return { tur: 'KENDI_GELIYOR', durakVarMi: !!stop }

  const kanonik = CANONICAL_ROUTE_BY_NORM.get(normRoute)
  if (kanonik) return { tur: 'ROTA_COZULDU', kanonikRota: kanonik, durak: stop || null }

  if (KARARA_BAGLI_NORM.has(normRoute)) return { tur: 'KARARA_BAGLI', hamDeger: route }

  return { tur: 'ESLESMEDI_ROTA', hamDeger: route }
}

// ============================================================================
// ANA AKIŞ
// ============================================================================

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  const bugun = new Date().toISOString().slice(0, 10)

  try {
    // --- Güvenlik kapısı: yalnız beklenen DB'ye izin ver ---
    const [{ current_database: actualDb }] = await prisma.$queryRaw<{ current_database: string }[]>`
      SELECT current_database()
    `
    if (actualDb !== EXPECTED_DB) {
      console.error(
        `❌ Bağlanılan veritabanı ("${actualDb}") --db ile verilen ("${EXPECTED_DB}") ile UYUŞMUYOR. Durduruldu — yanlış ortamda kazayla çalışma riski.`
      )
      process.exit(1)
    }
    console.log(`✅ Veritabanı doğrulandı: ${actualDb}${APPLY ? ' — APPLY MODU' : ' — DRY-RUN'}\n`)

    if (APPLY) {
      // Servis* tabloları migration'dan ÖNCE yoktur — erken ve net hata ver.
      try {
        await prisma.$queryRaw`SELECT 1 FROM "servis_guzergah" LIMIT 1`
      } catch {
        console.error(
          '❌ "servis_guzergah" tablosu yok. Migration henüz uygulanmamış (bkz. faz1-a-kapsami-migration.sql). --apply modu buna ihtiyaç duyuyor.'
        )
        process.exit(1)
      }
    }

    // --- Kaynak veri A: sınıflandırmaya girecek AKTİF + (route veya stop dolu) kayıtlar ---
    const personelKayitlari = await prisma.personnel.findMany({
      where: {
        aktif: true,
        OR: [
          { serviceRoute: { not: null } },
          { serviceStop: { not: null } },
        ],
      },
      select: { id: true, sicilNo: true, serviceRoute: true, serviceStop: true, aktif: true },
    })

    // --- Kaynak veri B: "göçe alınmadı" listesi — Personnel.aktif = false olan
    // TÜM kayıtlar, route/stop dolu olsun olmasın. Belirli bir sayıya denk
    // gelmesi ARANMIYOR — DB'de ne varsa odur.
    const tumPasifKayitlar = await prisma.personnel.findMany({
      where: { aktif: false },
      select: { id: true, sicilNo: true, serviceRoute: true, serviceStop: true, aktif: true },
    })

    // --- (4) Çelişkili kayıt tanısı: User vs Personnel, YALNIZ GÖSTERİM ---
    // Kanonik kaynak Personnel'dir; bu liste sessizce Personnel alındığını
    // KANITLAMAK için var, User'daki değer HİÇBİR ZAMAN kullanılmaz/yazılmaz.
    const cakismalar: { sicilNo: string | null; uRoute: string | null; pRoute: string | null; uStop: string | null; pStop: string | null }[] = []
    {
      const usersWithPersonnel = await prisma.user.findMany({
        where: {
          personnelId: { not: null },
          OR: [{ serviceRoute: { not: null } }, { serviceStop: { not: null } }],
        },
        select: { serviceRoute: true, serviceStop: true, personnel: { select: { sicilNo: true, serviceRoute: true, serviceStop: true } } },
      })
      for (const u of usersWithPersonnel) {
        if (!u.personnel) continue
        const routeDiff = normalizeTR(u.serviceRoute) !== normalizeTR(u.personnel.serviceRoute) && (u.serviceRoute || u.personnel.serviceRoute)
        const stopDiff = normalizeTR(u.serviceStop) !== normalizeTR(u.personnel.serviceStop) && (u.serviceStop || u.personnel.serviceStop)
        if (routeDiff || stopDiff) {
          cakismalar.push({
            sicilNo: u.personnel.sicilNo,
            uRoute: u.serviceRoute,
            pRoute: u.personnel.serviceRoute,
            uStop: u.serviceStop,
            pStop: u.personnel.serviceStop,
          })
        }
      }
    }

    // --- Sınıflandırma ---
    const gocEdecek: { row: PersonelRow; sinif: Extract<Siniflandirma, { tur: 'ROTA_COZULDU' }> }[] = []
    const kararaBagli = new Map<string, PersonelRow[]>() // hamDeger -> rows
    const kendiGeliyor: { row: PersonelRow; durakVarMi: boolean }[] = []
    const eslesmedi: { row: PersonelRow; hamDeger: string }[] = []
    const durakVarRotaYok: PersonelRow[] = []
    const goceAlinmadi: PersonelRow[] = tumPasifKayitlar // Personnel.aktif=false TÜMÜ — route/stop dolu şartı YOK
    const durakEksik: PersonelRow[] = [] // rota var, durak yok (aktif + ROTA_COZULDU + durak boş)
    const dilimTanimsiz: PersonelRow[] = [] // = gocEdecek ile birebir (kaynakta dilim yok)

    for (const raw of personelKayitlari) {
      const row: PersonelRow = raw
      const sinif = siniflandir(row)
      switch (sinif.tur) {
        case 'ROTA_COZULDU':
          gocEdecek.push({ row, sinif })
          dilimTanimsiz.push(row)
          if (!sinif.durak) durakEksik.push(row)
          break
        case 'KARARA_BAGLI':
          if (!kararaBagli.has(sinif.hamDeger)) kararaBagli.set(sinif.hamDeger, [])
          kararaBagli.get(sinif.hamDeger)!.push(row)
          break
        case 'KENDI_GELIYOR':
          kendiGeliyor.push({ row, durakVarMi: sinif.durakVarMi })
          break
        case 'ESLESMEDI_ROTA':
          eslesmedi.push({ row, hamDeger: sinif.hamDeger })
          break
        case 'DURAK_VAR_ROTA_YOK':
          durakVarRotaYok.push(row)
          break
        case 'BOS':
          break // sorguya girmemeliydi, savunma amaçlı — hiçbir listeye düşmez
      }
    }

    // --- (1) Güzergah sözlüğü önerisi ---
    const guzergahOzet = new Map<string, number>()
    for (const g of gocEdecek) guzergahOzet.set(g.sinif.kanonikRota, (guzergahOzet.get(g.sinif.kanonikRota) || 0) + 1)

    // --- (3) Durak sözlüğü önerisi — (rota_etiketi, ham_durak) -> kişi sayısı ---
    // "rota_etiketi": çözülen kanonik rota adı. Yalnız ROTA_COZULDU + durak dolu
    // kayıtlar dahil edilir (rota belirsizken durağı bir güzergaha bağlamak
    // TAHMİN olur — kapsam dışı, bkz. 5/6 listeleri).
    const durakSozlugu = new Map<string, { rota: string; durak: string; kisiSayisi: number }>()
    for (const g of gocEdecek) {
      if (!g.sinif.durak) continue
      const key = `${g.sinif.kanonikRota}||${g.sinif.durak}`
      if (!durakSozlugu.has(key)) durakSozlugu.set(key, { rota: g.sinif.kanonikRota, durak: g.sinif.durak, kisiSayisi: 0 })
      durakSozlugu.get(key)!.kisiSayisi++
    }
    // Aynı isimli durak, farklı güzergahlarda mı geçiyor? (GARANTİ BANKASI / CEZAEVİ KAPISI vakaları)
    const durakAdiGuzergahSayisi = new Map<string, Set<string>>()
    for (const { rota, durak } of durakSozlugu.values()) {
      const normDurak = normalizeTR(durak)
      if (!durakAdiGuzergahSayisi.has(normDurak)) durakAdiGuzergahSayisi.set(normDurak, new Set())
      durakAdiGuzergahSayisi.get(normDurak)!.add(rota)
    }
    function durakKoduOner(rota: string, durak: string): string {
      const rotaKisaltma = normalizeTR(rota).slice(0, 3)
      const durakKisaltma = normalizeTR(durak).slice(0, 8)
      return `${rotaKisaltma}-${durakKisaltma}`
    }

    // --- (10) BİLGİ AMAÇLI — karara bağlı 4 terim, HER KAYNAK + HER AKTİFLİK
    // DURUMU, filtre uygulanmadan. Göç kararını ETKİLEMEZ, ayrı başlıkta.
    const karara10Personnel = await prisma.personnel.findMany({
      where: { serviceRoute: { not: null } },
      select: { sicilNo: true, serviceRoute: true, aktif: true },
    })
    const karara10PersonnelEslesen = karara10Personnel.filter((p) => KARARA_BAGLI_NORM.has(normalizeTR(p.serviceRoute)))

    const karara10User = await prisma.user.findMany({
      where: { serviceRoute: { not: null } },
      select: { email: true, name: true, serviceRoute: true, personnel: { select: { sicilNo: true } } },
    })
    const karara10UserEslesen = karara10User.filter((u) => KARARA_BAGLI_NORM.has(normalizeTR(u.serviceRoute)))

    const karara10Overtime = await prisma.overtimePersonnel.findMany({
      where: { serviceRoute: { not: null } },
      select: { serviceRoute: true, personnel: { select: { sicilNo: true } } },
    })
    const karara10OvertimeEslesen = karara10Overtime.filter((o) => KARARA_BAGLI_NORM.has(normalizeTR(o.serviceRoute)))

    // ========================================================================
    // RAPOR — dosyaya TAM liste (KVKK: sicil no içerir, repo dışında kalır),
    // konsola yalnız TOPLAM + örnek (en fazla 5 sicil).
    // ========================================================================

    const dosyaSatirlari: string[] = []
    const yaz = (s: string) => dosyaSatirlari.push(s)

    function ozetVeYaz(baslik: string, tumSatirlar: string[]) {
      console.log(`═══ ${baslik} ═══`)
      console.log(`  TOPLAM: ${tumSatirlar.length}`)
      if (tumSatirlar.length > 0) {
        console.log(`  Örnek (ilk ${Math.min(5, tumSatirlar.length)}):`)
        for (const s of tumSatirlar.slice(0, 5)) console.log(`    ${s}`)
      }
      console.log()
      yaz(`═══ ${baslik} ═══`)
      yaz(`TOPLAM: ${tumSatirlar.length}`)
      for (const s of tumSatirlar) yaz(`  ${s}`)
      yaz('')
    }

    console.log('\n────────── ANA 9 LİSTE ──────────\n')
    yaz('────────── ANA 9 LİSTE ──────────\n')

    ozetVeYaz(
      '1) GÜZERGAH SÖZLÜĞÜ ÖNERİSİ',
      [...guzergahOzet.entries()].sort((a, b) => b[1] - a[1]).map(([rota, adet]) => `${rota} → ${adet} kişi`)
    )

    ozetVeYaz(
      '2) KARARA BAĞLI TEKİLLER (EŞLEŞTİRME YAPILMADI — İK kararı, yalnız aktif+Personnel kaynaklı)',
      [...kararaBagli.entries()].map(([terim, rows]) => `${terim} (${rows.length}): ${rows.map((r) => r.sicilNo).join(', ')}`)
    )

    ozetVeYaz(
      '3) DURAK SÖZLÜĞÜ ÖNERİSİ',
      [...durakSozlugu.values()]
        .sort((a, b) => a.rota.localeCompare(b.rota) || a.durak.localeCompare(b.durak))
        .map(({ rota, durak, kisiSayisi }) => {
          const cakisiyorMu = durakAdiGuzergahSayisi.get(normalizeTR(durak))!.size > 1
          const kod = durakKoduOner(rota, durak)
          return `(${rota}, "${durak}") → önerilen kod: ${kod} [${kisiSayisi} kişi]${cakisiyorMu ? ' ⚠️ AYNI İSİM FARKLI GÜZERGAHTA DA VAR' : ''}`
        })
    )

    ozetVeYaz(
      '4) ÇELİŞKİLİ KAYIT (User≠Personnel — Personnel SESSİZCE ALINDI, yalnız tanı)',
      cakismalar.map((c) => `${c.sicilNo}: User(route="${c.uRoute ?? ''}", stop="${c.uStop ?? ''}") vs Personnel(route="${c.pRoute ?? ''}", stop="${c.pStop ?? ''}")`)
    )

    ozetVeYaz(
      '5) DURAK EKSİK (güzergah var, durak yok)',
      durakEksik.map((row) => `${row.sicilNo}: güzergah="${row.serviceRoute}"`)
    )

    ozetVeYaz('6a) EŞLEŞMEDİ — durak var, güzergah yok', durakVarRotaYok.map((row) => `${row.sicilNo}: durak="${row.serviceStop}"`))
    ozetVeYaz('6b) EŞLEŞMEDİ — sözlükte karşılığı olmayan güzergah', eslesmedi.map(({ row, hamDeger }) => `${row.sicilNo}: "${hamDeger}"`))

    ozetVeYaz(
      '7) GÖÇE ALINMADI (Personnel.aktif = false — TÜMÜ, route/stop şartı yok)',
      goceAlinmadi.map((r) => `${r.sicilNo}${r.serviceRoute || r.serviceStop ? ` (route="${r.serviceRoute ?? ''}", stop="${r.serviceStop ?? ''}")` : ' (route/stop boş)'}`)
    )

    ozetVeYaz(
      '8) KENDİ GELİYOR',
      kendiGeliyor.map(({ row, durakVarMi }) => `${row.sicilNo}${durakVarMi ? ` ⚠️ durak dolu (${row.serviceStop})` : ''}`)
    )

    ozetVeYaz(
      '9) DİLİMİ TANIMLANMAMIŞ (göçten gelen TÜM atamalar)',
      dilimTanimsiz.map((r) => r.sicilNo || '(sicilNo yok)')
    )

    console.log('────────── BİLGİ AMAÇLI 10. LİSTE (göç kararını ETKİLEMEZ) ──────────\n')
    yaz('\n────────── BİLGİ AMAÇLI 10. LİSTE (göç kararını ETKİLEMEZ) ──────────\n')

    ozetVeYaz(
      '10a) Personnel — ARAPEŞME/GEBZE/BELEDİYE/BEYKOZ KAVACIK (aktif+pasif, filtre YOK)',
      karara10PersonnelEslesen.map((p) => `${p.sicilNo} (aktif=${p.aktif}): "${p.serviceRoute}"`)
    )
    ozetVeYaz(
      '10b) User — aynı terimler (filtre YOK)',
      karara10UserEslesen.map((u) => `${u.personnel?.sicilNo ?? u.email ?? u.name ?? '(kimliksiz)'}: "${u.serviceRoute}"`)
    )
    ozetVeYaz(
      '10c) OvertimePersonnel — aynı terimler (filtre YOK)',
      karara10OvertimeEslesen.map((o) => `${o.personnel.sicilNo ?? '(sicilNo yok)'}: "${o.serviceRoute}"`)
    )

    // ========================================================================
    // ÖZET
    // ========================================================================
    console.log('═══ ÖZET ═══')
    console.log(`  Aktif + route/stop dolu Personnel:          ${personelKayitlari.length}`)
    console.log(`  Göçe önerilen (rotaya çözüldü, aktif):      ${gocEdecek.length}`)
    console.log(`  Karara bağlı (aktif, Personnel-kaynaklı):   ${[...kararaBagli.values()].flat().length}`)
    console.log(`  Eşleşmedi (aktif, 6a+6b):                   ${durakVarRotaYok.length + eslesmedi.length}`)
    console.log(`  Göçe alınmadı (Personnel.aktif=false, tümü): ${goceAlinmadi.length}`)
    console.log(`  KENDİ GELİYOR (aktif):                      ${kendiGeliyor.length}`)
    console.log(`  Çelişkili (User vs Personnel, tanı amaçlı): ${cakismalar.length}`)
    console.log(`  Durak eksik (rotaya çözülenler içinde):     ${durakEksik.length}`)
    console.log(`  [Bilgi] karara-bağlı terim geçen Personnel (aktif+pasif): ${karara10PersonnelEslesen.length}, User: ${karara10UserEslesen.length}, OvertimePersonnel: ${karara10OvertimeEslesen.length}`)

    const fs = await import('node:fs')
    const raporYolu = `/home/elif/servis-envanter/goc-dry-run-${bugun}-${Date.now()}.txt`
    fs.writeFileSync(raporYolu, dosyaSatirlari.join('\n'), { mode: 0o600 })
    console.log(`\n📄 Tam liste (KVKK — sicil no içerir) dosyaya yazıldı: ${raporYolu}`)

    if (!APPLY) {
      console.log('\n(DRY-RUN — hiçbir şey yazılmadı. --apply ile gerçek yazım yapılır, bu oturumda KULLANILMADI.)')
      return
    }

    // ========================================================================
    // --apply — yalnız ROTA_COZULDU + KENDI_GELIYOR yazılır.
    // Karara-bağlı / eşleşmedi / durak-eksik / pasif hiçbir şekilde YAZILMAZ.
    // Servis* tabloları Prisma Client'ta tanımlı OLMADIĞI için ($queryRaw/
    // $executeRaw ile, bkz. dosya başı gerekçe) — master veri (ServisGuzergah/
    // ServisDurak) BU SCRIPT TARAFINDAN OLUŞTURULMAZ, yalnız ARANIR. Yoksa o
    // kayıt hatayla ATLANIR (kayıt bazlı, diğerlerine devam edilir).
    // ========================================================================
    let yazilan = 0
    let atlananIdempotent = 0
    let hatali = 0

    for (const { row, sinif } of gocEdecek) {
      try {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "servis_personel_atama"
            WHERE "personnelId" = ${row.id} AND "atamaKaynagi" = 'IMPORT' AND "aktif" = true
            LIMIT 1
          `
          if (existing.length > 0) {
            atlananIdempotent++
            return
          }

          const guzergah = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "servis_guzergah" WHERE "kod" = ${sinif.kanonikRota} OR "ad" = ${sinif.kanonikRota} LIMIT 1
          `
          if (guzergah.length === 0) throw new Error(`ServisGuzergah bulunamadı: ${sinif.kanonikRota}`)

          let durakId: string | null = null
          if (sinif.durak) {
            const kod = durakKoduOner(sinif.kanonikRota, sinif.durak)
            const durak = await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM "servis_durak" WHERE "kod" = ${kod} OR "ad" = ${sinif.durak} LIMIT 1
            `
            if (durak.length === 0) throw new Error(`ServisDurak bulunamadı: (${sinif.kanonikRota}, ${sinif.durak})`)
            durakId = durak[0].id
          }

          const inserted = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO "servis_personel_atama"
              ("id", "personnelId", "guzergahId", "durakId", "baslangicTarihi", "bitisTarihi", "aktif", "atamaKaynagi", "createdAt", "updatedAt")
            VALUES
              (gen_random_uuid()::text, ${row.id}, ${guzergah[0].id}, ${durakId}, ${bugun}::date, NULL, true, 'IMPORT', now(), now())
            RETURNING id
          `
          await tx.$executeRaw`
            INSERT INTO "servis_islem_gecmisi"
              ("id", "hedefTipi", "hedefId", "islem", "yeniDeger", "userId", "tarih", "aciklama")
            VALUES
              (gen_random_uuid()::text, 'PERSONEL_ATAMA', ${inserted[0].id}, 'OLUSTURMA',
               ${JSON.stringify({ personnelId: row.id, sicilNo: row.sicilNo, guzergah: sinif.kanonikRota, durak: sinif.durak })}::jsonb,
               NULL, now(), 'Göç script — Personnel.serviceRoute/serviceStop importu')
          `
        })
        yazilan++
      } catch (e) {
        hatali++
        console.error(`  ❌ ${row.sicilNo} atlandı: ${(e as Error).message}`)
      }
    }

    for (const { row } of kendiGeliyor) {
      try {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "servis_personel_durum"
            WHERE "personnelId" = ${row.id} AND "aktif" = true
            LIMIT 1
          `
          if (existing.length > 0) {
            atlananIdempotent++
            return
          }
          const inserted = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO "servis_personel_durum"
              ("id", "personnelId", "durum", "baslangicTarihi", "bitisTarihi", "aktif", "createdAt", "updatedAt")
            VALUES
              (gen_random_uuid()::text, ${row.id}, 'KENDI_GELIYOR', ${bugun}::date, NULL, true, now(), now())
            RETURNING id
          `
          await tx.$executeRaw`
            INSERT INTO "servis_islem_gecmisi"
              ("id", "hedefTipi", "hedefId", "islem", "yeniDeger", "userId", "tarih", "aciklama")
            VALUES
              (gen_random_uuid()::text, 'PERSONEL_DURUM', ${inserted[0].id}, 'OLUSTURMA',
               ${JSON.stringify({ personnelId: row.id, sicilNo: row.sicilNo, durum: 'KENDI_GELIYOR' })}::jsonb,
               NULL, now(), 'Göç script — Personnel.serviceRoute importu')
          `
        })
        yazilan++
      } catch (e) {
        hatali++
        console.error(`  ❌ ${row.sicilNo} (KENDİ_GELİYOR) atlandı: ${(e as Error).message}`)
      }
    }

    console.log(`\n═══ APPLY ÖZET ═══`)
    console.log(`  Yazılan: ${yazilan}`)
    console.log(`  Zaten göçürülmüş (idempotent atlandı): ${atlananIdempotent}`)
    console.log(`  Hatalı (atlandı): ${hatali}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
