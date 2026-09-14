import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif, fifKapsamindaMi } from '@/lib/quality/fif-access'
import { altKayitDuzenlenebilir } from '@/lib/quality/fif-durum'
import { FifEkTip } from '@/generated/prisma'
import { FIF_FOTO_MAX_BYTES, fifMimeGecerli, fifGuvenliDosyaAdi, fifFotoDizin, fifFotoUrl } from '@/lib/quality/fif-foto-dosya'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

/** GET — Ek-2 foto listesi. Auth: kapsam. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params
  const fif = await prisma.fif.findUnique({ where: { id }, select: { id: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true } })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'kapsam dışı' }, { status: 403 })
  const ekler = await prisma.fifEk.findMany({ where: { fifId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ ekler })
}

/** POST — multipart/form-data: `file` + `tip` (ONCE/SONRA). jpg/png/webp ≤5MB. Kilit: altKayitDuzenlenebilir. */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { session, userId, error } = await requireSession()
    if (error) return error
    const { id } = await params
    const fif = await prisma.fif.findUnique({ where: { id }, select: { id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true } })
    if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
    if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'kapsam dışı' }, { status: 403 })
    if (!altKayitDuzenlenebilir({ userId, isManage: canManageFif(session) }, fif.durum)) {
      return NextResponse.json({ error: 'Bu durumda düzenleme yapılamaz' }, { status: 409 })
    }

    const formData = await request.formData()
    const tipRaw = String(formData.get('tip') ?? '')
    if (tipRaw !== 'ONCE' && tipRaw !== 'SONRA') return NextResponse.json({ error: 'tip ONCE/SONRA olmalı' }, { status: 400 })
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    if (file.size > FIF_FOTO_MAX_BYTES) return NextResponse.json({ error: `"${file.name}" 5MB sınırını aşıyor` }, { status: 400 })
    if (!fifMimeGecerli(file.type)) return NextResponse.json({ error: 'Yalnız jpg/png/webp yüklenebilir' }, { status: 400 })

    const absDir = await fifFotoDizin(id)
    const dosyaAdi = fifGuvenliDosyaAdi(file.name)
    await writeFile(path.join(absDir, dosyaAdi), Buffer.from(await file.arrayBuffer()))
    const ek = await prisma.fifEk.create({ data: { fifId: id, tip: tipRaw as FifEkTip, dosyaYolu: fifFotoUrl(id, dosyaAdi) } })
    return NextResponse.json({ item: ek })
  } catch (err) {
    console.error('[fif-foto] yükleme:', err)
    return NextResponse.json({ error: 'Dosya yüklenemedi' }, { status: 500 })
  }
}
