// Backups API - Dosya İndirme
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'

// Yetki kontrolü
function isAuthorized(userRole: string): boolean {
  const allowedRoles = ['IT_MANAGER', 'ADMIN', 'SUPER_ADMIN']
  return allowedRoles.includes(userRole)
}

// GET - Yedek Dosyasını İndir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    const backup = await prisma.backupLog.findUnique({
      where: { id }
    })

    if (!backup) {
      return NextResponse.json({ error: 'Yedek bulunamadı' }, { status: 404 })
    }

    if (backup.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Yedek henüz tamamlanmamış' }, { status: 400 })
    }

    if (!backup.filePath || !fs.existsSync(backup.filePath)) {
      return NextResponse.json({ error: 'Yedek dosyası bulunamadı' }, { status: 404 })
    }

    // Dosyayı oku
    const fileBuffer = fs.readFileSync(backup.filePath)
    const fileStats = fs.statSync(backup.filePath)

    // Response oluştur
    const response = new NextResponse(fileBuffer)
    response.headers.set('Content-Type', 'application/gzip')
    response.headers.set('Content-Disposition', `attachment; filename="${backup.backupName}"`)
    response.headers.set('Content-Length', fileStats.size.toString())

    return response
  } catch (error) {
    console.error('Yedek indirme hatası:', error)
    return NextResponse.json({ error: 'Yedek indirilemedi' }, { status: 500 })
  }
}
