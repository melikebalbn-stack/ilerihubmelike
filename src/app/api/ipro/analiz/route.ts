import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { analizVerisi, type Gruplama } from '@/lib/ipro/analiz-service'
import { prisma } from '@/lib/prisma'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GRUPLAMALAR: Gruplama[] = ['gun', 'vardiya', 'hafta']

/** ?bas=&bit=&gruplama=gun|vardiya|hafta&vardiya=&bolum=&tezgah= — varsayılan son 30 gün. IPRO görüntüleme izni. */
export function analizFiltreCoz(sp: URLSearchParams) {
  const simdi = new Date()
  const bitParam = sp.get('bit')
  const basParam = sp.get('bas')
  const bit = bitParam ? new Date(bitParam) : simdi
  const bas = basParam ? new Date(basParam) : new Date(bit.getTime() - 30 * 86400000)
  const g = sp.get('gruplama')
  const gruplama: Gruplama = GRUPLAMALAR.includes(g as Gruplama) ? (g as Gruplama) : 'gun'
  return {
    bas: isNaN(bas.getTime()) ? new Date(simdi.getTime() - 30 * 86400000) : bas,
    bit: isNaN(bit.getTime()) ? simdi : bit,
    gruplama,
    vardiyaId: sp.get('vardiya') || null,
    bolum: sp.get('bolum') || null,
    tezgahKod: sp.get('tezgah') || null,
  }
}

export async function GET(req: Request) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    const f = analizFiltreCoz(new URL(req.url).searchParams)
    const [veri, cevrimRapor, vardiyalar, tezgahlar] = await Promise.all([
      analizVerisi(f),
      prisma.raporSablon.findUnique({ where: { kod: 'IPRO-001' }, select: { id: true } }).catch(() => null),
      prisma.iproVardiya.findMany({ where: { aktif: true }, orderBy: { sira: 'asc' }, select: { id: true, kod: true, baslangicSaat: true, bitisSaat: true } }),
      prisma.iproTezgah.findMany({ where: { aktif: true }, orderBy: { kod: 'asc' }, select: { kod: true, masGrupAdi: true } }),
    ])
    const bolumler = [...new Set(tezgahlar.map((t) => t.masGrupAdi).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, 'tr'))
    return NextResponse.json({
      ok: true, ...veri, cevrimRaporId: cevrimRapor?.id ?? null,
      secenekler: {
        vardiyalar: vardiyalar.map((v) => ({ id: v.id, ad: `${v.kod} ${v.baslangicSaat}–${v.bitisSaat}` })),
        bolumler,
        tezgahlar: tezgahlar.map((t) => t.kod),
      },
    })
  } catch (e) {
    return iproHata(e, 'Analiz verisi alınamadı')
  }
}
