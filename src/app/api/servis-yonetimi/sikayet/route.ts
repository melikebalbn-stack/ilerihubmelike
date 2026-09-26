import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import type { ServisSikayetDurumu, ServisSikayetKategori, ServisSikayetKaynagi } from '@/generated/prisma'
import { sikayetFiltresiCoz, sikayetListesiGetir, sikayetOlustur, SikayetError } from '@/lib/servis-yonetimi/sikayet'

export const dynamic = 'force-dynamic'

// MASTER Madde 46 — şikâyet listesi + oluşturma.
//
// İŞ MANTIĞI BURADA TEKRAR EDİLMEZ: filtreleme, no üretimi, anlık kopya ve
// doğrulama Adım 2'nin sikayetOlustur/sikayetListesiGetir'inde. Bu dosya
// yalnız HTTP kabuğu: yetki, parametre ayrıştırma, durum kodu.
//
// Bu uç İÇ GÖRÜNÜMÜ döndürür (şikâyetçi kimliği DAHİL). Firma görünümü ucu
// BU ADIMDA YOK — firma raporuyla birlikte gelecek.


export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.sikayet.view')
  if (error) return error

  try {
    const sp = request.nextUrl.searchParams
    const data = await sikayetListesiGetir(sikayetFiltresiCoz(sp))

    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Şikâyet listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Şikâyet listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requirePermission('servis.sikayet.manage')
  if (error) return error

  try {
    const body = await request.json()
    const data = await sikayetOlustur({
      tarih: new Date(body.tarih),
      bildirimTarihi: new Date(body.bildirimTarihi),
      kategori: body.kategori,
      aciklama: body.aciklama,
      guzergahId: body.guzergahId,
      kaynak: body.kaynak,
      dilimId: body.dilimId ?? null,
      durakId: body.durakId ?? null,
      firmaId: body.firmaId ?? null,
      aracId: body.aracId ?? null,
      soforId: body.soforId ?? null,
      sikayetciPersonnelId: body.sikayetciPersonnelId ?? null,
      sorumluId: body.sorumluId ?? null,
      termin: body.termin ? new Date(body.termin) : null,
      planlananSaat: body.planlananSaat ?? null,
      createdById: userId,
    })

    return NextResponse.json({ ok: true, message: 'Şikâyet kaydedildi.', data }, { status: 201 })
  } catch (err) {
    // 🔴 Doğrulama hatası 400 — Adım 1/2'nin YOL GÖSTEREN mesajı kullanıcıya
    // olduğu gibi ulaşsın ("Açıklama alanına yazın", "ret gerekçesini..."),
    // 500'ün arkasında kaybolmasın.
    if (err instanceof SikayetError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 400 })
    }
    console.error('Şikâyet oluşturma hatası:', err)
    return NextResponse.json({ ok: false, message: 'Şikâyet kaydedilirken hata oluştu.' }, { status: 500 })
  }
}
