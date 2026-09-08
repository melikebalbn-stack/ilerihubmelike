import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/entegrasyon/syteline/yeniden-dene — bir kaydı BEKLIYOR'a çeker (deneme=0, hata temizlenir).
// Bir sonraki çalıştırmada tekrar denenir. Guard: entegrasyon.syteline.
export async function POST(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const body = await req.json().catch(() => null)
  const id = body?.id
  if (typeof id !== 'string' || !id) return apiBadRequest('id gerekli')

  const kayit = await prisma.syteSyncKayit.findUnique({ where: { id }, select: { id: true } })
  if (!kayit) return apiNotFound('Kayıt bulunamadı')

  await prisma.syteSyncKayit.update({
    where: { id },
    data: { durum: 'BEKLIYOR', denemeSayisi: 0, hata: null, sonDenemeAt: null },
  })
  return apiSuccess({ ok: true, id })
}
