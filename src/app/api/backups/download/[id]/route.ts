// Backups API - Dosya İndirme
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'

// GET - Yedek Dosyasını İndir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-backups: requireUser — admin role check
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('admin.backup.manage')) {
      return NextResponse.json({ error: 'Backup yönetimi sadece SUPER_ADMIN yetkisi gerektirir' }, { status: 403 })
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

    // PR-AUDIT-LOG-EXPANSION
    await logAuditEvent({
      action: 'BACKUP_DOWNLOADED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: backup.id,
      details: {
        actorEmail: user.email,
        backupName: backup.backupName,
        fileSize: backup.fileSize.toString(),
        backupType: backup.backupType,
      },
    })

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
