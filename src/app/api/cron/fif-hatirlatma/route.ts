import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fifKullaniciyaBildir, fifBildirimKonusu } from '@/lib/quality/fif-bildirim'
import { kssKoltukKullanicilari } from '@/lib/quality/fif-zincir'
import { TAKIPTEKI_FAALIYET_WHERE, FIF_ETKINLIK_ERKEN_GUN, istanbulBugunTarihi } from '@/lib/quality/fif-termin'
import { FifDurum, FifSonuc, FifEkTerminDurum } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST/GET /api/cron/fif-hatirlatma — iki iş, TEK cron (yeni cron satırı gerekmez):
 *
 *  1) HEDEF TARİH: FAALIYET durumundaki FİF'lerde TAKİPTEKİ faaliyet satırının
 *     (açık + bekleyen ek termin talebi yok) hedef tarihine 3 gün kala VE geçince
 *     GÜNLÜK 1 hatırlatma. Kapatılmış ve talebi KSS'de bekleyen satırlar atlanır;
 *     ek termin onayı hedefTarih'i güncellediği için hesap yeni hedefe göre yapılır.
 *  3) BEKLEYEN EK TERMİN: onay bekleyen her talep için tüm KSS'lere GÜNDE EN FAZLA 1
 *     hatırlatma (talebin açıldığı gün atlanır — o gün talep bildirimi zaten gitti).
 *  2) ETKİNLİK (Paket 3b-2, "3 ay"): kapatılmış, etkinliği değerlendirilmemiş ve
 *     henüz hatırlatılmamış satırda bugün ≥ etkinlikPlanTarihi − 7 gün → tüm
 *     KSS'lere bildirim, etkinlikHatirlatmaTarihi = şimdi (satır başına TEK sefer).
 *
 * ALICILAR: izleme sorumlusu + SORUMLU BÖLÜM MÜDÜRÜ + KSS koltuklarındaki
 * HEPSİ (Paket 2). KANAL: in-app + push + mail (fif-bildirim.fifKullaniciyaBildir;
 * sentetik bluecollar adreste mail atlanır).
 * Dedup kişi başına ve GÜNLÜK: o kullanıcıya, o FİF için bugün oluşturulmuş
 * "Hedef tarih hatırlatma" in-app bildirimi varsa atlanır (ayrı dedup tablosu
 * gerektirmez). Auth: x-cron-secret (deneme check-evaluations deseni).
 */
/** Sorumlu bölümün müdürünün aktif User id'si (yoksa müdür yardımcısı). */
async function bolumMudurUserId(bolumId: string | null): Promise<string | null> {
  if (!bolumId) return null
  const dept = await prisma.departmentDefinition.findUnique({
    where: { id: bolumId },
    select: { mudurId: true, mudurYardimcisiId: true },
  })
  for (const pid of [dept?.mudurId, dept?.mudurYardimcisiId]) {
    if (!pid) continue
    const u = await prisma.user.findFirst({ where: { personnelId: pid, isActive: true }, select: { id: true } })
    if (u) return u.id
  }
  return null
}

type Sonuc = {
  taranan: number; hatirlatilan: number; atlanan: number; pushGiden: number; mailGiden: number; mailAtlanan: number
  etkinlikTaranan: number; etkinlikHatirlatilan: number
  talepTaranan: number; talepHatirlatilan: number
}

