// GET /api/strategic-hr/recruitment/personnel-requests/pozisyon-secenekleri?bolum=<ad>
//
// Kadro talep formunun iki açılır listesini TEK çağrıda besler:
//   · bolumler   → talebin açılabileceği bölümler (talepBolumleriCoz kapsamı)
//   · secenekler → `bolum` (verilmezse varsayılan) bölümünün org ağacındaki
//                  TEKİL pozisyon unvanları
//
// Bölümün şema bağı (DepartmentDefinition.orgUnitId) yoksa `secenekler` boş döner
// ve `uyari` dolar — form o durumda elle yazma yolunu açık tutar.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { kadroTalepErisimiCore, kadroTalepErisimYok } from '@/lib/kadro-talep/kadro-talep-yetki'
import { talepBolumleriCoz, bolumKapsamdaMi } from '@/lib/kadro-talep/talep-bolumleri'
import { pozisyonUnvanlari } from '@/lib/kadro-talep/pozisyon-secenekleri'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession()
    if (error) return error
    const erisim = await kadroTalepErisimiCore(session.user.id, session.user.permissions ?? [])
    if (!erisim.erisebilir) return kadroTalepErisimYok()

    const { bolumler, varsayilan } = await talepBolumleriCoz(session.user.id, session.user.permissions ?? [])
    const istenen = (request.nextUrl.searchParams.get('bolum') ?? '').trim() || varsayilan || ''

    if (!istenen) {
      return NextResponse.json({
        bolumler,
        varsayilan,
        bolum: null,
        secenekler: [],
        uyari: bolumler.length
          ? 'Bölüm seçilmedi — pozisyon listesi için bölüm seçin.'
          : 'Kadro talebi açabileceğiniz bir bölüm bulunamadı (koltuk/Personnel bağı yok).',
      })
    }

    // Fail-closed: kapsam dışı bölüm için liste verilmez (kapsam = talep açma kapsamı).
    const secili = bolumKapsamdaMi(bolumler, istenen)
    if (!secili) {
      return NextResponse.json({ error: 'Bu bölüm için kadro talebi açma yetkiniz yok.' }, { status: 403 })
    }

    if (!secili.orgUnitId) {
      return NextResponse.json({
        bolumler,
        varsayilan,
        bolum: secili.name,
        secenekler: [],
        uyari: 'Bölümün organizasyon şeması bağı yok — pozisyon listesi üretilemedi. Pozisyonu elle yazabilirsiniz.',
      })
    }

    // OrgUnit tablosu küçük: alt ağaç tek sorguyla çekilip bellekte yürünür
    // (gorev-secenekleri ucuyla aynı desen).
    const birimler = await prisma.orgUnit.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, parentId: true },
    })
    const secenekler = pozisyonUnvanlari(birimler, secili.orgUnitId)

    return NextResponse.json({
      bolumler,
      varsayilan,
      bolum: secili.name,
      secenekler,
      uyari: secenekler.length
        ? undefined
        : 'Bölümün org ağacında pozisyon kutusu bulunamadı. Pozisyonu elle yazabilirsiniz.',
    })
  } catch (err) {
    console.error('Pozisyon seçenekleri hatası:', err)
    return NextResponse.json({ error: 'Pozisyon listesi alınamadı' }, { status: 500 })
  }
}
