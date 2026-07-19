import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listOperatorEslemeleri, addOperatorEsleme } from '@/lib/ipro/yonetim-service'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/yonetim/operator-eslemeleri?tezgahId=...
export async function GET(request: Request) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  const tezgahId = new URL(request.url).searchParams.get('tezgahId')
  if (!tezgahId) return NextResponse.json({ ok: false, error: 'tezgahId gerekli' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, eslemeler: await listOperatorEslemeleri(tezgahId) })
  } catch (e) {
    return iproHata(e, 'Eşlemeler alınamadı')
  }
}

// POST — personeli tezgaha ekle (varsa yeniden aktifleştirir)
export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const body = await request.json()
    const tezgahId = zorunluMetin(body?.tezgahId, 'tezgahId')
    const personnelId = zorunluMetin(body?.personnelId, 'personnelId')
    return NextResponse.json({ ok: true, esleme: await addOperatorEsleme(tezgahId, personnelId) }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Eşleme eklenemedi')
  }
}
