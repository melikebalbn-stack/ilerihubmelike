import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

// Dosya yükleme için POST endpoint
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    // 'files' (çoğul) veya 'file' (tekil) key destekle
    let files = formData.getAll('files') as File[]
    if (!files || files.length === 0) {
      const singleFile = formData.get('file') as File | null
      if (singleFile) {
        files = [singleFile]
      }
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    // Upload klasörünü oluştur
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Yıl/ay bazlı alt klasör
    const now = new Date()
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
    const targetDir = path.join(uploadDir, yearMonth)
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    const uploadedFiles = []

    for (const file of files) {
      // Dosya boyutu kontrolü (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        continue
      }

      // Güvenli dosya adı oluştur
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const ext = path.extname(file.name)
      const baseName = path.basename(file.name, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50)
      const fileName = `${baseName}_${timestamp}_${randomSuffix}${ext}`

      // Dosyayı kaydet
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const filePath = path.join(targetDir, fileName)
      await writeFile(filePath, buffer)

      // URL oluştur - /api/files/ üzerinden servis edilecek
      const url = `/api/files/uploads/${yearMonth}/${fileName}`

      uploadedFiles.push({
        name: file.name,
        url: url,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString()
      })
    }

    // Hem eski format (fileUrl) hem yeni format (files[]) döndür
    return NextResponse.json({
      files: uploadedFiles,
      fileUrl: uploadedFiles[0]?.url || null,
    })
  } catch (error) {
    console.error('Dosya yükleme hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
