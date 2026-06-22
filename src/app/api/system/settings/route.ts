import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Sistem ayarlarını getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (category) {
      where.category = category
    }

    const settings = await prisma.systemSetting.findMany({
      where,
      orderBy: { key: 'asc' }
    })

    // Key-value map olarak döndür
    const settingsMap: Record<string, string> = {}
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value
    })

    return NextResponse.json(settingsMap)
  } catch (error) {
    console.error('Sistem ayarları yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Sistem ayarı güncelle veya oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PR-Y13: enum check yerine RBAC permission.
    // admin.system.manage → admin, it-admin, super-admin
    if (!session.user.permissions?.includes('admin.system.manage')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { key, value, category = 'dashboard' } = body

    if (!key) {
      return NextResponse.json({ error: 'Anahtar (key) zorunludur' }, { status: 400 })
    }

    // Upsert - varsa güncelle, yoksa oluştur
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: {
        key,
        value: String(value),
        category
      }
    })

    return NextResponse.json(setting)
  } catch (error) {
    console.error('Sistem ayarı kaydedilirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
