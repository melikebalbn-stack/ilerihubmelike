import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { hasPermission } from '@/lib/auth/has-permission'
import { iproHata } from '@/lib/ipro/yonetim-hata'
import {
  ayarVerisi, esikKaydet, tezgahIstisnaKaydet, tezgahIstisnaSil,
  molaKaydet, molaPasifYap, vardiyaKaydet, tatilEkle, tatilSil, carpanKaydet, carpanSil,
} from '@/lib/ipro/ayar-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/ayarlar → tüm ayar verisi + canEdit (IPRO görüntüleme izni yeter).
export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    const [veri, canEdit] = await Promise.all([ayarVerisi(), hasPermission('ipro.ayar.duzenle')])
    return NextResponse.json({ ok: true, canEdit, ...veri })
  } catch (e) {
    return iproHata(e, 'Ayarlar alınamadı')
  }
}

// POST /api/ipro/ayarlar → { action, ... } (düzenleme — IPRO_AYAR_DUZENLE gerekir). Her mutasyon audit'li.
export async function POST(req: Request) {
  const { userId, error } = await requirePermission('ipro.ayar.duzenle')
  if (error) return error
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek' }, { status: 400 })
  }
  const action = String(body.action ?? '')
  const n = (v: unknown): number => Number(v)
  const s = (v: unknown): string => String(v ?? '')
  const sOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v))
  const nOrNull = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
  try {
    switch (action) {
      case 'esik':
        await esikKaydet(userId, n(body.carpan), n(body.taban), n(body.tavan)); break
      case 'tezgah-istisna':
        await tezgahIstisnaKaydet(userId, s(body.tezgahId), nOrNull(body.tabanSn), nOrNull(body.tavanSn), sOrNull(body.not)); break
      case 'tezgah-istisna-sil':
        await tezgahIstisnaSil(userId, s(body.tezgahId)); break
      case 'mola':
        await molaKaydet(userId, {
          id: sOrNull(body.id) ?? undefined, vardiyaId: s(body.vardiyaId), bolum: sOrNull(body.bolum),
          sebepId: s(body.sebepId), baslangic: s(body.baslangic), sureDk: n(body.sureDk), gunMaskesi: n(body.gunMaskesi),
        }); break
      case 'mola-pasif':
        await molaPasifYap(userId, s(body.id), !!body.aktif); break
      case 'vardiya':
        await vardiyaKaydet(userId, s(body.id), s(body.baslangicSaat), s(body.bitisSaat), !!body.ertesiGuneTasar); break
      case 'tatil-ekle':
        await tatilEkle(userId, s(body.tarih), s(body.tip), s(body.aciklama)); break
      case 'tatil-sil':
        await tatilSil(userId, s(body.id)); break
      case 'carpan':
        await carpanKaydet(userId, {
          id: sOrNull(body.id) ?? undefined, parcaNo: s(body.parcaNo), operasyonNo: s(body.operasyonNo),
          tezgahKod: sOrNull(body.tezgahKod), carpan: n(body.carpan),
        }); break
      case 'carpan-sil':
        await carpanSil(userId, s(body.id)); break
      default:
        return NextResponse.json({ ok: false, error: 'Bilinmeyen işlem' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'İşlem başarısız' }, { status: 400 })
  }
}
