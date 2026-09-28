// GET /api/bolum-degisiklik-talep/menu-bayrak
// Sidebar bayrağı — SUNUCUDA hesaplanır (kadro-talep deseni). İstemci yalnız okur.
//   talepAcabilir : Formlar › İV altındaki "Bölüm Değişikliği Talebi" (müdür/müdür-yrd)
//   iv            : İV menüsündeki "Bölüm Değişikliği Talepleri" kuyruğu
//   bekleyen      : İV için bekleyen talep sayısı (kuyruk başlığında gösterilir)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { bolumTalepYetkisiCore } from '@/lib/bolum-talep/bolum-talep-yetki'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error
  const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)

  const bekleyen = yetki.iv
    ? await prisma.bolumDegisiklikTalep.count({ where: { durum: 'BEKLIYOR' } })
    : 0

  return NextResponse.json({
    talepAcabilir: yetki.talepAcabilir,
    iv: yetki.iv,
    bekleyen,
  })
}
