import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listVardiyalar, createVardiya, gecerliSaat, type VardiyaGirdi } from '@/lib/ipro/takvim'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, vardiyalar: await listVardiyalar() })
  } catch (e) {
    return iproHata(e, 'Vardiyalar alınamadı')
  }
}

export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const b = await request.json()
    const baslangicSaat = zorunluMetin(b?.baslangicSaat, 'Başlangıç Saati')
    const bitisSaat = zorunluMetin(b?.bitisSaat, 'Bitiş Saati')
    if (!gecerliSaat(baslangicSaat) || !gecerliSaat(bitisSaat)) {
      return NextResponse.json({ ok: false, error: 'Saat formatı HH:mm olmalı (ör. 07:00)' }, { status: 400 })
    }
    const data: VardiyaGirdi = {
      kod: zorunluMetin(b?.kod, 'Kod'),
      ad: zorunluMetin(b?.ad, 'Ad'),
      baslangicSaat,
      bitisSaat,
      ertesiGuneTasar: Boolean(b?.ertesiGuneTasar),
      sira: Number.isFinite(Number(b?.sira)) ? Number(b.sira) : 0,
      aktif: b?.aktif === undefined ? true : Boolean(b.aktif),
    }
    return NextResponse.json({ ok: true, vardiya: await createVardiya(data) }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Vardiya eklenemedi')
  }
}
