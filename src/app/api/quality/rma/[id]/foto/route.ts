import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageRma } from '@/lib/quality/rma-access'
import {
  MAX_BYTES,
  fotoUrl,
  guvenliDosyaAdi,
  hedefDizinHazirla,
  mimeGecerli,
} from '@/lib/quality/rma-foto-dosya'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * RMA/SMA fotoğrafları.
 *
 * GET  — kaydın fotoğraf listesi. Auth: oturum (okuma herkese açık, liste ucuyla aynı).
 * POST — multipart/form-data, alan adı `files` (çoklu). Auth: canManageRma.
 *
 * DEPOLAMA: public/uploads/kalite/rma/<YYYY>/<MM>/ — `public/uploads` paylaşımlı
 * dizine SYMLINK, blue-green swap'te kaybolmaz. Servis: /api/files/[...path]
 * (oturum kontrollü); nginx statik servis etmiyor.
 *
 * Doğrulama tickets/upload deseni: ÖNCE hepsi doğrulanır, SONRA yazılır — ya hepsi
 * ya hiç. RMA'da PDF kabul EDİLMEZ, yalnız görsel (image/*).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession()
  if (error) return error
  const { id } = await params

  const kayit = await prisma.rmaKayit.findUnique({ where: { id }, select: { id: true } })
  if (!kayit) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

  const fotolar = await prisma.rmaFoto.findMany({
    where: { rmaKayitId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, dosyaYolu: true, dosyaAdi: true, mimeType: true, createdAt: true },
  })
  return NextResponse.json({ fotolar })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { session, userId, error } = await requireSession()
    if (error) return error
    if (!canManageRma(session)) {
      return NextResponse.json({ error: 'Fotoğraf yükleme yetkiniz yok' }, { status: 403 })
    }
    const { id } = await params

    const kayit = await prisma.rmaKayit.findUnique({ where: { id }, select: { id: true } })
    if (!kayit) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

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
          { error: `"${file.name}" desteklenmiyor. Yalnız resim dosyası yüklenebilir.` },
          { status: 400 },
        )
      }
    }

    const { absDir, yil, ay } = await hedefDizinHazirla()
    const yazilan: { dosyaYolu: string; dosyaAdi: string; mimeType: string }[] = []

    for (const file of files) {
      const dosyaAdi = guvenliDosyaAdi(file.name)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(path.join(absDir, dosyaAdi), buffer)
      yazilan.push({
        dosyaYolu: fotoUrl(yil, ay, dosyaAdi),
        dosyaAdi: file.name,
        mimeType: file.type,
      })
    }

    await prisma.rmaFoto.createMany({
      data: yazilan.map((y) => ({ ...y, rmaKayitId: id, yukleyenId: userId })),
    })

    const fotolar = await prisma.rmaFoto.findMany({
      where: { rmaKayitId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, dosyaYolu: true, dosyaAdi: true, mimeType: true, createdAt: true },
    })
    return NextResponse.json({ fotolar, eklenen: yazilan.length })
  } catch (err) {
    console.error('RMA fotoğraf yükleme hatası:', err)
    return NextResponse.json({ error: 'Dosya yüklenemedi' }, { status: 500 })
  }
}
