import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiBadRequest, apiNotFound } from '@/lib/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// MALZEME: BIRIM/URUN_KODU/MUHASEBE_GRUBU · IS_EMRI: TEZGAH (Syteline RESID → IFS ResourceId)
const TIPLER = ['BIRIM', 'URUN_KODU', 'MUHASEBE_GRUBU', 'TEZGAH'] as const
type Tip = (typeof TIPLER)[number]

// Syteline→IFS değer eşleme yönetimi. Guard: entegrasyon.syteline (tümü).
// GET  ?entity=MALZEME[&tip=BIRIM] → liste
// POST { entity, tip, kaynakDeger, hedefDeger, not?, aktif? } → upsert (@@unique entity+tip+kaynakDeger)
// DELETE { id } (veya ?id=) → sil
export async function GET(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const entity = req.nextUrl.searchParams.get('entity') ?? 'MALZEME'
  const tip = req.nextUrl.searchParams.get('tip') ?? undefined
  const rows = await prisma.syteEsleme.findMany({
    where: { entity, ...(tip ? { tip } : {}) },
    orderBy: [{ tip: 'asc' }, { kaynakDeger: 'asc' }],
  })
  return apiSuccess({ eslemeler: rows })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const b = await req.json().catch(() => null)
  const entity = typeof b?.entity === 'string' ? b.entity.trim() : ''
  const tip = typeof b?.tip === 'string' ? b.tip.trim() : ''
  const kaynakDeger = typeof b?.kaynakDeger === 'string' ? b.kaynakDeger.trim() : ''
  const hedefDeger = typeof b?.hedefDeger === 'string' ? b.hedefDeger.trim() : ''
  const not = typeof b?.not === 'string' ? b.not.trim() || null : null
  const aktif = typeof b?.aktif === 'boolean' ? b.aktif : true
  if (!entity || !TIPLER.includes(tip as Tip) || !kaynakDeger || !hedefDeger) {
    return apiBadRequest(`entity, tip (${TIPLER.join('|')}), kaynakDeger, hedefDeger gerekli`)
  }
  const row = await prisma.syteEsleme.upsert({
    where: { entity_tip_kaynakDeger: { entity, tip, kaynakDeger } },
    update: { hedefDeger, not, aktif },
    create: { entity, tip, kaynakDeger, hedefDeger, not, aktif },
  })
  return apiSuccess({ esleme: row })
}

export async function DELETE(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const b = await req.json().catch(() => null)
  const id = typeof b?.id === 'string' ? b.id : req.nextUrl.searchParams.get('id')
  if (!id) return apiBadRequest('id gerekli')
  const mevcut = await prisma.syteEsleme.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return apiNotFound('Eşleme bulunamadı')
  await prisma.syteEsleme.delete({ where: { id } })
  return apiSuccess({ ok: true, id })
}
