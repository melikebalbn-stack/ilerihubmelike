// GET /api/bolum-degisiklik-talep/personel-secici
//
// Talep formundaki personel seçicisinin aday listesi: AKTİF personel, YALNIZ
// açanın kendi bölümü + ALT AĞACI (resolveMudurKoltukDeptler kapsamı).
//
// NEDEN AYRI UÇ: /api/personnel/secici İV kümesine kilitli (müdür 403 alır) ve
// kapsam filtresi YOK. Buradaki liste ise kapsamla SINIRLI — müdür başka bölümün
// personelini göremez, dolayısıyla talep de açamaz (POST ayrıca doğrular).
// İçerik yalnız { id, sicilNo, adSoyad, bolum, gorev } — hassas alan yok.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { bolumTalepYetkisiCore } from '@/lib/bolum-talep/bolum-talep-yetki'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)
    if (!yetki.talepAcabilir) {
      return NextResponse.json(
        { error: 'Talep yalnız müdür ve müdür yardımcıları tarafından açılabilir' },
        { status: 403 },
      )
    }

    const bolumler = yetki.kapsamBolumler.map((b) => b.name)
    const personeller = bolumler.length
      ? await prisma.personnel.findMany({
          where: { aktif: true, bolum: { in: bolumler } },
          select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true },
          orderBy: [{ bolum: 'asc' }, { adSoyad: 'asc' }],
        })
      : []

    // Hedef bölüm listesi: tüm AKTİF departmanlar (transfer hedefi kapsamla sınırlı DEĞİL).
    const hedefBolumler = await prisma.departmentDefinition.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      personeller,
      kapsamBolumler: yetki.kapsamBolumler,
      hedefBolumler,
      rol: yetki.rol,
    })
  } catch (err) {
    console.error('Bölüm talep personel seçici hatası:', err)
    return NextResponse.json({ error: 'Liste yüklenemedi' }, { status: 500 })
  }
}
