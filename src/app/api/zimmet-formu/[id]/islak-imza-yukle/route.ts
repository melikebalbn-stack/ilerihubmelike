import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { zimmetBelgesiniKaydet } from '../../_lib/zimmet-belge-storage'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
}

const MAX_SIZE = 10 * 1024 * 1024

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requirePermission('zimmet-formu.approve')
    if (error) return error

    const { id } = await params

    const zimmet = await prisma.zimmetFormu.findUnique({
      where: { id },
      select: { id: true, durum: true },
    })
    if (!zimmet) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }

    if (zimmet.durum !== 'ONAYLANDI') {
      return NextResponse.json({ error: 'Sadece onaylanmış zimmet formlarına belge yüklenebilir' }, { status: 409 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Geçersiz form data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Dosya yok' }, { status: 400 })
    }

    const safeExt = ALLOWED_TYPES[file.type]
    if (!safeExt) {
      return NextResponse.json({ error: 'Sadece PDF, JPG veya PNG kabul edilir' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Dosya 10MB'dan büyük olamaz" }, { status: 400 })
    }

    const fileName = `${crypto.randomBytes(16).toString('hex')}.${safeExt}`
    const arrayBuffer = await file.arrayBuffer()
    await zimmetBelgesiniKaydet(id, fileName, Buffer.from(arrayBuffer))

    // DB'de sadece dosya adı tutulur (public URL DEĞİL) — gerçek konum
    // UPLOAD_ROOT/[id]/ altında, auth korumalı /belge route'u üzerinden
    // okunur. Bkz. _lib/zimmet-belge-storage.ts.
    const guncellendi = await prisma.zimmetFormu.update({
      where: { id },
      data: { imzaModu: 'ISLAK', islakImzaDosyasi: fileName },
    })

    return NextResponse.json(guncellendi)
  } catch (err) {
    console.error('[POST /api/zimmet-formu/[id]/islak-imza-yukle]', err)
    return NextResponse.json({ error: 'Belge yüklenemedi' }, { status: 500 })
  }
}
