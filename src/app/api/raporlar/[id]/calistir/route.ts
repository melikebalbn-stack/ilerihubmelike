import { NextResponse } from 'next/server'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { veriSetiCalistir } from '@/lib/rapor/veri-seti'
import { raporRender } from '@/lib/rapor/render'
import { ifadeCalistir, ifadeDerle } from '@/lib/rapor/ifade'
import type { SablonIcerik, VeriSetiTanim } from '@/lib/rapor/tipler'

export const dynamic = 'force-dynamic'

const GovdeSchema = z.object({
  parametreler: z.record(z.string(), z.unknown()).default({}),
  cikti: z.enum(['EKRAN', 'XLSX']).default('EKRAN'),
})

/** Şablon parametre tipine göre ham değeri çevirir; zorunlu eksikse hata mesajı döner. */
function parametreleriHazirla(icerik: SablonIcerik, ham: Record<string, unknown>): { degerler: Record<string, unknown>; hatalar: string[] } {
  const degerler: Record<string, unknown> = {}
  const hatalar: string[] = []
  for (const p of icerik.parametreler ?? []) {
    const v = ham[p.ad]
    const bos = v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
    if (bos) {
      if (p.zorunlu) hatalar.push(`'${p.etiket}' zorunludur`)
      continue
    }
    switch (p.tip) {
      case 'sayi': {
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        if (!Number.isFinite(n)) { hatalar.push(`'${p.etiket}' sayı olmalı`); continue }
        degerler[p.ad] = n
        break
      }
      case 'tarih': {
        const d = v instanceof Date ? v : new Date(String(v))
        if (Number.isNaN(d.getTime())) { hatalar.push(`'${p.etiket}' geçerli bir tarih olmalı`); continue }
        degerler[p.ad] = d
        break
      }
      default:
        degerler[p.ad] = typeof v === 'string' ? v.trim() : String(v)
    }
  }
  return { degerler, hatalar }
}

/** Satırlara hesaplanan alanları ekler (XLSX yolu; EKRAN'da render bunu kendisi yapar). */
function hesaplananlariUygula(icerik: SablonIcerik, satirlar: Record<string, unknown>[]): Record<string, unknown>[] {
  const hesaplananlar = (icerik.hesaplananAlanlar ?? []).map((h) => ({ ad: h.ad, d: ifadeDerle(h.ifade) }))
  if (!hesaplananlar.length) return satirlar
  return satirlar.map((s) => {
    const y = { ...s }
    for (const h of hesaplananlar) y[h.ad] = ifadeCalistir(h.d, { satir: y })
    return y
  })
}

function xlsxDegeri(v: unknown): ExcelJS.CellValue {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') return (v as { toNumber: () => number }).toNumber()
  return String(v)
}

async function xlsxUret(icerik: SablonIcerik, satirlar: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(icerik.baslik.slice(0, 31).replace(/[\\/*?:[\]]/g, ' ') || 'Rapor')
  ws.columns = icerik.kolonlar.map((k) => ({ header: k.baslik, key: k.alan, width: Math.max(12, Math.min(40, k.baslik.length + 4)) }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const s of hesaplananlariUygula(icerik, satirlar)) {
    const satir: Record<string, ExcelJS.CellValue> = {}
    for (const k of icerik.kolonlar) {
      let v = xlsxDegeri(s[k.alan])
      if (typeof v === 'string' && (k.bicim?.startsWith('gg') ?? false)) { const d = new Date(v); if (!Number.isNaN(d.getTime())) v = d }
      satir[k.alan] = v
    }
    ws.addRow(satir)
  }
  icerik.kolonlar.forEach((k, i) => {
    const col = ws.getColumn(i + 1)
    switch (k.bicim) {
      case '#.##0': col.numFmt = '#,##0'; break
      case '#.##0,00': col.numFmt = '#,##0.00'; break
      case '%0,0': col.numFmt = '0.0"%"'; break
      case '%0,00': col.numFmt = '0.00"%"'; break
      case 'gg.aa.yyyy': col.numFmt = 'dd.mm.yyyy'; break
      case 'gg.aa.yyyy ss:dd': col.numFmt = 'dd.mm.yyyy hh:mm'; break
    }
  })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/**
 * POST /api/raporlar/[id]/calistir — şablonu çalıştırır (EKRAN: HTML JSON, XLSX: dosya).
 * rapor.view + şablonun izinAnahtari doluysa o izin. Her çalıştırma rapor_calistirma'ya yazılır.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error
  const { id } = await params

  const sablon = await prisma.raporSablon.findUnique({ where: { id }, include: { veriSeti: true } })
  if (!sablon) return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })

  const perms = await getUserPermissions(userId)
  if (sablon.durum === 'ARSIV') return NextResponse.json({ error: 'Bu rapor arşivlenmiş' }, { status: 410 })
  if (sablon.durum === 'TASLAK' && !perms.has(PERMISSION_KEYS.RAPOR_TASARLA)) {
    return NextResponse.json({ error: 'Taslak raporu yalnız tasarımcılar çalıştırabilir' }, { status: 403 })
  }
  if (sablon.izinAnahtari && !perms.has(sablon.izinAnahtari)) {
    return NextResponse.json({ error: 'Bu rapor için ek yetki gerekiyor', required: [sablon.izinAnahtari] }, { status: 403 })
  }

  let govdeHam: unknown
  try { govdeHam = await req.json() } catch { govdeHam = {} }
  const govde = GovdeSchema.safeParse(govdeHam ?? {})
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })

  const icerik = sablon.icerik as unknown as SablonIcerik
  const tanim = sablon.veriSeti.tanim as unknown as VeriSetiTanim
  const { degerler, hatalar } = parametreleriHazirla(icerik, govde.data.parametreler)
  if (hatalar.length) return NextResponse.json({ error: `Eksik/geçersiz parametre: ${hatalar.join('; ')}` }, { status: 400 })

  const t0 = Date.now()
  const kayit = { sablonId: sablon.id, calistiranId: userId, parametreler: JSON.parse(JSON.stringify(degerler)), cikti: govde.data.cikti }

  try {
    const veri = await veriSetiCalistir(tanim, degerler)

    if (govde.data.cikti === 'XLSX') {
      const buffer = await xlsxUret(icerik, veri.satirlar)
      await prisma.raporCalistirma.create({ data: { ...kayit, satirSayisi: veri.satirlar.length, sureMs: Date.now() - t0 } })
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${sablon.kod}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const render = raporRender(icerik, veri.satirlar, {
      parametreler: degerler,
      calistiran: (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? undefined,
      raporKodu: sablon.kod,
    })
    const sureMs = Date.now() - t0
    await prisma.raporCalistirma.create({ data: { ...kayit, satirSayisi: render.satirSayisi, sureMs } })
    return NextResponse.json({ html: render.html, satirSayisi: render.satirSayisi, sureMs, kaynakIstatistik: veri.kaynakIstatistik })
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    await prisma.raporCalistirma.create({ data: { ...kayit, sureMs: Date.now() - t0, hata: mesaj.slice(0, 2000) } }).catch(() => {})
    console.error(`[rapor] ${sablon.kod} çalıştırma hatası:`, e)
    return NextResponse.json({ error: `Rapor çalıştırılamadı: ${mesaj}` }, { status: 500 })
  }
}
