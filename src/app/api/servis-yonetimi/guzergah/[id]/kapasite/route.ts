import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { servisKapasiteOzetiGetir } from '@/lib/servis-yonetimi/kapasite'

function hesapTarihiParse(value: string | null): Date | undefined {
  if (value === null) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Hesap tarihi YYYY-MM-DD formatında olmalıdır.')
  const tarih = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(tarih.getTime()) || tarih.toISOString().slice(0, 10) !== value) {
    throw new Error('Hesap tarihi geçersiz.')
  }
  return tarih
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error

  try {
    const { id: guzergahId } = await params
    const dilimId = request.nextUrl.searchParams.get('dilimId')?.trim()
    if (!dilimId) {
      return NextResponse.json({ ok: false, message: 'Sefer dilimi zorunludur.' }, { status: 400 })
    }
    const hesapTarihi = hesapTarihiParse(request.nextUrl.searchParams.get('tarih'))
    const data = await servisKapasiteOzetiGetir(guzergahId, dilimId, hesapTarihi)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kapasite özeti alınamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
