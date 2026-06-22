import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

// GET - 5S denetim alanlarını listele
export async function GET() {
  try {
    // PR-Y2.5-suggestions: requireSession — sade auth
    const { error } = await requireSession()
    if (error) return error

    const areas = await prisma.fiveSArea.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { audits: true }
        },
        audits: {
          orderBy: { auditDate: 'desc' },
          take: 1,
          select: {
            auditDate: true,
            totalScore: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(areas)
  } catch (error) {
    console.error('5S alanları yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni 5S denetim alanı oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-suggestions: requireSession — sadece auth check
    const { error } = await requireSession()
    if (error) return error

    const body = await request.json()
    const { name, code, description, department, location, responsibleEmail, responsibleName } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Alan adı ve kodu zorunludur' }, { status: 400 })
    }

    // PR-Y2.5: input boundary normalization
    const normalizedResponsibleEmail = typeof responsibleEmail === 'string' && responsibleEmail.trim() !== ''
      ? responsibleEmail.toLowerCase()
      : null

    // Kod benzersiz mi kontrol et
    const existing = await prisma.fiveSArea.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Bu kod zaten kullanılıyor' }, { status: 400 })
    }

    const area = await prisma.fiveSArea.create({
      data: {
        name,
        code,
        description,
        department,
        location,
        responsibleEmail: normalizedResponsibleEmail,
        responsibleName
      }
    })

    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error('5S alanı oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
