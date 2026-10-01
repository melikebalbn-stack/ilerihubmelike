import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif, fifKapsamindaMi } from '@/lib/quality/fif-access'
import { faaliyetKapaliMi, gunFarki, istanbulGunu } from '@/lib/quality/fif-termin'
import { fifEkTerminTalepInput } from '@/lib/quality/fif-validators'
import { fifKullaniciyaBildir, fifBildirimKonusu } from '@/lib/quality/fif-bildirim'
import { kssKoltukKullanicilari } from '@/lib/quality/fif-zincir'
import { FifDurum, FifEkTerminDurum, FifGecmisOlay } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

class TalepHatasi extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/**
 * POST /api/kalite/fif/[id]/faaliyet/[faaliyetId]/ek-termin — "Ek Termin İste" (Paket 3b-2).
 *
 * Eski ES (doğrudan tarih değiştirme) yerine: satır sorumlusu (veya manage) yeni
 * hedef tarih + neden ile TALEP açar; hedef tarih ancak KSS onayında değişir.
 * Şartlar: FİF FAALIYET, satır açık, hedef dolu, istenen > mevcut hedef (İstanbul
 * günü), satırda BEKLEYEN talep yok. Tek transaction: FifEkTermin BEKLIYOR +
 * FifGecmis EK_TERMIN_TALEP (faaliyetId) + Fif.updatedAt. Bildirim: tüm KSS'ler.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; faaliyetId: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id, faaliyetId } = await params

  const parsed = fifEkTerminTalepInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const { istenenHedefTarih, neden } = parsed.data

  const fif = await prisma.fif.findUnique({
    where: { id },
    select: { id: true, kayitNo: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true },
  })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })
  if (fif.durum !== FifDurum.FAALIYET) {
    return NextResponse.json({ error: 'Ek termin yalnız FİF faaliyet aşamasındayken istenebilir' }, { status: 409 })
  }

  const satir = await prisma.fifFaaliyet.findFirst({
    where: { id: faaliyetId, fifId: id },
    select: { id: true, sira: true, hedefTarih: true, sorumluUserId: true, sonuc: true, gerceklesenTarih: true },
  })
  if (!satir) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })
  if (!canManageFif(session) && (!userId || satir.sorumluUserId !== userId)) {
    return NextResponse.json({ error: 'Ek termini yalnız satırın sorumlu kişisi isteyebilir' }, { status: 403 })
  }
  if (faaliyetKapaliMi(satir)) return NextResponse.json({ error: 'Kapatılmış faaliyet için ek termin istenemez' }, { status: 409 })
  if (!satir.hedefTarih) return NextResponse.json({ error: 'Hedef tarihi olmayan faaliyet için ek termin istenemez' }, { status: 400 })
  if (gunFarki(satir.hedefTarih, istenenHedefTarih) <= 0) {
    return NextResponse.json({ error: 'İstenen tarih mevcut hedef tarihten sonra olmalı' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Bekleyen talep kontrolü transaction içinde (çift tıklama / iki sekme).
      const bekleyen = await tx.fifEkTermin.count({ where: { faaliyetId: satir.id, durum: FifEkTerminDurum.BEKLIYOR } })
      if (bekleyen > 0) throw new TalepHatasi('Bu satır için onay bekleyen bir ek termin talebi zaten var', 409)
      await tx.fifEkTermin.create({
        data: {
          faaliyetId: satir.id, talepEdenUserId: userId as string,
          mevcutHedefTarih: satir.hedefTarih, istenenHedefTarih, neden,
        },
      })
      await tx.fif.update({ where: { id }, data: { updatedAt: new Date() } })
      await tx.fifGecmis.create({
        data: {
          fifId: id, eskiDurum: FifDurum.FAALIYET, yeniDurum: FifDurum.FAALIYET, userId,
          faaliyetId: satir.id, olay: FifGecmisOlay.EK_TERMIN_TALEP,
          aciklama: `Ek termin talebi #${satir.sira}: ${istanbulGunu(satir.hedefTarih as Date)} → ${istanbulGunu(istenenHedefTarih)}, neden: ${neden}`,
        },
      })
    })
  } catch (e) {
    if (e instanceof TalepHatasi) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  try {
    const konu = fifBildirimKonusu(fif, 'Ek termin talebi')
    const govde = `Faaliyet #${satir.sira} için yeni hedef tarih istendi: ${istenenHedefTarih.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}. Neden: ${neden}`
    for (const k of await kssKoltukKullanicilari(prisma)) await fifKullaniciyaBildir(k.userId, konu, govde, `/kalite/fif/${id}`)
  } catch (e) {
    console.error('[fif-ek-termin] bildirim:', e)
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
