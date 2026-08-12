import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { readStoredFile } from '@/lib/yillik-calisma-takvimi/storage'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ ekId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const { error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { ekId } = await params
  const attachment = await prisma.yillikTakvimEk.findUnique({ where: { id: ekId }, select: {
    id: true, dosyaAdi: true, dosyaTuru: true, saklamaYolu: true, kayit: { select: { id: true } },
  } })
  if (!attachment) return NextResponse.json({ error: 'Ek bulunamadı' }, { status: 404 })
  try {
    const buffer = await readStoredFile(attachment.saklamaYolu)
    const encodedName = encodeURIComponent(attachment.dosyaAdi).replace(/['()]/g, escape)
    return new NextResponse(new Uint8Array(buffer), { headers: {
      'Content-Type': attachment.dosyaTuru || 'application/octet-stream',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 404 })
    return NextResponse.json({ error: 'Dosya yolu geçersiz veya dosya okunamadı' }, { status: 400 })
  }
}
