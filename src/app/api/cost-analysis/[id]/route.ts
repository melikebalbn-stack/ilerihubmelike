import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tek maliyet analizi detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const analysis = await prisma.costAnalysis.findUnique({
      where: { id },
      include: {
        category: true,
        customer: true,
        materials: {
          include: {
            supplier: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        laborItems: {
          include: {
            machine: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        externalServices: {
          include: {
            supplier: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        otherCosts: {
          orderBy: { sortOrder: 'asc' },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // FIX #9: Authorization kontrolü - yetkisiz kullanıcılar sadece kendi oluşturduklarını görebilir
    const userRole = session.user.role || 'EMPLOYEE'
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'QUALITY_MANAGER'].includes(userRole)

    if (!isPrivileged) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      })
      if (!user || analysis.createdById !== user.id) {
        return NextResponse.json({ error: 'Bu analize erişim yetkiniz yok' }, { status: 403 })
      }
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Maliyet analizi alınırken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizi alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Maliyet analizi güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yetki kontrolü
    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Mevcut analizi kontrol et
    const existingAnalysis = await prisma.costAnalysis.findUnique({
      where: { id },
    })

    if (!existingAnalysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Onaylı analizler düzenlenemez (yeni versiyon oluşturulmalı)
    if (existingAnalysis.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Onaylı analizler düzenlenemez. Yeni versiyon oluşturun.' },
        { status: 400 }
      )
    }

    const {
      code,
      name,
      description,
      revision,
      finishedWeight,
      currency,
      categoryId,
      customerId,
      overheadRate,
      profitRate,
      status,
    } = body

    // Kod değiştiyse benzersizlik kontrolü
    if (code && code !== existingAnalysis.code) {
      const duplicateCode = await prisma.costAnalysis.findUnique({
        where: { code },
      })
      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Bu ürün kodu zaten mevcut' },
          { status: 400 }
        )
      }
    }

    const analysis = await prisma.costAnalysis.update({
      where: { id },
      data: {
        code: code?.trim() || existingAnalysis.code,
        name: name?.trim() || existingAnalysis.name,
        description: description !== undefined ? description?.trim() || null : existingAnalysis.description,
        revision: revision?.trim() || existingAnalysis.revision,
        finishedWeight: finishedWeight ? parseFloat(finishedWeight) : existingAnalysis.finishedWeight,
        currency: currency || existingAnalysis.currency,
        categoryId: categoryId !== undefined ? (categoryId || null) : existingAnalysis.categoryId,
        customerId: customerId !== undefined ? (customerId || null) : existingAnalysis.customerId,
        overheadRate: overheadRate !== undefined ? parseFloat(overheadRate) : existingAnalysis.overheadRate,
        profitRate: profitRate !== undefined ? parseFloat(profitRate) : existingAnalysis.profitRate,
        status: status || existingAnalysis.status,
      },
      include: {
        category: true,
        customer: true,
      },
    })

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Maliyet analizi güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizi güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Maliyet analizi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yetki kontrolü - sadece ADMIN veya SUPER_ADMIN silebilir
    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    // Mevcut analizi kontrol et
    const existingAnalysis = await prisma.costAnalysis.findUnique({
      where: { id },
    })

    if (!existingAnalysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Onaylı analizler silinemez
    if (existingAnalysis.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Onaylı analizler silinemez. Arşivleyebilirsiniz.' },
        { status: 400 }
      )
    }

    // Cascade delete ile tüm alt kayıtlar da silinir
    await prisma.costAnalysis.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Maliyet analizi silindi' })
  } catch (error) {
    console.error('Maliyet analizi silinirken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizi silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
