// GET /api/tutanak/menu-bayrak — Sidebar görünürlüğü SUNUCUDA hesaplanır
// (client'ta yetki hesaplanmaz; deneme/bölüm-talep menu-bayrak deseni).
//
// gorunur: menüde çıksın mı — İV ∨ müdür/müdür-yrd koltuğu ∨ platform yöneticisi
//          ∨ kendisi bir tutanakta şahit/yönetici/son yönetici olan kişi.
// acabilir: "Yeni Tutanak" düğmesi.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { tutanakListeWhere, tutanakYetkisiCore } from '@/lib/tutanak/tutanak-yetki'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)

    // Koltuğu/İV'liği olmayan ama bir tutanakta adı geçen kişi de menüyü görsün;
    // yoksa bildirim gelip menüde karşılığı olmayan bir ekrana düşerdi.
    let ilgiliVar = false
    if (!yetki.erisebilir && !yetki.platformBypass) {
      ilgiliVar = (await prisma.tutanak.count({ where: tutanakListeWhere(yetki) })) > 0
    }

    return NextResponse.json({
      gorunur: yetki.erisebilir || yetki.platformBypass || ilgiliVar,
      acabilir: yetki.acabilir,
      iv: yetki.iv,
    })
  } catch (err) {
    console.error('Tutanak menü bayrağı hatası:', err)
    return NextResponse.json({ gorunur: false, acabilir: false, iv: false })
  }
}
