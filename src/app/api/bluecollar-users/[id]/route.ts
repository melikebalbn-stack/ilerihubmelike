import { syncUserToAkademi, deactivateUserInAkademi } from '@/lib/akademi-sync'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT - Mavi yaka kullanıcı güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece HR_MANAGER, ADMIN, SUPER_ADMIN erişebilir
    const userRole = session.user.role
    if (!['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { employeeId, tcLastFour, name, department, jobTitle, duty, section, serviceRoute, serviceStop, isActive } = body

    // Kullanıcı var mı kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // TC son 4 hane doğrulama
    if (tcLastFour && !/^\d{4}$/.test(tcLastFour)) {
      return NextResponse.json(
        { error: 'TC son 4 hane 4 rakamdan oluşmalıdır' },
        { status: 400 }
      )
    }

    // Sicil numarası değiştiyse, benzersizlik kontrolü
    if (employeeId && employeeId !== existingUser.employeeId) {
      const existingByEmployeeId = await prisma.user.findUnique({
        where: { employeeId }
      })

      if (existingByEmployeeId) {
        return NextResponse.json(
          { error: 'Bu sicil numarası zaten başka bir kullanıcıya ait' },
          { status: 400 }
        )
      }
    }

    // Kullanıcı güncelle
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(employeeId && { employeeId }),
        ...(tcLastFour && { tcLastFour }),
        ...(name && { name }),
        ...(department !== undefined && { department }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(duty !== undefined && { duty: duty || null }),
        ...(section !== undefined && { section: section || null }),
        ...(serviceRoute !== undefined && { serviceRoute: serviceRoute || null }),
        ...(serviceStop !== undefined && { serviceStop: serviceStop || null }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        employeeId: true,
        // FIX #3: tcLastFour kaldırıldı - KVKK
        department: true,
        jobTitle: true,
        duty: true,
        section: true,
        serviceRoute: true,
        serviceStop: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      }
    })


    // Akademi'ye senkronize et
    syncUserToAkademi(user, "blue_collar").catch((err) =>
      console.error("Akademi sync hatasi:", err)
    )
    return NextResponse.json(user)
  } catch (error) {
    console.error('Mavi yaka kullanıcı güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Mavi yaka kullanıcı kalıcı sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece HR_MANAGER, ADMIN, SUPER_ADMIN erişebilir
    const userRole = session.user.role
    if (!['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const { id } = await params

    // Kullanıcı var mı kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Kalıcı silme
    await prisma.user.delete({
      where: { id }
    })

    // Akademi'de devre disi birak
    deactivateUserInAkademi(id, existingUser.name || undefined).catch((err) =>
      console.error("Akademi sync hatasi:", err)
    )
    return NextResponse.json({ message: 'Kullanıcı kalıcı olarak silindi' })
  } catch (error: any) {
    // Foreign key constraint hatası
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Bu kullanıcı başka kayıtlarla ilişkili olduğu için silinemez. Önce deaktif etmeyi deneyin.' },
        { status: 409 }
      )
    }
    console.error('Mavi yaka kullanıcı silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
