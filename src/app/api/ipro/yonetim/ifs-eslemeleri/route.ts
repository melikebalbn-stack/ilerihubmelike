import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listIfsEslemeleri, createIfsEsleme } from '@/lib/ipro/yonetim-service'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, eslemeler: await listIfsEslemeleri() })
  } catch (e) {
    return iproHata(e, 'IFS eşlemeleri alınamadı')
  }
}

export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const b = await request.json()
    const tip = zorunluMetin(b?.tip, 'Tip')
    if (tip !== 'ORG' && tip !== 'POZISYON') {
      return NextResponse.json({ ok: false, error: "Tip 'ORG' veya 'POZISYON' olmalı" }, { status: 400 })
    }
    const esleme = await createIfsEsleme({
      tip,
      ilerihubDeger: zorunluMetin(b?.ilerihubDeger, 'ILERIHub değeri'),
      ifsKod: zorunluMetin(b?.ifsKod, 'IFS kodu'),
      aciklama: b?.aciklama || null,
      aktif: b?.aktif === undefined ? true : Boolean(b.aktif),
    })
    return NextResponse.json({ ok: true, esleme }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Eşleme eklenemedi')
  }
}
