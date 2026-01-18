import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - 5S denetim alanlarını listele
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, description, department, location, responsibleEmail, responsibleName } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Alan adı ve kodu zorunludur' }, { status: 400 })
    }

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
        responsibleEmail,
        responsibleName
      }
    })

    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error('5S alanı oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
