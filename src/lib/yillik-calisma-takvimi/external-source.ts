import { Prisma, type YillikTakvimKayitTuru, type YillikTakvimOncelik, type YillikTakvimPeriyot } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { logYillikTakvimAction } from './audit'

export interface ExternalYillikTakvimInput {
  sourceModule: string
  sourceRecordId: string
  actorUserId: string
  anaKonu: string
  surec: string
  kisaBaslik?: string | null
  departmentId: string
  anaSorumluUserId?: string | null
  disKurum?: string | null
  nihaiSonTarih?: Date | string | null
  plananUygulamaTarihi?: Date | string | null
  periyot?: YillikTakvimPeriyot
  oncelik?: YillikTakvimOncelik
  kayitTuru?: YillikTakvimKayitTuru
  /** Yalnız ilk create için başlangıç metnidir; sonraki sync'lerde üzerine yazılmaz. */
  aciklama?: string | null
}

export interface ExternalYillikTakvimResult { id: string; created: boolean }
type Normalized = Omit<ExternalYillikTakvimInput, 'nihaiSonTarih' | 'plananUygulamaTarihi'> & {
  nihaiSonTarih?: Date | null
  plananUygulamaTarihi?: Date | null
}

const EXTERNAL_FIELDS = [
  'anaKonu', 'surec', 'kisaBaslik', 'departmentId', 'anaSorumlu', 'disKurum',
  'nihaiSonTarih', 'plananUygulamaTarihi', 'periyot', 'oncelik', 'kayitTuru',
] as const

function safeRequired(value: string, field: string, max = 200): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > max || /[\u0000-\u001f]/.test(normalized)) throw new Error(`${field} geçersiz`)
  return normalized
}
function safeOptional(value: string | null | undefined, max: number): string | null | undefined {
  if (value === undefined || value === null) return value
  const normalized = value.trim()
  if (normalized.length > max || /[\u0000-\u001f]/.test(normalized)) throw new Error('Metin alanı geçersiz')
  return normalized || null
}
function safeDate(value: Date | string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value
  const parsed = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('Tarih geçersiz')
  return parsed
}
function normalize(input: ExternalYillikTakvimInput): Normalized {
  return {
    ...input,
    sourceModule: safeRequired(input.sourceModule, 'sourceModule', 100),
    sourceRecordId: safeRequired(input.sourceRecordId, 'sourceRecordId', 200),
    actorUserId: safeRequired(input.actorUserId, 'actorUserId', 100),
    anaKonu: safeRequired(input.anaKonu, 'anaKonu', 300),
    surec: safeRequired(input.surec, 'surec', 300),
    departmentId: safeRequired(input.departmentId, 'departmentId', 100),
    kisaBaslik: safeOptional(input.kisaBaslik, 200),
    disKurum: safeOptional(input.disKurum, 200),
    aciklama: safeOptional(input.aciklama, 5000),
    nihaiSonTarih: safeDate(input.nihaiSonTarih),
    plananUygulamaTarihi: safeDate(input.plananUygulamaTarihi),
  }
}
function sourceKey(input: Normalized) {
  return { kaynakModul_kaynakKayitId: { kaynakModul: input.sourceModule, kaynakKayitId: input.sourceRecordId } }
}
async function validateReferences(tx: Prisma.TransactionClient, input: Normalized) {
  const [actor, department, responsible] = await Promise.all([
    tx.user.findFirst({ where: { id: input.actorUserId, isActive: true }, select: { id: true } }),
    tx.department.findFirst({ where: { id: input.departmentId, isActive: true }, select: { id: true } }),
    input.anaSorumluUserId ? tx.user.findFirst({ where: { id: input.anaSorumluUserId, isActive: true }, select: { id: true } }) : null,
  ])
  if (!actor) throw new Error('İşlemi yapan aktif kullanıcı bulunamadı')
  if (!department) throw new Error('Aktif departman bulunamadı')
  if (input.anaSorumluUserId && !responsible) throw new Error('Aktif ana sorumlu bulunamadı')
}
function updateData(input: Normalized): Prisma.YillikTakvimKaydiUncheckedUpdateInput {
  return {
    anaKonu: input.anaKonu, surec: input.surec, departmentId: input.departmentId, updatedById: input.actorUserId,
    ...(input.kisaBaslik !== undefined && { kisaBaslik: input.kisaBaslik }),
    ...(input.disKurum !== undefined && { disKurum: input.disKurum }),
    ...(input.nihaiSonTarih !== undefined && { nihaiSonTarih: input.nihaiSonTarih }),
    ...(input.plananUygulamaTarihi !== undefined && { plananUygulamaTarihi: input.plananUygulamaTarihi }),
    ...(input.periyot !== undefined && { periyot: input.periyot }),
    ...(input.oncelik !== undefined && { oncelik: input.oncelik }),
    ...(input.kayitTuru !== undefined && { kayitTuru: input.kayitTuru }),
    iptalMi: false,
  }
}
async function updateExisting(tx: Prisma.TransactionClient, id: string, input: Normalized) {
  const current = await tx.yillikTakvimKaydi.findUnique({ where: { id }, select: { durum: true } })
  await tx.yillikTakvimKaydi.update({ where: { id }, data: { ...updateData(input), ...(current?.durum === 'IPTAL_EDILDI' && { durum: 'PLANLANDI' }) } })
  if (input.anaSorumluUserId !== undefined) {
    await tx.yillikTakvimKatilimci.deleteMany({ where: { kayitId: id, rol: 'ANA_SORUMLU', ...(input.anaSorumluUserId ? { userId: { not: input.anaSorumluUserId } } : {}) } })
    if (input.anaSorumluUserId) await tx.yillikTakvimKatilimci.upsert({ where: { kayitId_userId_rol: { kayitId: id, userId: input.anaSorumluUserId, rol: 'ANA_SORUMLU' } }, create: { kayitId: id, userId: input.anaSorumluUserId, rol: 'ANA_SORUMLU' }, update: {} })
  }
  await logYillikTakvimAction({ tx, kayitId: id, yapanId: input.actorUserId, islemTuru: 'DIS_KAYNAK_GUNCELLE', alan: 'dis_kaynak', metadata: { kaynakModul: input.sourceModule, degisenAlanlar: EXTERNAL_FIELDS } })
  return { id, created: false }
}
function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code === 'P2002' : !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002'
}

