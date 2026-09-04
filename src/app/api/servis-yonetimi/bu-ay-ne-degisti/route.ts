import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { buAyNeDegistiGetir } from '@/lib/servis-yonetimi/bu-ay-ne-degisti'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/bu-ay-ne-degisti?yil=2026&ay=7 — FAZ 1B-EK
// Madde 31, Adım 2. servis.view yeterli (salt okunur bir özet ekranı).
// yil/ay ZORUNLU query parametreleri — Adım 1'in servis fonksiyonu
// (buAyNeDegistiGetir) varsayılan "cari ay" davranışına sahip olsa da bu
// uç, hangi ayın istendiğini HER ZAMAN açık istiyor (yanlışlıkla cari ay
// dönüp kullanıcının farklı bir ay istediğini fark etmemesini önlemek
// için) — KVKK/veri kontratı Adım 1'deki buAyNeDegistiGetir'den birebir
// devralınır, burada hiçbir alan filtrelenmez/eklenmez.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error

  const yilParam = request.nextUrl.searchParams.get('yil')
  const ayParam = request.nextUrl.searchParams.get('ay')

  if (!yilParam || !ayParam) {
    return NextResponse.json({ ok: false, message: 'yil ve ay query parametreleri zorunludur.' }, { status: 400 })
  }

  const yil = Number(yilParam)
  const ay = Number(ayParam)

  if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) {
    return NextResponse.json({ ok: false, message: 'Geçersiz yıl.' }, { status: 400 })
  }
  if (!Number.isInteger(ay) || ay < 1 || ay > 12) {
    return NextResponse.json({ ok: false, message: 'Ay 1 ile 12 arasında olmalıdır.' }, { status: 400 })
  }

  try {
    const data = await buAyNeDegistiGetir(yil, ay)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Bu Ay Ne Değişti hatası:', err)
    return NextResponse.json({ ok: false, message: 'Rapor alınırken hata oluştu.' }, { status: 500 })
  }
}
