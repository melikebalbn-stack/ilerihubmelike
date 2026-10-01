import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { isFifKss } from '@/lib/quality/fif-access'
import { faaliyetKapaliMi, etkinlikKontrolAcikMi, gunFarki, istanbulGunu, FIF_ETKINLIK_ERKEN_GUN } from '@/lib/quality/fif-termin'
import { fifFaaliyetEtkinlikInput } from '@/lib/quality/fif-validators'
import { fifKullaniciyaBildir, fifBildirimKonusu } from '@/lib/quality/fif-bildirim'
import { FifDurum, FifGecmisOlay } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

class EtkinlikHatasi extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const gun = (t: Date | null) => (t ? istanbulGunu(t) : '—')

/**
 * POST /api/kalite/fif/[id]/faaliyet/[faaliyetId]/etkinlik — satır bazlı etkinlik
 * kontrolü (Paket 3b-2). SADECE KSS.
 *
 * Şart: satır kapalı ve bugün ≥ etkinlikPlanTarihi − 7 gün. FİF FAALIYET veya
 * ETKINLIK olabilir (satırlar birbirinden bağımsız ilerler).
 *  · uygun=true  → etkinlikUygun + kontrol eden/tarih, ETKINLIK_KONTROL.
 *  · uygun=false → açıklama + YENİ hedef tarih zorunlu; satır YENİDEN AÇILIR:
 *    gerçekleşen/paraf/sonuç/etkinlik alanları temizlenir (eski değerler günlüğe),
 *    hedefTarih = yeni (ilkHedefTarih değişmez), FAALIYET_YENIDEN_ACILDI.
 *    FİF ETKINLIK'teyse → FAALIYET (DURUM_DEGISTI). Satır sorumlusuna bildirim.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; faaliyetId: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!(await isFifKss(session))) return NextResponse.json({ error: 'Etkinlik kontrolünü yalnız KSS yapabilir' }, { status: 403 })
  const { id, faaliyetId } = await params

  const parsed = fifFaaliyetEtkinlikInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const { uygun, aciklama, yeniHedefTarih } = parsed.data

  const fif = await prisma.fif.findUnique({ where: { id }, select: { id: true, kayitNo: true, durum: true } })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (fif.durum !== FifDurum.FAALIYET && fif.durum !== FifDurum.ETKINLIK) {
    return NextResponse.json({ error: 'Etkinlik kontrolü yalnız faaliyet/etkinlik aşamasında yapılır' }, { status: 409 })
  }

  const satir = await prisma.fifFaaliyet.findFirst({
    where: { id: faaliyetId, fifId: id },
    select: {
      id: true, sira: true, sorumluUserId: true, sonuc: true, gerceklesenTarih: true, hedefTarih: true,
      parafUserId: true, parafTarihi: true, etkinlikPlanTarihi: true, etkinlikUygun: true,
    },
  })
  if (!satir) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })
  if (!faaliyetKapaliMi(satir)) return NextResponse.json({ error: 'Etkinlik kontrolü yalnız kapatılmış satırda yapılır' }, { status: 409 })
  if (satir.etkinlikUygun === true) return NextResponse.json({ error: 'Bu satırın etkinliği zaten onaylanmış' }, { status: 409 })

  const simdi = new Date()
  if (!etkinlikKontrolAcikMi(satir.etkinlikPlanTarihi, simdi)) {
    return NextResponse.json({
      error: satir.etkinlikPlanTarihi
        ? `Etkinlik kontrolü plan tarihinden en fazla ${FIF_ETKINLIK_ERKEN_GUN} gün önce yapılabilir (plan: ${gun(satir.etkinlikPlanTarihi)})`
        : 'Satırın etkinlik plan tarihi yok (eski akış)',
    }, { status: 409 })
  }
  if (!uygun) {
    if (!aciklama) return NextResponse.json({ error: 'Etkin değil kararı için açıklama zorunlu' }, { status: 400 })
    if (!yeniHedefTarih) return NextResponse.json({ error: 'Etkin değil kararı için yeni hedef tarih zorunlu' }, { status: 400 })
    if (gunFarki(simdi, yeniHedefTarih) < 0) return NextResponse.json({ error: 'Yeni hedef tarih bugünden önce olamaz' }, { status: 400 })
  }

  let faaliyeteDondu = false
  try {
    faaliyeteDondu = await prisma.$transaction(async (tx) => {
      if (uygun) {
        const r = await tx.fifFaaliyet.updateMany({
          where: { id: satir.id, etkinlikUygun: null },
          data: { etkinlikUygun: true, etkinlikKontrolUserId: userId, etkinlikKontrolTarihi: simdi },
        })
        if (r.count === 0) throw new EtkinlikHatasi('Satır başka bir işlemle değişti — sayfayı yenileyin', 409)
        await tx.fif.update({ where: { id }, data: { updatedAt: simdi } })
        await tx.fifGecmis.create({
          data: {
            fifId: id, eskiDurum: fif.durum, yeniDurum: fif.durum, userId, faaliyetId: satir.id,
            olay: FifGecmisOlay.ETKINLIK_KONTROL,
            aciklama: `Faaliyet #${satir.sira} etkinlik kontrolü: UYGUN${aciklama ? ` — ${aciklama}` : ''}`,
          },
        })
        return false
      }

      // ETKİN DEĞİL → satır yeniden açılır. Koşul: hâlâ kapalı ve değerlendirilmemiş.
      const r = await tx.fifFaaliyet.updateMany({
        where: { id: satir.id, etkinlikUygun: null, gerceklesenTarih: { not: null } },
        data: {
          hedefTarih: yeniHedefTarih as Date,
          gerceklesenTarih: null, parafUserId: null, parafTarihi: null, sonuc: null,
          etkinlikPlanTarihi: null, etkinlikHatirlatmaTarihi: null,
          etkinlikKontrolUserId: null, etkinlikKontrolTarihi: null, etkinlikUygun: null,
        },
      })
      if (r.count === 0) throw new EtkinlikHatasi('Satır başka bir işlemle değişti — sayfayı yenileyin', 409)
      await tx.fif.update({ where: { id }, data: { updatedAt: simdi } })
      await tx.fifGecmis.create({
        data: {
          fifId: id, eskiDurum: fif.durum, yeniDurum: FifDurum.FAALIYET, userId, faaliyetId: satir.id,
          olay: FifGecmisOlay.FAALIYET_YENIDEN_ACILDI,
          aciklama:
            `Faaliyet #${satir.sira} etkin DEĞİL — yeniden açıldı. Neden: ${aciklama}. ` +
            `Yeni hedef: ${gun(yeniHedefTarih as Date)}. Önceki değerler: hedef ${gun(satir.hedefTarih)}, ` +
            `gerçekleşen ${gun(satir.gerceklesenTarih)}, paraf ${satir.parafUserId ?? '—'} (${gun(satir.parafTarihi)}), ` +
            `sonuç ${satir.sonuc ?? '—'}, etkinlik planı ${gun(satir.etkinlikPlanTarihi)}`,
        },
      })
      if (fif.durum !== FifDurum.ETKINLIK) return false
      const g = await tx.fif.updateMany({ where: { id, durum: FifDurum.ETKINLIK }, data: { durum: FifDurum.FAALIYET } })
      if (g.count === 0) return false
      await tx.fifGecmis.create({
        data: {
          fifId: id, eskiDurum: FifDurum.ETKINLIK, yeniDurum: FifDurum.FAALIYET, userId, olay: FifGecmisOlay.DURUM_DEGISTI,
          aciklama: `Faaliyet #${satir.sira} etkin bulunmadı — FİF faaliyet aşamasına döndü`,
        },
      })
      return true
    })
  } catch (e) {
    if (e instanceof EtkinlikHatasi) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  if (!uygun && satir.sorumluUserId) {
    try {
      await fifKullaniciyaBildir(
        satir.sorumluUserId,
        fifBildirimKonusu(fif, 'Faaliyet yeniden açıldı'),
        `Faaliyet #${satir.sira} etkinlik kontrolünde etkin bulunmadı ve yeniden açıldı. Yeni hedef: ${(yeniHedefTarih as Date).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}. Neden: ${aciklama}`,
        `/kalite/fif/${id}`,
      )
    } catch (e) {
      console.error('[fif-faaliyet-etkinlik] bildirim:', e)
    }
  }

  return NextResponse.json({ ok: true, uygun, faaliyeteDondu })
}
