/**
 * IT zimmet listesi (09.2026) → ZimmetFormu devir onay akışına toplu aktarım.
 *
 * Kayıtlar kaynak=SYTELINE_DEVIR, durum=ONAY_BEKLIYOR, sonBildirimTarihi=NULL
 * ile yazılır; sahibi kendi "Zimmetlerim" ekranından KABUL/RED verir.
 * BİLDİRİM YOK: hiçbir notification/dispatch/mail fonksiyonu çağrılmaz —
 * bildirim canlıya alma günü liste ekranından (devir-bildirim-gonder) tetiklenir.
 *
 * Girdi CSV kolonları:
 *   ref, sayfa, excel_satir, islem, sebep, zimmet_sahibi_excel, zimmet_sahibi_eslestir,
 *   departman, tur, turDiger, marka_model, seriNumarasi, macAdresi, imeiNumarasi,
 *   pcAdi, ozellik, altZimmetSahibi, zimmet_tarihi, aciklama
 *
 * Kararlar (satır başına bir tane):
 *   YENI            eşleşen mevcut kayıt yok → yeni kayıt
 *   ATLA            aynı sahipte imzasız kayıt zaten var
 *   ATLA_ZATEN_VAR  id=ref kaydı zaten var (idempotent tekrar çalıştırma)
 *   ATLA_IMZALI     aynı sahipte ONAYLANDI / e-imzalı kayıt zaten var
 *   TASI            başka sahipte imzasız kayıt → eskisi soft-delete, yenisi açılır
 *   YENILE          (--yenile) ATLA yerine: imzasız eski kayıt soft-delete, itdevir-<ref> açılır
 *                   (ATLA_IMZALI --yenile ile de korunur)
 *   TASI_IMZALI     eşleşen imzalı kayıt başka sahipte → liste esas: eskisi soft-delete, itdevir-<ref> açılır
 *                   (çoklu eşleşmede --coklu-birlestir ile; liste sahibinin imzalı kaydı yoksa)
 *   IMZALI_CAKISMA  çoklu eşleşmede liste sahibinin imzalı kaydı da var → DOKUNULMAZ
 *   COKLU_ESLESME   birden fazla mevcut kayıt (veya aynı kaydı birden fazla satır) eşleşti
 *   SAHIP_BELIRSIZ  sahip TAM eşleşmedi / yalnız kısmi / yalnız pasif hesap
 *   TANIM_YOK       DIGER türünde turDiger ZimmetTanim'da yok
 *   ANAHTARSIZ      seri/IMEI/MAC'i olmayan satır (depo veya normal) → eşleştirme yapılamaz, yeni kayıt açılır
 *   BEKLET/ENVANTER islem kolonundan — yalnız rapora yazılır
 *
 * Kullanım (worktree kökünden):
 *   npx tsx --env-file=<.env yolu> scripts/zimmet/it-devir-import.ts <csv> --created-by <User.id>
 *       [--override <json>] [--coklu-birlestir] [--yenile] [--envanter-sahibi <User.id>] [--apply --db-name <ad>]
 *   --envanter-sahibi: islem=ENVANTER satırları depo kaydı olarak yazılır — sahip ve iadeAlan = bu kullanıcı,
 *   cihazDurumu=PASIF, iadeTarihi=aktarım anı, aciklama "[IT listesi 09.2026] Depo · …". Eşleştirme kuralları aynı.
 *   Verilmezse ENVANTER yalnız rapora.
 *   Varsayılan DRY-RUN: tüm kararları hesaplar, hiçbir şey yazmaz.
 *   --apply: tek transaction; --db-name current_database() ile aynı değilse durur.
 *   Kişi eşleştirme override'ı: {"Excel adı": "User.id"}. --override <yol> verilirse dosya zorunlu
 *   (yoksa durur); verilmezse ~/zimmet_kisi_eslestirme.json varsa kullanılır.
 *
 * Geri alma: scripts/zimmet/it-devir-geri-al.ts (apply raporunu girdi alır).
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, ZimmetCihazDurumu, ZimmetKaynak, ZimmetOnayDurumu, ZimmetTuru } from '../../src/generated/prisma'
import { normalizeTr } from '../../src/lib/normalize-tr'
import { esitlikIcinNormalize } from '../../src/lib/zimmet/arama'
import {
  anahtarNormalize,
  csvOku,
  csvYaz,
  argDeger,
  raporYolu,
  ESKI_SILEN_KARARLAR,
} from './it-devir-ortak'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const APPLY = process.argv.includes('--apply')
const COKLU_BIRLESTIR = process.argv.includes('--coklu-birlestir')
const YENILE = process.argv.includes('--yenile')
const CSV_YOLU = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const CREATED_BY = argDeger('--created-by')
const DB_NAME = argDeger('--db-name')
// --override verilirse dosya ZORUNLU (yoksa durur); verilmezse varsayılan dosya varsa kullanılır.
const OVERRIDE_ARG = argDeger('--override')
const OVERRIDE_YOLU = OVERRIDE_ARG ?? path.join(os.homedir(), 'zimmet_kisi_eslestirme.json')
// --envanter-sahibi verilirse islem=ENVANTER satırları depo kaydı olarak yazılır (verilmezse yalnız rapora).
const ENVANTER_SAHIBI_ID = argDeger('--envanter-sahibi')
const DEPO_ACIKLAMA_ONEKI = '[IT listesi 09.2026] Depo'

const TUR_DEGERLERI = new Set<string>(Object.values(ZimmetTuru))
const BLUECOLLAR_DOMAIN = '@bluecollar.ilerigroup.com'

type Satir = Record<string, string>
type Karar =
  | 'YENI'
  | 'ATLA'
  | 'ATLA_ZATEN_VAR'
  | 'ATLA_IMZALI'
  | 'TASI'
  | 'YENILE'
  | 'TASI_IMZALI'
  | 'IMZALI_CAKISMA'
  | 'COKLU_ESLESME'
  | 'SAHIP_BELIRSIZ'
  | 'TANIM_YOK'
  | 'ANAHTARSIZ'
  | 'BEKLET'
  | 'ENVANTER'

type Sonuc = {
  satir: Satir
  karar: Karar
  sahipAdi: string
  userId: string | null
  eskiIdler: string[]
  sebep: string
  depo: boolean
}

type Kullanici = { id: string; name: string | null; firstName: string | null; lastName: string | null; email: string; isActive: boolean }
type MevcutKayit = {
  id: string
  zimmetSahibiId: string
  durum: ZimmetOnayDurumu
  zimmetSahibiImzaTarihi: Date | null
  seriNumarasi: string | null
  imeiNumarasi: string | null
  macAdresi: string | null
}

// Ad karşılaştırması: normalizeTr + fazla boşluk + " | ILERI" gibi ekler temizlenir.
function adNormalize(ad: string | null | undefined): string {
  return normalizeTr((ad ?? '').split('|')[0]).replace(/\s+/g, ' ').trim()
}

function imzali(k: MevcutKayit): boolean {
  return k.durum === ZimmetOnayDurumu.ONAYLANDI || k.zimmetSahibiImzaTarihi !== null
}

function tarihCoz(deger: string): Date | null {
  const s = deger.trim()
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) throw new Error(`Geçersiz zimmet_tarihi (YYYY-AA-GG bekleniyor): "${s}"`)
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) throw new Error(`Geçersiz zimmet_tarihi: "${s}"`)
  return d
}

function bos(v: string | undefined): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

async function main() {
  if (!CSV_YOLU) throw new Error('Kullanım: it-devir-import.ts <csv> --created-by <User.id> [--apply --db-name <ad>]')
  if (!CREATED_BY) throw new Error('--created-by <User.id> zorunlu')

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
  if (APPLY) {
    if (!DB_NAME) throw new Error('--apply için --db-name <ad> zorunlu')
    if (DB_NAME !== db) throw new Error(`GÜVENLİK DURDU: --db-name "${DB_NAME}" ≠ current_database() "${db}"`)
  }
  console.log(`\n=== IT zimmet devir import — ${APPLY ? 'APPLY (yazma)' : 'DRY-RUN (yazma yok)'} — DB: ${db} ===`)

  const olusturan = await prisma.user.findUnique({ where: { id: CREATED_BY }, select: { id: true, name: true } })
  if (!olusturan) throw new Error(`--created-by kullanıcısı bulunamadı: ${CREATED_BY}`)

  let envanterSahibi: Kullanici | null = null
  if (ENVANTER_SAHIBI_ID) {
    envanterSahibi = await prisma.user.findUnique({
      where: { id: ENVANTER_SAHIBI_ID },
      select: { id: true, name: true, firstName: true, lastName: true, email: true, isActive: true },
    })
    if (!envanterSahibi) throw new Error(`--envanter-sahibi kullanıcısı bulunamadı: ${ENVANTER_SAHIBI_ID}`)
    if (!envanterSahibi.isActive) throw new Error(`--envanter-sahibi hesabı pasif: ${ENVANTER_SAHIBI_ID}`)
    console.log(`Depo sorumlusu (ENVANTER satırları): ${envanterSahibi.name} (${envanterSahibi.id})`)
  }

  const satirlar = csvOku(CSV_YOLU)
  console.log(`CSV: ${CSV_YOLU} (${satirlar.length} satır) · oluşturan: ${olusturan.name ?? olusturan.id}`)

  let override: Record<string, string> = {}
  if (OVERRIDE_ARG && !fs.existsSync(OVERRIDE_ARG)) {
    throw new Error(`--override dosyası bulunamadı: ${OVERRIDE_ARG}`)
  }
  if (fs.existsSync(OVERRIDE_YOLU)) {
    override = JSON.parse(fs.readFileSync(OVERRIDE_YOLU, 'utf-8'))
    console.log(`Kişi eşleştirme override: ${OVERRIDE_YOLU} — ${Object.keys(override).length} anahtar yüklendi`)
  } else {
    console.log(`Kişi eşleştirme override: YOK (varsayılan ${OVERRIDE_YOLU} bulunamadı)`)
  }
  const overrideNorm = new Map(Object.entries(override).map(([ad, id]) => [adNormalize(ad), id]))

  // ── Referans veriler ──
  const kullanicilar: Kullanici[] = await prisma.user.findMany({
    select: { id: true, name: true, firstName: true, lastName: true, email: true, isActive: true },
  })
  const kullaniciById = new Map(kullanicilar.map((u) => [u.id, u]))
  const kullaniciByAd = new Map<string, Kullanici[]>()
  for (const u of kullanicilar) {
    const adlar = new Set([adNormalize(u.name), adNormalize(`${u.firstName ?? ''} ${u.lastName ?? ''}`)])
    for (const ad of adlar) {
      if (!ad) continue
      kullaniciByAd.set(ad, [...(kullaniciByAd.get(ad) ?? []), u])
    }
  }

  const tanimlar = await prisma.zimmetTanim.findMany({
    where: { aktif: true },
    select: { id: true, ad: true, parentId: true },
  })

  const mevcutlar: MevcutKayit[] = await prisma.zimmetFormu.findMany({
    where: { silindiMi: false },
    select: {
      id: true,
      zimmetSahibiId: true,
      durum: true,
      zimmetSahibiImzaTarihi: true,
      seriNumarasi: true,
      imeiNumarasi: true,
      macAdresi: true,
    },
  })
  const indeks = { seri: new Map<string, MevcutKayit[]>(), imei: new Map<string, MevcutKayit[]>(), mac: new Map<string, MevcutKayit[]>() }
  for (const k of mevcutlar) {
    for (const [alan, deger] of [['seri', k.seriNumarasi], ['imei', k.imeiNumarasi], ['mac', k.macAdresi]] as const) {
      const a = anahtarNormalize(deger)
      if (a) indeks[alan].set(a, [...(indeks[alan].get(a) ?? []), k])
    }
  }
  const refler = satirlar.map((s) => s.ref)
  const zatenVar = new Set(
    (await prisma.zimmetFormu.findMany({ where: { id: { in: refler } }, select: { id: true } })).map((z) => z.id),
  )

  // ── Yardımcılar ──
  function sahipBul(ad: string): { user: Kullanici | null; sebep: string } {
    const n = adNormalize(ad)
    const ovId = overrideNorm.get(n)
    if (ovId) {
      const u = kullaniciById.get(ovId)
      return u ? { user: u, sebep: 'override' } : { user: null, sebep: `override User.id bulunamadı: ${ovId}` }
    }
    const adaylar = kullaniciByAd.get(n) ?? []
    if (adaylar.length === 0) {
      const tokenlar = new Set(n.split(' '))
      const kismi = kullanicilar.filter((u) => {
        const t = new Set(adNormalize(u.name).split(' ').filter(Boolean))
        const ortak = [...tokenlar].filter((x) => t.has(x)).length
        return ortak >= 2 && ([...tokenlar].every((x) => t.has(x)) || [...t].every((x) => tokenlar.has(x)))
      })
      return {
        user: null,
        sebep: kismi.length
          ? `yalnız kısmi eşleşme: ${kismi.map((u) => `${u.name} (${u.id})`).join('; ')}`
          : 'User tablosunda eşleşme yok',
      }
    }
    if (adaylar.length === 1) {
      const u = adaylar[0]
      return u.isActive ? { user: u, sebep: 'tam' } : { user: null, sebep: `tek eşleşme PASİF hesap: ${u.name} (${u.id})` }
    }
    const aktifAd = adaylar.filter((u) => u.isActive && !u.email.toLowerCase().endsWith(BLUECOLLAR_DOMAIN))
    if (aktifAd.length === 1) return { user: aktifAd[0], sebep: `${adaylar.length} hesaptan aktif AD hesabı seçildi` }
    return {
      user: null,
      sebep: `birden fazla hesap, tek aktif AD hesabı yok: ${adaylar.map((u) => `${u.id}${u.isActive ? '' : ' (pasif)'}`).join('; ')}`,
    }
  }

  function tanimVar(turDiger: string): boolean {
    const parcalar = turDiger.split('·').map((p) => esitlikIcinNormalize(p)).filter(Boolean)
    const kok = tanimlar.find((t) => t.parentId === null && esitlikIcinNormalize(t.ad) === parcalar[0])
    if (!kok) return false
    if (parcalar.length === 1) return true
    return tanimlar.some((t) => t.parentId === kok.id && esitlikIcinNormalize(t.ad) === parcalar.slice(1).join(' · '))
  }

  function eslesenKayitlar(s: Satir): { kayitlar: MevcutKayit[]; anahtar: string | null } {
    for (const [alan, kolon] of [['seri', 'seriNumarasi'], ['imei', 'imeiNumarasi'], ['mac', 'macAdresi']] as const) {
      const a = anahtarNormalize(s[kolon])
      const bulunan = a ? indeks[alan].get(a) : undefined
      if (bulunan?.length) return { kayitlar: bulunan, anahtar: `${alan}=${a}` }
    }
    return { kayitlar: [], anahtar: null }
  }

  // ── Karar hesabı ──
  const sonuclar: Sonuc[] = []
  for (const s of satirlar) {
    // ENVANTER satırları --envanter-sahibi verilirse depo kaydı olarak işlenir (sahip = depo sorumlusu).
    const depo = s.islem === 'ENVANTER' && envanterSahibi !== null
    const sahipAdi = depo ? envanterSahibi!.name ?? envanterSahibi!.id : s.zimmet_sahibi_eslestir || s.zimmet_sahibi_excel
    const sonuc = (karar: Karar, sebep: string, userId: string | null = null, eskiIdler: string[] = []): Sonuc => ({
      satir: s, karar, sahipAdi, userId, eskiIdler, sebep, depo,
    })

    if (s.islem === 'BEKLET' || (s.islem === 'ENVANTER' && !depo)) {
      sonuclar.push(sonuc(s.islem as Karar, s.sebep))
      continue
    }
    if (s.islem !== 'AKTAR' && !depo) throw new Error(`${s.ref}: bilinmeyen islem "${s.islem}"`)
    if (!TUR_DEGERLERI.has(s.tur)) throw new Error(`${s.ref}: geçersiz tur "${s.tur}"`)
    tarihCoz(s.zimmet_tarihi) // format hatası varsa dry-run'da yakalansın

    if (zatenVar.has(s.ref)) {
      sonuclar.push(sonuc('ATLA_ZATEN_VAR', 'id=ref kaydı zaten var'))
      continue
    }
    const { user, sebep: sahipSebep } = depo ? { user: envanterSahibi!, sebep: 'depo sorumlusu' } : sahipBul(sahipAdi)
    if (!user) {
      sonuclar.push(sonuc('SAHIP_BELIRSIZ', sahipSebep))
      continue
    }
    if (s.tur === ZimmetTuru.DIGER && !tanimVar(s.turDiger)) {
      sonuclar.push(sonuc('TANIM_YOK', `ZimmetTanim'da yok: "${s.turDiger}"`, user.id))
      continue
    }

    const { kayitlar, anahtar } = eslesenKayitlar(s)
    const eskiIdler = kayitlar.map((k) => k.id)
    if (kayitlar.length === 0) {
      const anahtarsiz = !['seriNumarasi', 'imeiNumarasi', 'macAdresi'].some((kolon) => anahtarNormalize(s[kolon]))
      sonuclar.push(
        anahtarsiz
          ? sonuc('ANAHTARSIZ', `${depo ? 'depo cihazı: ' : ''}seri/IMEI/MAC yok — eşleştirme yapılamadı, yeni kayıt`, user.id)
          : sonuc('YENI', 'eşleşen mevcut kayıt yok', user.id),
      )
      continue
    }
    if (kayitlar.some(imzali)) {
      const imzaliKayitlar = kayitlar.filter(imzali)
      const etiket = (k: MevcutKayit) => `${k.id} (${kullaniciById.get(k.zimmetSahibiId)?.name ?? k.zimmetSahibiId})`
      const imzalilar = imzaliKayitlar.map(etiket)
      const imzaliAyniSahip = imzaliKayitlar.some((k) => k.zimmetSahibiId === user.id)
      if (kayitlar.length === 1) {
        // Liste esas: imzalı kayıt başka sahipteyse liste sahibine taşınır; aynı sahipteyse korunur.
        sonuclar.push(
          imzaliAyniSahip
            ? sonuc('ATLA_IMZALI', `${anahtar} aynı sahipte imzalı: ${imzalilar[0]}`, user.id, eskiIdler)
            : sonuc('TASI_IMZALI', `${anahtar} imzalı ${imzalilar[0]} → ${user.name}`, user.id, eskiIdler),
        )
      } else if (imzaliAyniSahip) {
        // Çoklu eşleşmede liste sahibinin imzalı kaydı da var — otomatik karar verilmez.
        sonuclar.push(sonuc('IMZALI_CAKISMA', `${anahtar} ${kayitlar.length} kayıt, liste sahibinde imzalı: ${imzalilar.join('; ')}`, user.id, eskiIdler))
      } else if (COKLU_BIRLESTIR) {
        sonuclar.push(
          sonuc('TASI_IMZALI', `${anahtar} ${kayitlar.length} kayıt birleştirildi (--coklu-birlestir), imzalı: ${imzalilar.join('; ')} → ${user.name}`, user.id, eskiIdler),
        )
      } else {
        sonuclar.push(sonuc('COKLU_ESLESME', `${anahtar} ${kayitlar.length} kayıt: ${kayitlar.map(etiket).join('; ')} (imzalı: ${imzalilar.join('; ')})`, user.id, eskiIdler))
      }
      continue
    }
    if (kayitlar.length > 1) {
      if (COKLU_BIRLESTIR) {
        sonuclar.push(sonuc('TASI', `${anahtar} ${kayitlar.length} imzasız kayıt birleştirildi (--coklu-birlestir)`, user.id, eskiIdler))
      } else {
        const sahipler = kayitlar.map((k) => `${k.id} (${kullaniciById.get(k.zimmetSahibiId)?.name ?? k.zimmetSahibiId})`)
        sonuclar.push(sonuc('COKLU_ESLESME', `${anahtar} ${kayitlar.length} kayıt: ${sahipler.join('; ')}`, user.id, eskiIdler))
      }
      continue
    }
    const eski = kayitlar[0]
    if (eski.zimmetSahibiId === user.id) {
      sonuclar.push(sonuc('ATLA', `${anahtar} aynı sahipte ${eski.durum}`, user.id, eskiIdler))
    } else {
      const eskiSahip = kullaniciById.get(eski.zimmetSahibiId)?.name ?? eski.zimmetSahibiId
      sonuclar.push(sonuc('TASI', `${anahtar} ${eskiSahip} → ${user.name} (${eski.durum})`, user.id, eskiIdler))
    }
  }

  // --yenile: aynı sahipteki İMZASIZ mevcut kayıt listeden yeniden oluşturulur.
  // ATLA_IMZALI (aynı sahipte imzalı) korunur — yeniden oluşturulmaz.
  if (YENILE) {
    for (const r of sonuclar) {
      if (r.karar !== 'ATLA') continue
      r.sebep = `${r.sebep} → listeden yeniden oluşturuluyor (--yenile)`
      r.karar = 'YENILE'
    }
  }

  // Aynı mevcut kaydı birden fazla satır taşımak/birleştirmek istiyorsa → hepsi COKLU_ESLESME.
  const talepler = new Map<string, Sonuc[]>()
  for (const r of sonuclar.filter((x) => x.karar in ESKI_SILEN_KARARLAR)) {
    for (const id of r.eskiIdler) talepler.set(id, [...(talepler.get(id) ?? []), r])
  }
  for (const [id, liste] of talepler) {
    if (liste.length < 2) continue
    for (const r of liste) {
      r.karar = 'COKLU_ESLESME'
      r.sebep = `mevcut kayıt ${id} birden fazla satırla eşleşti: ${liste.map((x) => x.satir.ref).join(', ')}`
    }
  }
  // CSV içinde aynı anahtarla YENI açılacak birden fazla satır → hepsi COKLU_ESLESME.
  const yeniAnahtar = new Map<string, Sonuc[]>()
  for (const r of sonuclar.filter((x) => x.karar === 'YENI' || x.karar in ESKI_SILEN_KARARLAR)) {
    for (const kolon of ['seriNumarasi', 'imeiNumarasi', 'macAdresi']) {
      const a = anahtarNormalize(r.satir[kolon])
      if (a) yeniAnahtar.set(`${kolon}=${a}`, [...(yeniAnahtar.get(`${kolon}=${a}`) ?? []), r])
    }
  }
  for (const [a, liste] of yeniAnahtar) {
    if (new Set(liste).size < 2) continue
    for (const r of liste) {
      r.karar = 'COKLU_ESLESME'
      r.sebep = `CSV içinde mükerrer ${a}: ${liste.map((x) => x.satir.ref).join(', ')}`
    }
  }

  // ── Yazma (yalnız --apply) ──
  const yazilacak = sonuclar.filter((r) => r.karar === 'YENI' || r.karar === 'ANAHTARSIZ' || r.karar in ESKI_SILEN_KARARLAR)

  // Depo kaydı alanları: iade akışının sonucu (PASIF + iadeTarihi/iadeAlanId), sahip = depo sorumlusu.
  const depoAciklama = (s: Satir) => {
    const mevcut = (s.aciklama ?? '').replace(/^\s*\[IT listesi 09\.2026\]\s*/, '').trim()
    return mevcut ? `${DEPO_ACIKLAMA_ONEKI} · ${mevcut}` : DEPO_ACIKLAMA_ONEKI
  }
  const depoNotu = (s: Satir) => {
    const oncekiSahip = s.zimmet_sahibi_excel && normalizeTr(s.zimmet_sahibi_excel) !== 'envanter' ? `; önceki sahip ${s.zimmet_sahibi_excel}` : ''
    return `IT listesi 09.2026 – depoya alındı (sorumlu: ${envanterSahibi?.name ?? envanterSahibi?.id})${oncekiSahip}`
  }

  if (APPLY) {
    const simdi = new Date()
    await prisma.$transaction(
      async (tx) => {
        for (const r of yazilacak) {
          const s = r.satir
          for (const eskiId of r.eskiIdler) {
            const eski = mevcutlar.find((k) => k.id === eskiId)!
            await tx.zimmetFormu.update({
              where: { id: eskiId, silindiMi: false },
              data: { silindiMi: true, silinmeTarihi: simdi, silenId: CREATED_BY },
            })
            await tx.zimmetDurumGecmisi.create({
              data: {
                zimmetId: eskiId,
                eskiDurum: eski.durum,
                yeniDurum: 'SILINDI',
                islemYapanId: CREATED_BY!,
                not: `${ESKI_SILEN_KARARLAR[r.karar]}${s.ref}`,
              },
            })
          }
          await tx.zimmetFormu.create({
            data: {
              id: s.ref,
              zimmetSahibiId: r.userId!,
              createdById: CREATED_BY!,
              kaynak: ZimmetKaynak.SYTELINE_DEVIR,
              durum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
              sonBildirimTarihi: null,
              silindiMi: false,
              tur: s.tur as ZimmetTuru,
              turDiger: bos(s.turDiger),
              // CSV'de marka ve model ayrı değil — birleşik metin model'e, marka boş.
              model: bos(s.marka_model),
              seriNumarasi: bos(s.seriNumarasi),
              macAdresi: bos(s.macAdresi),
              imeiNumarasi: bos(s.imeiNumarasi),
              pcAdi: bos(s.pcAdi),
              ozellik: bos(s.ozellik),
              departman: bos(s.departman),
              altZimmetSahibi: bos(s.altZimmetSahibi),
              aciklama: r.depo ? depoAciklama(s) : bos(s.aciklama),
              verilisTarihi: tarihCoz(s.zimmet_tarihi),
              ...(r.depo
                ? { cihazDurumu: ZimmetCihazDurumu.PASIF, iadeTarihi: simdi, iadeAlanId: envanterSahibi!.id }
                : {}),
            },
          })
          await tx.zimmetDurumGecmisi.create({
            data: {
              zimmetId: s.ref,
              eskiDurum: null,
              yeniDurum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
              islemYapanId: CREATED_BY!,
              not: r.depo ? depoNotu(s) : `IT listesi 09.2026 aktarımı (${s.sayfa}!${s.excel_satir})`,
            },
          })
        }
      },
      { timeout: 120_000 },
    )
  }

  // ── Rapor ──
  const rapor = raporYolu('zimmet-it-devir', APPLY ? 'apply' : 'dry-run')
  csvYaz(
    rapor,
    ['ref', 'karar', 'sahip', 'eslesen_user_id', 'eski_kayit_idler', 'sebep', 'depo'],
    sonuclar.map((r) => [r.satir.ref, r.karar, r.sahipAdi, r.userId ?? '', r.eskiIdler.join(' '), r.sebep, r.depo ? 'evet' : '']),
  )

  const sira: Karar[] = ['YENI', 'ATLA', 'ATLA_ZATEN_VAR', 'ATLA_IMZALI', 'TASI', 'TASI_IMZALI', 'YENILE', 'IMZALI_CAKISMA', 'COKLU_ESLESME', 'SAHIP_BELIRSIZ', 'TANIM_YOK', 'ANAHTARSIZ', 'BEKLET', 'ENVANTER']
  console.log('\nKarar dağılımı:')
  for (const k of sira) console.log(`  ${k.padEnd(15)} ${sonuclar.filter((r) => r.karar === k).length}`)
  console.log(`  ${'TOPLAM'.padEnd(15)} ${sonuclar.length}`)
  const eskiSilinecek = yazilacak.reduce((t, r) => t + r.eskiIdler.length, 0)
  const depoYazilacak = yazilacak.filter((r) => r.depo).length
  console.log(
    `\n${APPLY ? 'Yazıldı' : 'Yazılacak'}: ${yazilacak.length} yeni kayıt (${depoYazilacak} depo), ${eskiSilinecek} eski kayıt soft-delete. Bildirim: YOK.`,
  )
  if (depoYazilacak) {
    console.log(`\nDepo satırları (${depoYazilacak}, sahip ${envanterSahibi?.name}, PASIF):`)
    for (const r of yazilacak.filter((x) => x.depo)) console.log(`  ${r.satir.ref} | ${r.karar} | ${r.sebep}`)
  }
  for (const k of ['SAHIP_BELIRSIZ', 'COKLU_ESLESME', 'IMZALI_CAKISMA', 'TANIM_YOK'] as Karar[]) {
    const liste = sonuclar.filter((r) => r.karar === k)
    if (!liste.length) continue
    console.log(`\n${k} (${liste.length}):`)
    for (const r of liste) console.log(`  ${r.satir.ref} | ${r.sahipAdi} | ${r.sebep}`)
  }
  console.log(`\nRapor: ${rapor}`)
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
