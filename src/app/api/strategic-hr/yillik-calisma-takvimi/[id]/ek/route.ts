import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_ATTACHMENT_PERMISSIONS, YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { createStorageKey, removeStoredFile, validateAttachment, writeStoredFile } from '@/lib/yillik-calisma-takvimi/storage'
import { isYillikTakvimWorkflowLocked } from '@/lib/yillik-calisma-takvimi/state'
import { lockYillikTakvimParent, YillikTakvimConflictError } from '@/lib/yillik-calisma-takvimi/transaction'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }
const attachmentSelect = { id: true, dosyaAdi: true, dosyaTuru: true, boyut: true, createdAt: true, yukleyen: { select: { id: true, name: true } } } as const

export async function GET(_request: NextRequest, { params }: Context) {
  const { error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const kayit = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true } })
  if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  const data = await prisma.yillikTakvimEk.findMany({ where: { kayitId: id }, select: attachmentSelect, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_ATTACHMENT_PERMISSIONS])
  if (error) return error
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })
  let buffer: Buffer
  let validated: ReturnType<typeof validateAttachment>
  try {
    buffer = Buffer.from(await file.arrayBuffer())
    validated = validateAttachment(file.name, file.type, buffer)
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Geçersiz dosya' }, { status: 400 })
  }
  const { id } = await params
  const kayit = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: {
    id: true, durum: true, iptalMi: true, arsivMi: true, katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } },
  } })
  if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  if (kayit.iptalMi || kayit.arsivMi) return NextResponse.json({ error: 'İptal edilmiş veya arşivlenmiş kayda ek yüklenemez' }, { status: 400 })
  if (isYillikTakvimWorkflowLocked(kayit.durum)) return NextResponse.json({ error: 'Onay sürecindeki veya onaylanmış kayda ek yüklenemez' }, { status: 400 })
  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
  if (!isAdmin && !kayit.katilimcilar.some(item => item.userId === userId)) return NextResponse.json({ error: 'Ek yüklemeyi yalnız ana sorumlu veya admin yapabilir' }, { status: 403 })

  let storageKey: string | null = null
  try {
    storageKey = createStorageKey(id, validated.extension)
    await writeStoredFile(storageKey, buffer)
    const created = await prisma.$transaction(async tx => {
      const locked = await lockYillikTakvimParent(tx, id)
      const fresh = await tx.yillikTakvimKaydi.findUnique({ where: { id }, select: { katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } } } })
      if (!locked || !fresh || locked.iptalMi || locked.arsivMi || isYillikTakvimWorkflowLocked(locked.durum) || (!isAdmin && !fresh.katilimcilar.some(item => item.userId === userId))) throw new YillikTakvimConflictError('Kayıt durumu değişti; dosya bağlanmadı')
      const attachment = await tx.yillikTakvimEk.create({ data: {
        kayitId: id, dosyaTuru: validated.mime, dosyaAdi: validated.displayName,
        saklamaYolu: storageKey!, boyut: buffer.length, yukleyenId: userId,
      }, select: attachmentSelect })
      await logYillikTakvimAction({ tx, kayitId: id, yapanId: userId, islemTuru: 'EK_YUKLE', alan: 'ek', metadata: { ekId: attachment.id, dosyaTuru: validated.mime, boyut: buffer.length } })
      return attachment
    })
    return NextResponse.json(created, { status: 201 })
  } catch (cause) {
    let cleanupFailed = false
    if (storageKey) {
      try { await removeStoredFile(storageKey) } catch (cleanupCause) { cleanupFailed = true; console.error('[POST ek cleanup]', cleanupCause) }
    }
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[POST ek]', cause)
    return NextResponse.json({ error: cleanupFailed ? 'Dosya metadata işlemi ve güvenli temizlik başarısız oldu' : 'Dosya yüklenemedi' }, { status: 500 })
  }
}
