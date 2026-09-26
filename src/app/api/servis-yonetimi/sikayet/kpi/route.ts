import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { sikayetKpiHesapla } from '@/lib/servis-yonetimi/sikayet-kpi'
import { sikayetTarihAyikla } from '@/lib/servis-yonetimi/sikayet'

export const dynamic = 'force-dynamic'

// MASTER Madde 47 — firma performans özeti.
//
// YETKİ: servis.sikayet.view. Rapor için AYRI anahtar AÇILMADI — aynı veri,
// yalnız toplanmış hâli. Yeni bir anahtar, listeyi görebilen ama özetini
// göremeyen anlamsız bir rol kombinasyonu üretirdi.
//
// Hesap sikayet-kpi.ts'te; burada yalnız yetki + parametre ayrıştırma.

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.sikayet.view')
  if (error) return error

  try {
    const sp = request.nextUrl.searchParams
    const data = await sikayetKpiHesapla({
      firmaId: sp.get('firmaId') || undefined,
      guzergahId: sp.get('guzergahId') || undefined,
      bildirimBaslangic: sikayetTarihAyikla(sp.get('bildirimBaslangic')),
      bildirimBitis: sikayetTarihAyikla(sp.get('bildirimBitis')),
    })
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Şikâyet KPI hatası:', err)
    return NextResponse.json({ ok: false, message: 'Performans özeti alınırken hata oluştu.' }, { status: 500 })
  }
}
