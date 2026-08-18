import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { belgeMimeTuru, resolveGuvenliZimmetBelgeYolu } from '../../_lib/zimmet-belge-storage'

export const dynamic = 'force-dynamic'

/**
 * GET: Islak imza belgesini indirir. Dosya public/ DIŞINDA tutulur (bkz.
 * _lib/zimmet-belge-storage.ts) — bu route TEK okuma yolu.
 * Yetki: zimmet sahibi kendi belgesini, zimmet-formu.view yetkilisi
 * hepsini indirebilir. Diğer herkese 403. Dosya sistemi yolu response'a
 * (header/hata mesajı) hiçbir şekilde sızmaz.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser()
  if (error) return error

  const { id } = await params

  const zimmet = await prisma.zimmetFormu.findFirst({
    where: { id, silindiMi: false },
    select: { id: true, zimmetSahibiId: true, islakImzaDosyasi: true },
  })
  if (!zimmet) {
    return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
  }

  const yetkili =
    zimmet.zimmetSahibiId === user.id || (await hasPermission('zimmet-formu.view'))
  if (!yetkili) {
    return NextResponse.json({ error: 'Bu belgeyi görüntüleme yetkiniz yok' }, { status: 403 })
  }

  if (!zimmet.islakImzaDosyasi) {
    return NextResponse.json({ error: 'Bu zimmet için yüklenmiş belge yok' }, { status: 404 })
  }

  const guvenliYol = resolveGuvenliZimmetBelgeYolu(zimmet.id, zimmet.islakImzaDosyasi)
  if (!guvenliYol) {
    return NextResponse.json({ error: 'Geçersiz belge yolu' }, { status: 400 })
  }

  let icerik: Buffer
  try {
    icerik = await fs.readFile(guvenliYol)
  } catch {
    return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 })
  }

  const ext = zimmet.islakImzaDosyasi.split('.').pop()?.toLowerCase() ?? 'bin'
  const fileName = `zimmet-${zimmet.id.slice(0, 8)}-belge.${ext}`

  return new NextResponse(new Uint8Array(icerik), {
    status: 200,
    headers: {
      'Content-Type': belgeMimeTuru(zimmet.islakImzaDosyasi),
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
