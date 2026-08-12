import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { eklenebilirOperatorler, topluOperatorEsleme } from '@/lib/ipro/yonetim-service'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/yonetim/operator-eslemeleri/toplu?tezgahId=... — bu tezgaha TOPLU eklenebilecek
// adaylar (aktif personel − zaten aktif eşli olanlar), bölüm filtresi için `bolum` ile.
export async function GET(request: Request) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  const tezgahId = new URL(request.url).searchParams.get('tezgahId')
  if (!tezgahId) return NextResponse.json({ ok: false, error: 'tezgahId gerekli' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, adaylar: await eklenebilirOperatorler(tezgahId) })
  } catch (e) {
    return iproHata(e, 'Adaylar alınamadı')
  }
}

// POST — { tezgahId, personnelIds[] } → tezgaha TOPLU eşle (Melike #4). Pasif eşleme reaktive,
// yeni eklenir (kaynak='TOPLU'), zaten aktif atlanır. ipro.admin guard. is-basla ETKİLENMEZ
// (eşleme yalnız kiosk operatör-seçim listesini filtreler, zorunlu kapı değil).
export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const body = await request.json()
    const tezgahId = zorunluMetin(body?.tezgahId, 'tezgahId')
    const personnelIds = body?.personnelIds
    if (!Array.isArray(personnelIds) || personnelIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'personnelIds (boş olmayan dizi) gerekli' }, { status: 400 })
    }
    const sonuc = await topluOperatorEsleme(tezgahId, personnelIds)
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Toplu eşleme başarısız')
  }
}
