import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/is-emirleri/gecmis?take=100&cursorAt=<ISO>&cursorId=<id>&durum=<ACIK|KAPALI>
// ILERIHub iş geçmişi — IproProductionLog (SALT OKUMA, Melike #1 Sekme 2). Keyset cursor
// (baslatildiAt desc, id desc). Operatör adı TEK findMany + Map (satır başına sorgu YOK).
export async function GET(request: NextRequest) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error

  const sp = new URL(request.url).searchParams
  const takeRaw = Number(sp.get('take'))
  const take = Number.isInteger(takeRaw) && takeRaw > 0 && takeRaw <= 200 ? takeRaw : 100
  const cursorAt = sp.get('cursorAt')
  const cursorId = sp.get('cursorId')
  const durumRaw = sp.get('durum')
  const durum = durumRaw === 'ACIK' || durumRaw === 'KAPALI' ? durumRaw : undefined

  try {
    const where: Prisma.IproProductionLogWhereInput = {}
    if (durum) where.durum = durum
    // Keyset: baslatildiAt < cursor VEYA (== cursor AND id < cursorId).
    if (cursorAt && cursorId) {
      const at = new Date(cursorAt)
      where.OR = [{ baslatildiAt: { lt: at } }, { baslatildiAt: at, id: { lt: cursorId } }]
    }

    const rows = await prisma.iproProductionLog.findMany({
      where,
      orderBy: [{ baslatildiAt: 'desc' }, { id: 'desc' }],
      take: take + 1, // hasMore tespiti
      select: {
        id: true,
        ifsOrderNo: true,
        ifsOperationNo: true,
        ifsPartNo: true,
        ifsPartDescription: true,
        qtyComplete: true,
        qtyScrap: true,
        uretimAdet: true,
        hesapKaynagi: true,
        durum: true,
        baslatildiAt: true,
        bitirildiAt: true,
        personnelId: true,
        tezgah: { select: { kod: true, ad: true } },
      },
    })

    const hasMore = rows.length > take
    const sayfa = hasMore ? rows.slice(0, take) : rows

    // Operatör adları — personnelId FK'sız (IPRO deseni) → TEK findMany + Map.
    const pids = [...new Set(sayfa.map((r) => r.personnelId))]
    const personeller = pids.length
      ? await prisma.personnel.findMany({
          where: { id: { in: pids } },
          select: { id: true, adSoyad: true, sicilNo: true },
        })
      : []
    const byPid = new Map(personeller.map((p) => [p.id, p]))

    const items = sayfa.map((r) => ({
      id: r.id,
      ifsOrderNo: r.ifsOrderNo,
      ifsOperationNo: r.ifsOperationNo,
      ifsPartNo: r.ifsPartNo,
      ifsPartDescription: r.ifsPartDescription,
      qtyComplete: r.qtyComplete,
      qtyScrap: r.qtyScrap,
      uretimAdet: r.uretimAdet,
      hesapKaynagi: r.hesapKaynagi,
      durum: r.durum,
      baslatildiAt: r.baslatildiAt ? r.baslatildiAt.toISOString() : null,
      bitirildiAt: r.bitirildiAt ? r.bitirildiAt.toISOString() : null,
      operatorAdSoyad: byPid.get(r.personnelId)?.adSoyad ?? null,
      operatorSicilNo: byPid.get(r.personnelId)?.sicilNo ?? null,
      tezgahKod: r.tezgah?.kod ?? null,
      tezgahAd: r.tezgah?.ad ?? null,
    }))

    const son = sayfa[sayfa.length - 1]
    const nextCursor = hasMore && son?.baslatildiAt ? { at: son.baslatildiAt.toISOString(), id: son.id } : null

    return NextResponse.json({ items, nextCursor })
  } catch {
    return NextResponse.json({ error: 'İş geçmişi alınamadı' }, { status: 500 })
  }
}
