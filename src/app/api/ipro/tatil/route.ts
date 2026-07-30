import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listTatiller, createTatil, gecerliTatilTip, type TatilGirdi } from '@/lib/ipro/takvim'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin', 'ipro.takvim.yonet'])
  if (error) return error
  try {
    const url = new URL(request.url)
    const yil = Number(url.searchParams.get('yil')) || new Date().getUTCFullYear()
    return NextResponse.json({ ok: true, yil, tatiller: await listTatiller(yil) })
  } catch (e) {
    return iproHata(e, 'Takvim alınamadı')
  }
}

export async function POST(request: Request) {
  const { userId, error } = await requirePermission('ipro.takvim.yonet')
  if (error) return error
  try {
    const b = await request.json()
    const tarihStr = zorunluMetin(b?.tarih, 'Tarih') // 'YYYY-MM-DD'
    const tip = b?.tip
    if (!gecerliTatilTip(tip)) return NextResponse.json({ ok: false, error: 'tip TATIL|YARIM|MESAI olmalı' }, { status: 400 })
    const tarih = new Date(`${tarihStr}T00:00:00.000Z`)
    if (Number.isNaN(tarih.getTime())) return NextResponse.json({ ok: false, error: 'Geçersiz tarih' }, { status: 400 })
    const data: TatilGirdi = { tarih, tip, aciklama: zorunluMetin(b?.aciklama, 'Açıklama'), createdById: userId }
    return NextResponse.json({ ok: true, tatil: await createTatil(data) }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Takvim kaydı eklenemedi')
  }
}
