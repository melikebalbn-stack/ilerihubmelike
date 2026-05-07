import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// Varsayılan kategoriler
const defaultCategories = [
  { name: 'Süreç İyileştirme', color: '#3b82f6', icon: 'Settings', sortOrder: 1 },
  { name: 'Maliyet Azaltma', color: '#10b981', icon: 'TrendingDown', sortOrder: 2 },
  { name: 'İş Güvenliği', color: '#ef4444', icon: 'Shield', sortOrder: 3 },
  { name: 'Kalite', color: '#8b5cf6', icon: 'Award', sortOrder: 4 },
  { name: 'Verimlilik', color: '#f59e0b', icon: 'Zap', sortOrder: 5 },
  { name: 'Çalışma Ortamı', color: '#06b6d4', icon: 'Home', sortOrder: 6 },
  { name: 'Müşteri Memnuniyeti', color: '#ec4899', icon: 'Heart', sortOrder: 7 },
  { name: 'Diğer', color: '#6b7280', icon: 'MoreHorizontal', sortOrder: 99 }
]

// GET - Kategorileri listele
export async function GET() {
  try {
    let categories = await prisma.suggestionCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { suggestions: true }
        }
      }
    })

    // Eğer kategori yoksa varsayılanları oluştur
    if (categories.length === 0) {
      await prisma.suggestionCategory.createMany({
        data: defaultCategories
      })

      categories = await prisma.suggestionCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: { suggestions: true }
          }
        }
      })
    }

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Kategoriler yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni kategori ekle
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    // FIX #7: Admin kontrolü eklendi
    const userRole = user.role || 'EMPLOYEE'
    if (!['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, color, icon, sortOrder } = body

    if (!name) {
      return NextResponse.json({ error: 'Kategori adı zorunludur' }, { status: 400 })
    }

    const category = await prisma.suggestionCategory.create({
      data: {
        name,
        description,
        color: color || '#6b7280',
        icon: icon || 'Folder',
        sortOrder: sortOrder || 0
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Kategori oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
