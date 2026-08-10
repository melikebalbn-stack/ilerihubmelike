import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * Ticket eki yükleme — POST multipart/form-data, alan adı `files` (çoklu).
 *
 * NEDEN AYRI ROUTE (genel /api/upload yerine): genel endpoint tip kısıtı
 * uygulamıyor ve 10MB üstünü SESSİZCE atlıyor — kullanıcı hata görmeden ticket'ı
 * eksiz açardı. Burada ihlal 400 döner ve hiçbir dosya yazılmaz (ya hepsi ya hiç).
 * Desen kaynağı: job-application/route.ts (tip + boyut doğrulaması, açık hata).
 *
 * DEPOLAMA: `public/uploads` her iki slotta da /home/rokunet/shared/uploads'a
 * SYMLINK — dosyalar ortak dizine düşer, blue-green swap'te kaybolmaz.
 * Servis: /api/files/[...path] (oturum kontrollü); nginx statik servis etmiyor.
 */

const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const IZINLI_TIPLER = ['image/', 'application/pdf']

function tipGecerli(mime: string): boolean {
  return IZINLI_TIPLER.some((t) => (t.endsWith('/') ? mime.startsWith(t) : mime === t))
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireUser()
    if (error) return error

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
      if (!tipGecerli(file.type)) {
        return NextResponse.json(
          { error: `"${file.name}" desteklenmiyor. Yalnız resim ve PDF yüklenebilir.` },
          { status: 400 },
        )
      }
    }

    const now = new Date()
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
    const targetDir = path.join(process.cwd(), 'public', 'uploads', 'tickets', yearMonth)
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    const uploaded: { url: string; name: string; size: number; type: string }[] = []

    for (const file of files) {
      // Güvenli dosya adı: kullanıcı adı sanitize + timestamp + rastgele son ek
      // (aynı anda aynı adla iki yükleme çakışmasın).
      const ext = path.extname(file.name) || ''
      const baseName = path
        .basename(file.name, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50)
      const fileName = `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`

      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(path.join(targetDir, fileName), buffer)

      uploaded.push({
        url: `/api/files/uploads/tickets/${yearMonth}/${fileName}`,
        name: file.name,
        size: file.size,
        type: file.type,
      })
    }

    return NextResponse.json({ files: uploaded })
  } catch (error) {
    console.error('Ticket eki yükleme hatası:', error)
    return NextResponse.json({ error: 'Dosya yüklenemedi' }, { status: 500 })
  }
}
