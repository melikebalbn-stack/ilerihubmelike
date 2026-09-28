import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { talepOlustur } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/talepler — talep aç (kendi ya da "adına"). Akış: yönetici → İV; yöneticinin adına açtığı,
// müdür muafiyeti, sahipsiz ve YALNIZ_IV türü doğrudan İV'ye.
export async function POST(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await talepOlustur(ctx, (await req.json()) ?? {})) }, { status: 201 })
  } catch (e) {
    return izinHata(e, 'Talep oluşturulamadı')
  }
}
