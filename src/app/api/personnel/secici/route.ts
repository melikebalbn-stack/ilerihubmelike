import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

export const dynamic = 'force-dynamic'

/**
 * GET /api/personnel/secici
 *
 * Personel formundaki sorumlu/bölüm müdürü seçicilerinin aday listesi:
 * AKTİF personelin { id, adSoyad, sicilNo, bolum } listesi.
 *
 * NEDEN AYRI UÇ: iki personel formu bu listeyi `/api/overtime/personnel-list`ten
 * çekiyordu; o uç `resolveAllowedDepts` ile MESAİ yazma kapsamına göre süzüyor ve
 * omurgada görevi olmayan kullanıcıya BOŞ dizi döndürüyor. Liste boş gelince
 * kullanıcının elinde serbest metinden başka seçenek kalmıyor — bozuk sorumlu
 * adlarının en olası üretim yolu bu. Personel formunun aday listesi mesai
 * kapsamına bağlı OLMAMALI; burada kapsam filtresi YOKTUR.
 *
 * Yetki: personel POST/PUT ucuyla BİREBİR aynı kapı (ADMIN/HR_MANAGER/SUPER_ADMIN
 * VEYA İnsan Varlıkları bölümü). Formu açabilen listeyi de görür.
 * İçerik yalnız ad/sicil/bölüm — hassas alan yok.
 */

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    if (!ALLOWED_ROLES.includes(user.role) && !isInsanVarliklari(user.department)) {
      return NextResponse.json({ error: 'Personel listesi için HR yetkisi gerekli' }, { status: 403 })
    }

    const personeller = await prisma.personnel.findMany({
      where: { aktif: true },
      select: { id: true, adSoyad: true, sicilNo: true, bolum: true },
      orderBy: { adSoyad: 'asc' },
    })

    return NextResponse.json(personeller)
  } catch (error) {
    console.error('Personel seçici listesi alınamadı:', error)
    return NextResponse.json({ error: 'Personel listesi alınamadı' }, { status: 500 })
  }
}
