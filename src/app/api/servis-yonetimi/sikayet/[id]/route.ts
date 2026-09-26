import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { sikayetDetayGetir } from '@/lib/servis-yonetimi/sikayet'

export const dynamic = 'force-dynamic'

// MASTER Madde 46 — şikâyet detayı (iç görünüm, şikâyetçi kimliği dahil).
// Sorgu sikayet.ts'te; burada yalnız yetki + 404.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.sikayet.view')
  if (error) return error

  try {
    const { id } = await params
    const data = await sikayetDetayGetir(id)
    if (!data) {
      return NextResponse.json({ ok: false, message: 'Şikâyet kaydı bulunamadı.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Şikâyet detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Şikâyet kaydı alınırken hata oluştu.' }, { status: 500 })
  }
}
