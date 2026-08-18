import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { ZimmetOnayDurumu, ZimmetKaynak } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

type Karar = { id: string; karar: 'KABUL' | 'RED'; sebep?: string }

/**
 * POST /api/zimmet-formu/devir-onay
 *
 * Syteline devir kayıtlarının SAHİP tarafından kısmi onayı. Kişi kendi üzerine
 * kayıtlı devir kayıtlarını tek istekte KABUL/RED eder. Permission YOK — herkes
 * KENDİ kayıtlarını onaylar (self-approval burada BİLİNÇLİ; onayla/route.ts'teki
 * self-approval guard'ı bu ucu etkilemez — ayrı endpoint).
 *
 * Fail-closed: kararlardan biri bile doğrulamadan geçmezse HİÇ yazma yapılmaz.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    let body: { kararlar?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
    }

    const ham = Array.isArray(body.kararlar) ? body.kararlar : null
    if (!ham || ham.length === 0) {
      return NextResponse.json({ error: 'kararlar boş olamaz' }, { status: 400 })
    }

    // Karar girdilerini normalize + şekil doğrula.
    const kararlar: Karar[] = []
    for (const k of ham) {
      const o = k as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id : null
      const karar = o.karar === 'KABUL' || o.karar === 'RED' ? o.karar : null
      const sebep = typeof o.sebep === 'string' ? o.sebep : undefined
      if (!id || !karar) {
        return NextResponse.json({ error: 'Geçersiz karar girdisi (id/karar)' }, { status: 400 })
      }
      kararlar.push({ id, karar, sebep })
    }

    const ids = kararlar.map((k) => k.id)
    const kayitlar = await prisma.zimmetFormu.findMany({
      where: { id: { in: ids }, silindiMi: false },
      select: { id: true, zimmetSahibiId: true, kaynak: true, durum: true },
    })
    const kayitMap = new Map(kayitlar.map((z) => [z.id, z]))

    // ── Doğrulama: biri bile geçmezse HİÇ yazma ──
    for (const k of kararlar) {
      const z = kayitMap.get(k.id)
      if (!z) {
        return NextResponse.json({ error: `Zimmet formu bulunamadı: ${k.id}` }, { status: 404 })
      }
      if (z.zimmetSahibiId !== user.id) {
        return NextResponse.json({ error: 'Yalnız kendi üzerinize kayıtlı devirleri onaylayabilirsiniz' }, { status: 403 })
      }
      if (z.kaynak !== ZimmetKaynak.SYTELINE_DEVIR) {
        return NextResponse.json({ error: 'Bu akış yalnız devir kayıtları içindir' }, { status: 409 })
      }
      if (z.durum !== ZimmetOnayDurumu.ONAY_BEKLIYOR) {
        return NextResponse.json({ error: 'Bu zimmet formu zaten işleme alınmış' }, { status: 409 })
      }
      if (k.karar === 'RED' && !k.sebep?.trim()) {
        return NextResponse.json({ error: 'Red gerekçesi zorunlu' }, { status: 400 })
      }
    }

    // ── Tek transaction: karar uygula + her kayıt için durum geçmişi ──
    const simdi = new Date()
    await prisma.$transaction(async (tx) => {
      for (const k of kararlar) {
        if (k.karar === 'KABUL') {
          await tx.zimmetFormu.update({
            where: { id: k.id },
            data: {
              durum: ZimmetOnayDurumu.ONAYLANDI,
              onayTarihi: simdi,
              onaylayanId: user.id,
              zimmetSahibiImzaTarihi: simdi,
              imzaModu: 'DIJITAL',
            },
          })
        } else {
          await tx.zimmetFormu.update({
            where: { id: k.id },
            data: {
              durum: ZimmetOnayDurumu.REDDEDILDI,
              redSebebi: k.sebep!.trim(),
            },
          })
        }
        await tx.zimmetDurumGecmisi.create({
          data: {
            zimmetId: k.id,
            eskiDurum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
            yeniDurum: k.karar === 'KABUL' ? ZimmetOnayDurumu.ONAYLANDI : ZimmetOnayDurumu.REDDEDILDI,
            islemYapanId: user.id,
            not: k.karar === 'RED' ? `Devir reddi: ${k.sebep!.trim()}` : 'Devir onayı (sahip)',
          },
        })
      }
    })

    const kabul = kararlar.filter((k) => k.karar === 'KABUL').length
    const red = kararlar.filter((k) => k.karar === 'RED').length
    return NextResponse.json({ kabul, red })
  } catch (err) {
    console.error('[POST /api/zimmet-formu/devir-onay]', err)
    return NextResponse.json({ error: 'İşlem tamamlanamadı' }, { status: 500 })
  }
}
