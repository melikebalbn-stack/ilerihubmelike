import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { talepOlustur } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/talepler — talep aç (kendi ya da "adına"). Belge zorunlu türlerde multipart. Akış: yönetici → İV; yöneticinin adına açtığı,
// müdür muafiyeti, sahipsiz ve YALNIZ_IV türü doğrudan İV'ye.
export async function POST(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    // Faz 4: belge isteyen türlerde multipart (veri = JSON alanlar, belge = dosya); diğerlerinde JSON da olur.
    let govde: Record<string, unknown>
    let belge: { icerik: Uint8Array; ad: string } | null = null
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const fd = await req.formData()
      govde = JSON.parse(String(fd.get('veri') ?? '{}'))
      const f = fd.get('belge')
      if (f instanceof File && f.size > 0) belge = { icerik: new Uint8Array(await f.arrayBuffer()), ad: f.name }
    } else govde = (await req.json()) ?? {}
    return NextResponse.json({ ok: true, ...(await talepOlustur(ctx, govde, belge)) }, { status: 201 })
  } catch (e) {
    return izinHata(e, 'Talep oluşturulamadı')
  }
}