async function calis(): Promise<Sonuc> {
  const simdi = new Date()
  const gunBasi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate())
  const esik = new Date(gunBasi.getTime() + 3 * 86400000) // bugün + 3 gün

  const fifler = await prisma.fif.findMany({
    where: {
      durum: FifDurum.FAALIYET,
      faaliyetler: { some: { hedefTarih: { not: null, lte: esik }, ...TAKIPTEKI_FAALIYET_WHERE } },
    },
    select: {
      id: true, kayitNo: true, izlemeSorumlusuUserId: true, sorumluBolumId: true,
      faaliyetler: { where: { hedefTarih: { not: null, lte: esik }, ...TAKIPTEKI_FAALIYET_WHERE }, select: { hedefTarih: true } },
    },
  })

  // KSS listesi tüm FİF'ler için aynı — bir kez çözülür.
  const kssIdleri = (await kssKoltukKullanicilari(prisma)).map((k) => k.userId)

  let hatirlatilan = 0, atlanan = 0, pushGiden = 0, mailGiden = 0, mailAtlanan = 0
  const say = (x: { push: number; mail: string }) => {
    pushGiden += x.push
    if (x.mail === 'gitti') mailGiden++
    else if (x.mail === 'atlandi') mailAtlanan++
  }

  for (const fif of fifler) {
    // Alıcı kümesi: izleme sorumlusu + sorumlu bölüm müdürü + tüm KSS (tekilleştirilir).
    const aliciIdleri = new Set<string>(kssIdleri)
    if (fif.izlemeSorumlusuUserId) aliciIdleri.add(fif.izlemeSorumlusuUserId)
    const mudurId = await bolumMudurUserId(fif.sorumluBolumId)
    if (mudurId) aliciIdleri.add(mudurId)
    if (aliciIdleri.size === 0) { atlanan++; continue }

    const link = `/kalite/fif/${fif.id}`
    const konu = fifBildirimKonusu(fif, 'Hedef tarih hatırlatma')
    const gecmis = fif.faaliyetler.some((f) => f.hedefTarih && new Date(f.hedefTarih) < gunBasi)
    const govde = gecmis
      ? 'FİF faaliyetlerinden en az birinin hedef tarihi GEÇTİ. Lütfen durumu güncelleyin.'
      : 'FİF faaliyetlerinden en az birinin hedef tarihine 3 gün veya daha az kaldı.'

    for (const aliciId of aliciIdleri) {
      const u = await prisma.user.findFirst({ where: { id: aliciId, isActive: true }, select: { id: true } })
      if (!u) { atlanan++; continue }

      // Aynı gün tekrarlamama: bugün bu kullanıcıya bu FİF için hatırlatma var mı.
      const bugunVar = await prisma.notification.findFirst({
        where: { userId: u.id, link, title: konu, createdAt: { gte: gunBasi } },
        select: { id: true },
      })
      if (bugunVar) { atlanan++; continue }

      const r = await fifKullaniciyaBildir(u.id, konu, govde, link, 'REMINDER')
      say(r)
      hatirlatilan++
    }
  }

  // ── 2) ETKİNLİK KONTROLÜ HATIRLATMASI ──
  // Plan tarihleri DB'de UTC gece yarısı (İstanbul günü); eşik = bugün + 7 gün.
  const etkinlikEsik = new Date(istanbulBugunTarihi(simdi).getTime() + FIF_ETKINLIK_ERKEN_GUN * 86400000)
  const satirlar = await prisma.fifFaaliyet.findMany({
    where: {
      sonuc: FifSonuc.K, gerceklesenTarih: { not: null },
      etkinlikUygun: null, etkinlikHatirlatmaTarihi: null,
      etkinlikPlanTarihi: { not: null, lte: etkinlikEsik },
      fif: { durum: { in: [FifDurum.FAALIYET, FifDurum.ETKINLIK] } },
    },
    select: { id: true, sira: true, aciklama: true, etkinlikPlanTarihi: true, fif: { select: { id: true, kayitNo: true } } },
  })
  let etkinlikHatirlatilan = 0
  for (const s of satirlar) {
    // Önce İŞARET (koşullu): eşzamanlı iki cron çağrısı aynı satırı iki kez bildirmesin.
    const r = await prisma.fifFaaliyet.updateMany({
      where: { id: s.id, etkinlikHatirlatmaTarihi: null },
      data: { etkinlikHatirlatmaTarihi: simdi },
    })
    if (r.count === 0) continue
    const plan = (s.etkinlikPlanTarihi as Date).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
    const konu = fifBildirimKonusu(s.fif, `Etkinlik kontrolü — faaliyet #${s.sira}`)
    const govde = `Faaliyet #${s.sira} (${s.aciklama.length > 80 ? `${s.aciklama.slice(0, 79)}…` : s.aciklama}) için etkinlik kontrolü planı: ${plan}.`
    for (const k of kssIdleri) {
      const b = await fifKullaniciyaBildir(k, konu, govde, `/kalite/fif/${s.fif.id}`, 'REMINDER')
      say(b)
    }
    etkinlikHatirlatilan++
  }

  // ── 3) BEKLEYEN EK TERMİN TALEPLERİ → KSS ──
  const talepler = await prisma.fifEkTermin.findMany({
    where: {
      durum: FifEkTerminDurum.BEKLIYOR,
      createdAt: { lt: gunBasi },
      faaliyet: { fif: { durum: FifDurum.FAALIYET } },
    },
    select: {
      id: true, istenenHedefTarih: true, neden: true, createdAt: true,
      faaliyet: { select: { sira: true, fif: { select: { id: true, kayitNo: true } } } },
    },
  })
  let talepHatirlatilan = 0
  for (const t of talepler) {
    const f = t.faaliyet
    const link = `/kalite/fif/${f.fif.id}`
    // Başlık talebe özgü (satır + istenen tarih): günlük dedup TALEP başına işler.
    const istenen = t.istenenHedefTarih.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
    const konu = fifBildirimKonusu(f.fif, `Ek termin onayı bekliyor — faaliyet #${f.sira} (${istenen})`)
    const govde = `Faaliyet #${f.sira} için ${t.createdAt.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })} tarihinde açılan ek termin talebi kararınızı bekliyor. Neden: ${t.neden}`
    let gonderildi = false
    for (const k of kssIdleri) {
      const bugunVar = await prisma.notification.findFirst({
        where: { userId: k, link, title: konu, createdAt: { gte: gunBasi } },
        select: { id: true },
      })
      if (bugunVar) continue
      const b = await fifKullaniciyaBildir(k, konu, govde, link, 'REMINDER')
      say(b)
      gonderildi = true
    }
    if (gonderildi) talepHatirlatilan++
  }

  return {
    taranan: fifler.length, hatirlatilan, atlanan, pushGiden, mailGiden, mailAtlanan,
    etkinlikTaranan: satirlar.length, etkinlikHatirlatilan,
    talepTaranan: talepler.length, talepHatirlatilan,
  }
}

async function checkCron(request: NextRequest): Promise<boolean> {
  const s = request.headers.get('x-cron-secret')
  return !!s && s === process.env.CRON_SECRET
}

export async function POST(request: NextRequest) {
  if (!(await checkCron(request))) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const sonuc = await calis()
  return NextResponse.json({ ok: true, ...sonuc, checkedAt: new Date().toISOString() })
}
export async function GET(request: NextRequest) {
  return POST(request)
}