export async function upsertExternalYillikTakvim(inputValue: ExternalYillikTakvimInput): Promise<ExternalYillikTakvimResult> {
  const input = normalize(inputValue)
  const existing = await prisma.yillikTakvimKaydi.findUnique({ where: sourceKey(input), select: { id: true } })
  if (existing) return prisma.$transaction(async tx => { await validateReferences(tx, input); return updateExisting(tx, existing.id, input) })
  try {
    return await prisma.$transaction(async tx => {
      await validateReferences(tx, input)
      const deadline = input.nihaiSonTarih
      const record = await tx.yillikTakvimKaydi.create({ data: {
        yil: deadline?.getUTCFullYear() ?? new Date().getUTCFullYear(), anaKonu: input.anaKonu, surec: input.surec,
        kisaBaslik: input.kisaBaslik ?? null, aciklama: input.aciklama ?? null, departmentId: input.departmentId,
        disKurum: input.disKurum ?? null, nihaiSonTarih: deadline ?? null, plananUygulamaTarihi: input.plananUygulamaTarihi ?? null,
        periyot: input.periyot ?? 'YILLIK', oncelik: input.oncelik ?? 'ORTA', kayitTuru: input.kayitTuru ?? 'SON_TARIH',
        kaynakModul: input.sourceModule, kaynakKayitId: input.sourceRecordId, createdById: input.actorUserId,
      } })
      if (input.anaSorumluUserId) await tx.yillikTakvimKatilimci.create({ data: { kayitId: record.id, userId: input.anaSorumluUserId, rol: 'ANA_SORUMLU' } })
      await logYillikTakvimAction({ tx, kayitId: record.id, yapanId: input.actorUserId, islemTuru: 'DIS_KAYNAK_OLUSTUR', alan: 'dis_kaynak', metadata: { kaynakModul: input.sourceModule, degisenAlanlar: EXTERNAL_FIELDS } })
      return { id: record.id, created: true }
    })
  } catch (error) {
    if (!isUniqueConflict(error)) throw error
    const raced = await prisma.yillikTakvimKaydi.findUnique({ where: sourceKey(input), select: { id: true } })
    if (!raced) throw error
    return prisma.$transaction(async tx => { await validateReferences(tx, input); return updateExisting(tx, raced.id, input) })
  }
}

export async function cancelExternalYillikTakvim(inputValue: Pick<ExternalYillikTakvimInput, 'sourceModule' | 'sourceRecordId' | 'actorUserId'>): Promise<{ id: string; alreadyCancelled: boolean } | null> {
  const input = normalize({ ...inputValue, anaKonu: '_', surec: '_', departmentId: '_' })
  const existing = await prisma.yillikTakvimKaydi.findUnique({ where: sourceKey(input), select: { id: true, kaynakModul: true, iptalMi: true } })
  if (!existing) return null
  if (!existing.kaynakModul) return null
  if (existing.iptalMi) return { id: existing.id, alreadyCancelled: true }
  return prisma.$transaction(async tx => {
    const actor = await tx.user.findFirst({ where: { id: input.actorUserId, isActive: true }, select: { id: true } })
    if (!actor) throw new Error('İşlemi yapan aktif kullanıcı bulunamadı')
    await tx.yillikTakvimKaydi.update({ where: { id: existing.id }, data: { iptalMi: true, durum: 'IPTAL_EDILDI', updatedById: input.actorUserId } })
    await logYillikTakvimAction({ tx, kayitId: existing.id, yapanId: input.actorUserId, islemTuru: 'DIS_KAYNAK_IPTAL', alan: 'dis_kaynak', metadata: { kaynakModul: input.sourceModule } })
    return { id: existing.id, alreadyCancelled: false }
  })
}
