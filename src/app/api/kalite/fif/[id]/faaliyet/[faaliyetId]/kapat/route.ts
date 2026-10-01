import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif, fifKapsamindaMi } from '@/lib/quality/fif-access'
import { faaliyetKapaliMi, istanbulBugunTarihi, ACIK_FAALIYET_WHERE } from '@/lib/quality/fif-termin'
import { fifKullaniciyaBildir, fifBildirimKonusu } from '@/lib/quality/fif-bildirim'
import { kssKoltukKullanicilari } from '@/lib/quality/fif-zincir'
import { FifDurum, FifSonuc, FifGecmisOlay, FifEkTerminDurum } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/** Transaction içinden 4xx döndürmek için (eşzamanlı kapatma yarışında rollback). */
class KapatHatasi extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/**
 * POST /api/kalite/fif/[id]/faaliyet/[faaliyetId]/kapat — "Faaliyeti Kapat" (Paket 3).
 *
 * Yetki: SATIRIN SORUMLUSU (sorumluUserId) veya manage.
 * Şartlar: FİF FAALIYET'te, satır kapalı değil, hedef tarih dolu.
 * Tek transaction: gerceklesenTarih = bugün (İstanbul günü), paraf = kapatan + şimdi,
 * sonuc = K, Fif.updatedAt, FifGecmis
 * (olay FAALIYET_KAPATILDI, faaliyetId). Satırın BEKLEYEN ek termin talebi aynı
 * transaction'da IPTAL edilir (kararNotu "Faaliyet kapatıldı"). Bildirim commit
 * sonrası tüm KSS'lere.
 * FİF DURUMU DEĞİŞMEZ: son satır kapansa da FİF FAALIYET'te kalır; kapanış
 * "Kapatmaya Gönder" → yayınlayan müdür → KSS kapanış kontrolü zinciriyle
 * ilerler (Paket 3 — hub/main kapanış akışı geri geldi; otomatik ETKINLIK YOK).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; faaliyetId: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id, faaliyetId } = await params

  const fif = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, kayitNo: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true,
    },
  })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })
  if (fif.durum !== FifDurum.FAALIYET) {
    return NextResponse.json({ error: 'Faaliyet yalnız FİF faaliyet aşamasındayken kapatılabilir' }, { status: 409 })
  }

  const satir = await prisma.fifFaaliyet.findFirst({
    where: { id: faaliyetId, fifId: id },
    select: { id: true, sira: true, aciklama: true, hedefTarih: true, sorumluUserId: true, sonuc: true, gerceklesenTarih: true },
  })
  if (!satir) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })
  if (!canManageFif(session) && (!userId || satir.sorumluUserId !== userId)) {
    return NextResponse.json({ error: 'Faaliyeti yalnız satırın sorumlu kişisi kapatabilir' }, { status: 403 })
  }
  if (faaliyetKapaliMi(satir)) return NextResponse.json({ error: 'Faaliyet zaten kapatılmış' }, { status: 409 })
  if (!satir.hedefTarih) return NextResponse.json({ error: 'Hedef tarihi olmayan faaliyet kapatılamaz' }, { status: 400 })

  const simdi = new Date()
  const gerceklesen = istanbulBugunTarihi(simdi)
  // Etkinlik planı burada YAZILMAZ (Kalite kararı): 3 aylık süre ilk kapanış
  // onayında başlar (durum ucu, KSS_KAPANIS_BEKLIYOR → ETKINLIK).

  try {
    await prisma.$transaction(async (tx) => {
      // Koşullu güncelleme: iki sekmeden/kişiden eşzamanlı kapatmada ikinci istek 409 alır.
      const r = await tx.fifFaaliyet.updateMany({
        where: { id: satir.id, fifId: id, ...ACIK_FAALIYET_WHERE },
        data: {
          gerceklesenTarih: gerceklesen,
          parafUserId: userId,
          parafTarihi: simdi,
          sonuc: FifSonuc.K,
        },
      })
      if (r.count === 0) throw new KapatHatasi('Faaliyet zaten kapatılmış', 409)
      await tx.fif.update({ where: { id }, data: { updatedAt: simdi } })
      await tx.fifGecmis.create({
        data: {
          fifId: id, eskiDurum: FifDurum.FAALIYET, yeniDurum: FifDurum.FAALIYET, userId,
          faaliyetId: satir.id, olay: FifGecmisOlay.FAALIYET_KAPATILDI,
          aciklama: `Faaliyet #${satir.sira} kapatıldı (gerçekleşen: ${gerceklesen.toISOString().slice(0, 10)})`,
        },
      })

      // Bekleyen ek termin talebi anlamını yitirdi → IPTAL (aynı transaction),
      // günlükte EK_TERMIN_IPTAL olayıyla ayrı satır.
      const bekleyenler = await tx.fifEkTermin.findMany({
        where: { faaliyetId: satir.id, durum: FifEkTerminDurum.BEKLIYOR },
        select: { id: true, istenenHedefTarih: true },
      })
      if (bekleyenler.length) {
        await tx.fifEkTermin.updateMany({
          where: { id: { in: bekleyenler.map((t) => t.id) }, durum: FifEkTerminDurum.BEKLIYOR },
          data: { durum: FifEkTerminDurum.IPTAL, kararNotu: 'Faaliyet kapatıldı', kararUserId: userId, kararTarihi: simdi },
        })
        for (const t of bekleyenler) {
          await tx.fifGecmis.create({
            data: {
              fifId: id, eskiDurum: FifDurum.FAALIYET, yeniDurum: FifDurum.FAALIYET, userId,
              faaliyetId: satir.id, olay: FifGecmisOlay.EK_TERMIN_IPTAL,
              aciklama: `Bekleyen ek termin talebi iptal edildi (istenen ${t.istenenHedefTarih.toISOString().slice(0, 10)}): Faaliyet kapatıldı`,
            },
          })
        }
      }
    })
  } catch (e) {
    if (e instanceof KapatHatasi) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  // Bildirim — commit sonrası, best-effort: tüm KSS'lere (in-app + push).
  try {
    const kapatan = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, personnel: { select: { adSoyad: true } } } })
      : null
    const ad = kapatan?.name || kapatan?.personnel?.adSoyad || kapatan?.email || 'Sorumlu'
    const ozet = satir.aciklama.length > 100 ? `${satir.aciklama.slice(0, 99)}…` : satir.aciklama
    const konu = fifBildirimKonusu(fif, 'Faaliyet kapatıldı')
    const govde = `${ad} faaliyet #${satir.sira} satırını kapattı: ${ozet}`
    for (const k of await kssKoltukKullanicilari(prisma)) {
      await fifKullaniciyaBildir(k.userId, konu, govde, `/kalite/fif/${id}`)
    }
  } catch (e) {
    console.error('[fif-faaliyet-kapat] bildirim:', e)
  }
  return NextResponse.json({ ok: true, gerceklesenTarih: gerceklesen })
}
