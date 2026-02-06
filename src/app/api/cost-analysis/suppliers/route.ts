import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tedarikçileri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const type = searchParams.get('type')

    const where: any = {}
    if (activeOnly) {
      where.isActive = true
    }
    if (type) {
      where.type = type
    }

    const suppliers = await prisma.costSupplier.findMany({
      where,
      include: {
        _count: {
          select: {
            materials: true,
            services: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Tedarikçiler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Tedarikçiler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni tedarikçi oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { code, name, type, country, contact, email, phone } = body

    if (!code || !name) {
      return NextResponse.json({ error: 'Kod ve isim zorunludur' }, { status: 400 })
    }

    // Kod benzersizlik kontrolü
    const existingSupplier = await prisma.costSupplier.findUnique({
      where: { code },
    })

    if (existingSupplier) {
      return NextResponse.json({ error: 'Bu kod zaten kullanımda' }, { status: 400 })
    }

    const supplier = await prisma.costSupplier.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type: type || 'MATERIAL',
        country: country?.trim() || null,
        contact: contact?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
      },
      include: {
        _count: {
          select: {
            materials: true,
            services: true,
          },
        },
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Tedarikçi oluşturulurken hata:', error)
    return NextResponse.json(
      { error: 'Tedarikçi oluşturulurken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Tedarikçi güncelle
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { id, code, name, type, country, contact, email, phone, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Tedarikçi ID zorunludur' }, { status: 400 })
    }

    const existingSupplier = await prisma.costSupplier.findUnique({
      where: { id },
    })

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Tedarikçi bulunamadı' }, { status: 404 })
    }

    // Kod değişiyorsa benzersizlik kontrolü
    if (code && code !== existingSupplier.code) {
      const codeExists = await prisma.costSupplier.findUnique({
        where: { code },
      })
      if (codeExists) {
        return NextResponse.json({ error: 'Bu kod zaten kullanımda' }, { status: 400 })
      }
    }

    const supplier = await prisma.costSupplier.update({
      where: { id },
      data: {
        code: code?.trim().toUpperCase() || existingSupplier.code,
        name: name?.trim() || existingSupplier.name,
        type: type || existingSupplier.type,
        country: country?.trim() ?? existingSupplier.country,
        contact: contact?.trim() ?? existingSupplier.contact,
        email: email?.trim() ?? existingSupplier.email,
        phone: phone?.trim() ?? existingSupplier.phone,
        isActive: isActive !== undefined ? isActive : existingSupplier.isActive,
      },
      include: {
        _count: {
          select: {
            materials: true,
            services: true,
          },
        },
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Tedarikçi güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Tedarikçi güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Tedarikçi sil
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Tedarikçi ID zorunludur' }, { status: 400 })
    }

    const supplier = await prisma.costSupplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            materials: true,
            services: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Tedarikçi bulunamadı' }, { status: 404 })
    }

    if (supplier._count.materials > 0 || supplier._count.services > 0) {
      return NextResponse.json(
        { error: 'Bu tedarikçi kullanımda olduğu için silinemez' },
        { status: 400 }
      )
    }

    await prisma.costSupplier.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Tedarikçi silindi' })
  } catch (error) {
    console.error('Tedarikçi silinirken hata:', error)
    return NextResponse.json(
      { error: 'Tedarikçi silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
