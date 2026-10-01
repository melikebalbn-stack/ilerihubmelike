import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { isFifKss } from '@/lib/quality/fif-access'
import { faaliyetKapaliMi, istanbulGunu } from '@/lib/quality/fif-termin'
import { fifEkTerminKararInput } from '@/lib/quality/fif-validators'
import { fifKullaniciyaBildir, fifBildirimKonusu } from '@/lib/quality/fif-bildirim'
import { FifDurum, FifEkTerminDurum, FifGecmisOlay, FifSonuc } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

class KararHatasi extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/**
 * PATCH /api/kalite/fif/[id]/faaliyet/[faaliyetId]/ek-termin/[talepId] — KSS kararı.
 *
 * SADECE KSS (KSS koltuğu). ONAYLANDI: satırın hedefTarih'i istenen tarihe alınır
 * (ilkHedefTarih DEĞİŞMEZ; boşsa talepteki mevcut hedefle doldurulur), sonuc=ES
 * ("Ek Süre" — raporlarda ek süre almış satır olarak görünür), EK_TERMIN_ONAY.
 * REDDEDILDI: kararNotu zorunlu, EK_TERMIN_RED. İkisinde de Fif.updatedAt +
 * satır sorumlusuna (ve talep eden farklıysa ona) bildirim.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; faaliyetId: string; talepId: string }> },
) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!(await isFifKss(session))) return NextResponse.json({ error: 'Ek termin kararını yalnız KSS verebilir' }, { status: 403 })
  const { id, faaliyetId, talepId } = await params

  const parsed = fifEkTerminKararInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const { karar, kararNotu } = parsed.data
  if (karar === FifEkTerminDurum.REDDEDILDI && !kararNotu) {
    return NextResponse.json({ error: 'Red için karar notu zorunlu' }, { status: 400 })
  }

  const talep = await prisma.fifEkTermin.findFirst({
    where: { id: talepId, faaliyetId, faaliyet: { fifId: id } },
    select: {
      id: true, durum: true, talepEdenUserId: true, mevcutHedefTarih: true, istenenHedefTarih: true, neden: true,
      faaliyet: {
        select: {
          id: true, sira: true, sorumluUserId: true, sonuc: true, gerceklesenTarih: true, ilkHedefTarih: true, hedefTarih: true,
          fif: { select: { id: true, kayitNo: true, durum: true } },
        },
      },
    },
  })
  if (!talep) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
  if (talep.durum !== FifEkTerminDurum.BEKLIYOR) return NextResponse.json({ error: 'Bu talep zaten karara bağlanmış' }, { status: 409 })
  const satir = talep.faaliyet
  if (karar === FifEkTerminDurum.ONAYLANDI) {
    if (satir.fif.durum !== FifDurum.FAALIYET) return NextResponse.json({ error: 'FİF faaliyet aşamasında değil' }, { status: 409 })
    if (faaliyetKapaliMi(satir)) return NextResponse.json({ error: 'Satır kapatılmış — ek termin onaylanamaz, reddedin' }, { status: 409 })
  }

  const simdi = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      // Koşullu: iki KSS aynı anda karar verirse ikincisi 409 alır.
      const r = await tx.fifEkTermin.updateMany({
        where: { id: talep.id, durum: FifEkTerminDurum.BEKLIYOR },
        data: { durum: karar, kararUserId: userId, kararTarihi: simdi, kararNotu: kararNotu ?? null },
      })
      if (r.count === 0) throw new KararHatasi('Bu talep zaten karara bağlanmış', 409)

      const eski = talep.mevcutHedefTarih ? istanbulGunu(talep.mevcutHedefTarih) : '—'
      const yeni = istanbulGunu(talep.istenenHedefTarih)
      if (karar === FifEkTerminDurum.ONAYLANDI) {
        await tx.fifFaaliyet.update({
          where: { id: satir.id },
          data: {
            hedefTarih: talep.istenenHedefTarih,
            sonuc: FifSonuc.ES,
            ...(!satir.ilkHedefTarih && talep.mevcutHedefTarih ? { ilkHedefTarih: talep.mevcutHedefTarih } : {}),
          },
        })
      }
      await tx.fif.update({ where: { id }, data: { updatedAt: simdi } })
      await tx.fifGecmis.create({
        data: {
          fifId: id, eskiDurum: satir.fif.durum, yeniDurum: satir.fif.durum, userId, faaliyetId: satir.id,
          olay: karar === FifEkTerminDurum.ONAYLANDI ? FifGecmisOlay.EK_TERMIN_ONAY : FifGecmisOlay.EK_TERMIN_RED,
          aciklama: karar === FifEkTerminDurum.ONAYLANDI
            ? `Ek termin onaylandı #${satir.sira}: ${eski} → ${yeni}${kararNotu ? `, not: ${kararNotu}` : ''}`
            : `Ek termin reddedildi #${satir.sira} (istenen ${yeni}): ${kararNotu}`,
        },
      })
    })
  } catch (e) {
    if (e instanceof KararHatasi) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  try {
    const onay = karar === FifEkTerminDurum.ONAYLANDI
    const konu = fifBildirimKonusu(satir.fif, onay ? 'Ek termin onaylandı' : 'Ek termin reddedildi')
    const govde = onay
      ? `Faaliyet #${satir.sira} için yeni hedef tarih: ${talep.istenenHedefTarih.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}.`
      : `Faaliyet #${satir.sira} ek termin talebiniz reddedildi: ${kararNotu}`
    const alicilar = new Set([satir.sorumluUserId, talep.talepEdenUserId].filter((x): x is string => !!x))
    for (const a of alicilar) await fifKullaniciyaBildir(a, konu, govde, `/kalite/fif/${id}`)
  } catch (e) {
    console.error('[fif-ek-termin-karar] bildirim:', e)
  }

  return NextResponse.json({ ok: true, durum: karar })
}
