import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [personnel, interns, consultants] = await Promise.all([
      prisma.personnel.findMany({ where: { aktif: true } }),
      prisma.intern.findMany({ where: { aktif: true } }),
      prisma.consultant.findMany({ where: { aktif: true } }),
    ])

    const toplamCalisan = personnel.length
    const beyazYaka = personnel.filter(p => p.yakaRengi === 'BEYAZ').length
    const maviYaka = personnel.filter(p => p.yakaRengi === 'MAVI').length
    const direkt = personnel.filter(p => p.direktEndirekt === 'DIREKT').length
    const endirekt = personnel.filter(p => p.direktEndirekt === 'ENDIREKT').length

    // Bölümlere göre direkt/endirekt gruplama
    const direktBolumler = personnel
      .filter(p => p.direktEndirekt === 'DIREKT')
      .reduce((acc: Record<string, number>, p) => {
        const key = p.bolum || 'Belirtilmemiş'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})

    const endirektBolumler = personnel
      .filter(p => p.direktEndirekt === 'ENDIREKT')
      .reduce((acc: Record<string, number>, p) => {
        const key = p.bolum || 'Belirtilmemiş'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})

    // Asansör özel grubu
    const asansorPersonel = personnel.filter(p =>
      (p.bolum || '').toUpperCase().includes('ASANSÖR') ||
      (p.bolum || '').toUpperCase().includes('ASANSOR')
    )
    const asansorMavi = asansorPersonel.filter(p => p.yakaRengi === 'MAVI').length
    const asansorBeyaz = asansorPersonel.filter(p => p.yakaRengi === 'BEYAZ').length

    return NextResponse.json({
      ozet: { toplamCalisan, beyazYaka, maviYaka, direkt, endirekt },
      direktBolumler: Object.entries(direktBolumler)
        .sort((a, b) => b[1] - a[1])
        .map(([bolum, sayi]) => ({ bolum, sayi, oran: direkt > 0 ? +(sayi / direkt * 100).toFixed(1) : 0 })),
      endirektBolumler: Object.entries(endirektBolumler)
        .sort((a, b) => b[1] - a[1])
        .map(([bolum, sayi]) => ({ bolum, sayi, oran: endirekt > 0 ? +(sayi / endirekt * 100).toFixed(1) : 0 })),
      ozelGrup: {
        asansorMavi,
        asansorBeyaz,
        stajyerAktif: interns.length,
        danismanAktif: consultants.length,
      },
    })
  } catch (error) {
    console.error('Rapor verisi alınırken hata:', error)
    return NextResponse.json({ error: 'Rapor verisi alınırken bir hata oluştu' }, { status: 500 })
  }
}
