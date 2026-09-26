import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import type { ServisSikayetDurumu } from '@/generated/prisma'
import { SikayetError } from '@/lib/servis-yonetimi/sikayet'
import { sikayetDurumDegistir } from '@/lib/servis-yonetimi/sikayet-durum-uygula'

export const dynamic = 'force-dynamic'

// MASTER Madde 46 — durum geçişi.
//
// Geçiş kuralı, yeniden açma yaması, alan tutarlılığı ve ServisIslemGecmisi
// yazımı Adım 1/3'te. Burada ikinci bir doğrulama YOK: uç yalnız gövdeyi
// iletir ve hatayı doğru HTTP koduna çevirir.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.sikayet.manage')
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    const data = await sikayetDurumDegistir({
      sikayetId: id,
      yeniDurum: body.durum as ServisSikayetDurumu,
      alanlar: {
        ...(body.aksiyon !== undefined ? { aksiyon: body.aksiyon } : {}),
        ...(body.aksiyonTarihi !== undefined
          ? { aksiyonTarihi: body.aksiyonTarihi ? new Date(body.aksiyonTarihi) : null }
          : {}),
        ...(body.kapanisTarihi !== undefined
          ? { kapanisTarihi: body.kapanisTarihi ? new Date(body.kapanisTarihi) : null }
          : {}),
        ...(body.kapanisNotu !== undefined ? { kapanisNotu: body.kapanisNotu } : {}),
      },
      userId,
      aciklama: body.aciklama ?? null,
    })

    return NextResponse.json({ ok: true, message: 'Şikâyet durumu güncellendi.', data })
  } catch (err) {
    // 🔴 400 — Adım 1'in yol gösteren mesajı kullanıcıya ULAŞSIN:
    // "Kapatmadan önce ne yapıldığını 'Aksiyon alındı' adımında kaydedin..."
    // 500'ün arkasında kaybolmamalı. Kayıt bulunamadı da buraya düşer.
    if (err instanceof SikayetError) {
      const bulunamadi = err.message.includes('bulunamadı')
      return NextResponse.json({ ok: false, message: err.message }, { status: bulunamadi ? 404 : 400 })
    }
    console.error('Şikâyet durum değiştirme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Durum güncellenirken hata oluştu.' }, { status: 500 })
  }
}
