import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Öneri Kurulu üyelerini listele
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const members = await prisma.suggestionBoardMember.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Öneri Kurulu üyeleri listeleme hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni Öneri Kurulu üyesi ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name, department, role } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: 'E-posta ve isim zorunludur' },
        { status: 400 }
      )
    }

    // Aynı e-posta ile kayıt var mı kontrol et
    const existing = await prisma.suggestionBoardMember.findUnique({
      where: { email },
    })

    if (existing) {
      // Eğer pasif ise aktifleştir
      if (!existing.isActive) {
        const updated = await prisma.suggestionBoardMember.update({
          where: { id: existing.id },
          data: { isActive: true, name, department, role },
        })
        return NextResponse.json(updated)
      }
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kayıtlı' },
        { status: 400 }
      )
    }

    const member = await prisma.suggestionBoardMember.create({
      data: {
        email,
        name,
        department,
        role,
      },
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Öneri Kurulu üyesi ekleme hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Öneri Kurulu üyesini sil (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })
    }

    await prisma.suggestionBoardMember.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Öneri Kurulu üyesi silme hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
