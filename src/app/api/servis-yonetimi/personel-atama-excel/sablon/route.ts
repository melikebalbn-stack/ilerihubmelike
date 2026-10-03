import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sablonDosyaAdi, sablonOlustur } from '@/lib/servis-yonetimi/excel-atama'
import { yetkiVeIzinler } from '../_ortak'

export const dynamic = 'force-dynamic'

// dosya yükleme için view, operasyonel atama kaydı için edit — İKİSİ BİRDEN (AND)
const YETKILER = ['servis.view', 'servis.edit']

// GET .../personel-atama-excel/sablon — boş şablon (Atama + Açıklama + Kodlar sayfaları). Yetki: view + edit.
// Kodlar sayfası yalnız AKTİF güzergâh/durak/dilim kodlarını içerir (kişi bilgisi yok).
export async function GET() {
  const yetki = await yetkiVeIzinler(YETKILER)
  if ('error' in yetki) return yetki.error
  try {
    const [guzergahlar, dilimler] = await Promise.all([
      prisma.servisGuzergah.findMany({
        where: { aktif: true }, orderBy: { kod: 'asc' },
        select: { kod: true, ad: true, duraklar: { where: { aktif: true, durak: { aktif: true } }, orderBy: { sira: 'asc' }, select: { durak: { select: { kod: true, ad: true } } } } },
      }),
      prisma.servisSeferDilimi.findMany({ where: { aktif: true }, orderBy: { sira: 'asc' }, select: { kod: true, ad: true } }),
    ])
    const buf = sablonOlustur({
      guzergahlar: guzergahlar.map((g) => ({ kod: g.kod, ad: g.ad })),
      duraklar: guzergahlar.flatMap((g) => g.duraklar.map((d) => ({ guzergahKod: g.kod, kod: d.durak.kod, ad: d.durak.ad }))),
      dilimler,
    })
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${sablonDosyaAdi()}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Atama şablonu hatası:', err)
    return NextResponse.json({ ok: false, message: 'Şablon oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
