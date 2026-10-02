import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import {
  MAX_BYTES,
  dosyaUrl,
  guvenliDosyaAdi,
  hedefDizinHazirla,
  mimeGecerli,
} from '@/lib/quality/uygunsuzluk-dosya'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Uygunsuzluk döküman ekleri.
 * GET  — kaydın dosya listesi. Auth: oturum (liste ucuyla aynı).
 * POST — multipart/form-data, alan adı `files` (çoklu). Auth: canManageUygunsuzluk.
 * Desen: rma/[id]/foto/route.ts birebir, MIME kısıtı farklı (genel döküman da kabul).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession()
  if (error) return error
  const { id } = await params

  const kayit = await prisma.kaliteUygunsuzluk.findUnique({ where: { id }, select: { id: true } })
  if (!kayit) return NextResponse.json({ error: 'Uygunsuzluk kaydı bulunamadı' }, { status: 404 })

  const dosyalar = await prisma.kaliteUygunsuzlukDosya.findMany({
    where: { uygunsuzlukId: id },
    orderBy: { yuklemeTarihi: 'desc' },
  })
  return NextResponse.json({ dosyalar })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { session, userId, error } = await requireSession()
    if (error) return error
    if (!canManageUygunsuzluk(session)) {
      return NextResponse.json({ error: 'Döküman yükleme yetkiniz yok' }, { status: 403 })
    }
    const { id } = await params

    const kayit = await prisma.kaliteUygunsuzluk.findUnique({ where: { id }, select: { id: true } })
    if (!kayit) return NextResponse.json({ error: 'Uygunsuzluk kaydı bulunamadı' }, { status: 404 })

    const formData = await request.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    // ÖNCE hepsini doğrula, SONRA yaz — yarım yükleme olmasın.
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `"${file.name}" 10MB sınırını aşıyor (${(file.size / 1024 / 1024).toFixed(1)}MB)` },
          { status: 400 },
        )
      }
      if (!mimeGecerli(file.type)) {
        return NextResponse.json(
          { error: `"${file.name}" desteklenmiyor (resim, PDF, Word ya da Excel olmalı)` },
          { status: 400 },
        )
      }
    }

    const { absDir, yil, ay } = await hedefDizinHazirla()
    const yazilan: { dosyaUrl: string; dosyaAdi: string; dosyaTipi: string; dosyaBoyutu: number }[] = []

    for (const file of files) {
      const dosyaAdi = guvenliDosyaAdi(file.name)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(path.join(absDir, dosyaAdi), buffer)
      yazilan.push({
        dosyaUrl: dosyaUrl(yil, ay, dosyaAdi),
        dosyaAdi: file.name,
        dosyaTipi: file.type,
        dosyaBoyutu: file.size,
      })
    }

    await prisma.kaliteUygunsuzlukDosya.createMany({
      data: yazilan.map((y) => ({ ...y, uygunsuzlukId: id, yukleyenId: userId })),
    })

    const dosyalar = await prisma.kaliteUygunsuzlukDosya.findMany({
      where: { uygunsuzlukId: id },
      orderBy: { yuklemeTarihi: 'desc' },
    })
    return NextResponse.json({ dosyalar, eklenen: yazilan.length })
  } catch (err) {
    console.error('Uygunsuzluk döküman yükleme hatası:', err)
    return NextResponse.json({ error: 'Dosya yüklenemedi' }, { status: 500 })
  }
}
