import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { Prisma } from '@/generated/prisma'
import { ZIMMET_TUR_SECENEKLERI, YAZILIM_KOK_ADI } from '@/lib/zimmet/tur'
import { esitlikIcinNormalize } from '@/lib/zimmet/arama'

export const dynamic = 'force-dynamic'

// Kök seviyede (parentId=null, yani YENİ BİR TÜR eklerken) rezerve edilmiş
// adlar - bunlarla çakışırsa turDiger'ın "TürAdı[· AltDal]" formatı (bkz.
// tur.ts ozelTurKaydi) ile sistemin zaten özel anlam yüklediği isimler
// (Office 365, Diğer, sabit donanım türleri) birbirine karışır. Alt-dal
// seviyesinde (parentId dolu) bu kısıtlama YOK - "Office 365" zaten Yazılım
// kökünün gerçek bir çocuğu.
const KOK_REZERVE_ADLAR = [...ZIMMET_TUR_SECENEKLERI, 'Office 365', 'Diğer'].map(esitlikIcinNormalize)

// GET - Tür (kök, parentId=null) veya alt-dal (parentId=<id>) listesi.
// ?parentId=null (veya parametre hiç verilmezse) → kök seviyesi (tür
// dropdown'unun DB'den gelen kısmı - sabit 5 donanım türü + "Yazılım" artık
// istemci tarafında SABİT olarak sunuluyor, bkz. useZimmetFormu.ts
// SABIT_TUR_SECENEKLERI / TanimCombobox.tsx haricTutulacaklar).
// ?parentId=<id> → o tanımın alt-dalları (ör. Yazılım kökünün id'si → 8+
// yazılım adı).
// Yetki: zimmet-formu.create (form dolduran herkes okuyabilsin).
export async function GET(request: NextRequest) {
  try {
    const { error } = await requirePermission('zimmet-formu.create')
    if (error) return error

    const parentIdParam = new URL(request.url).searchParams.get('parentId')
    const parentId = !parentIdParam || parentIdParam === 'null' ? null : parentIdParam

    const liste = await prisma.zimmetTanim.findMany({
      where: { parentId, aktif: true },
      orderBy: [{ sira: 'asc' }, { ad: 'asc' }],
    })

    // "Yazılım" kök satırı, alt-dal (yazılım) listesinin bağlanacağı gerçek
    // bir id'ye ihtiyaç duyduğu için hâlâ DB'de gerçek bir ZimmetTanim satırı
    // olmak ZORUNDA (bkz. tur.ts YAZILIM_KOK_ADI) - ama artık migration'dan
    // sonra AYRICA elle seed.sql çalıştırılmasına bağımlı OLMASIN diye, kök
    // seviyesi her okunduğunda satır yoksa burada kendini onarır. Gerçek
    // `upsert` KULLANILAMIYOR - Prisma'nın ad_parentId bileşik unique
    // filtresi parentId:null kabul etmiyor (Postgres'te de NULL'lar unique
    // kısıtlamada birbirine eşit sayılmaz, bkz. seed.sql'deki aynı not) - bu
    // yüzden seed.sql ile AYNI desen: find-then-create. Teorik olarak iki
    // eşzamanlı istek ikisi de satırı "yok" görüp ikisi de create deneyebilir
    // (yalnız satır hiç yokken, yani pratikte ilk migration sonrası çok kısa
    // bir pencerede) - P2002 ise sonraki GET zaten mevcut satırı bulur, kritik
    // değil. Başarısız olursa (ör. geçici DB hatası) sessizce yutulur -
    // istemci tarafı zaten kök id bulunamazsa serbest metne düşecek şekilde
    // tasarlandı (bkz. ZimmetFormuStep1.tsx, ZimmetListesi.tsx).
    if (parentId === null && !liste.some((t) => t.ad === YAZILIM_KOK_ADI)) {
      try {
        const yazilimKoku =
          (await prisma.zimmetTanim.findFirst({ where: { ad: YAZILIM_KOK_ADI, parentId: null } })) ??
          (await prisma.zimmetTanim.create({ data: { ad: YAZILIM_KOK_ADI, parentId: null } }))
        liste.push(yazilimKoku)
        liste.sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'))
      } catch (onarimHatasi) {
        console.error('[GET /api/zimmet-formu/tanim] Yazılım kökü onarılamadı', onarimHatasi)
      }
    }

    return NextResponse.json(liste)
  } catch (err) {
    console.error('[GET /api/zimmet-formu/tanim]', err)
    return NextResponse.json({ error: 'Tanım listesi yüklenemedi' }, { status: 500 })
  }
}

// POST - Yeni tür (parentId yok/null) veya alt-dal (parentId dolu) ekler.
// Aynı parent altında ad benzersiz olmalı (@@unique([ad, parentId])).
// Yetki: zimmet-formu.view (IT/admin tier - Düzenle/Sil ile AYNI, bkz.
// [id]/route.ts).
export async function POST(request: NextRequest) {
  try {
    const { error } = await requirePermission('zimmet-formu.view')
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const ad = typeof body?.ad === 'string' ? body.ad.trim() : ''
    if (!ad) {
      return NextResponse.json({ error: 'Ad zorunlu' }, { status: 400 })
    }
    const parentId = typeof body?.parentId === 'string' ? body.parentId : null

    if (parentId === null && KOK_REZERVE_ADLAR.includes(esitlikIcinNormalize(ad))) {
      return NextResponse.json(
        { error: 'Bu ad sistem tarafından rezerve edilmiş, farklı bir ad seçin' },
        { status: 409 },
      )
    }

    const yeni = await prisma.zimmetTanim.create({ data: { ad, parentId } })
    return NextResponse.json(yeni, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Bu ad zaten tanımlı' }, { status: 409 })
    }
    console.error('[POST /api/zimmet-formu/tanim]', err)
    return NextResponse.json({ error: 'Tanım eklenemedi' }, { status: 500 })
  }
}
