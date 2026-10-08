import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/personnel/search?search=<terim>
 *
 * Planlı Görevler'in sorumlu seçicisinin kaynağı. /api/users'tan FARKLI:
 * orası LDAP'ı birincil kaynak alır ve e-postası olmayanı ELER; buradaki
 * kaynak Personnel tablosudur ve e-postasız personel de SEÇİLEBİLİR
 * (email: null döner) — İK'nın atayacağı mavi yaka personelin çoğunun
 * kurumsal e-postası yok (185 aktif personelin 97'si).
 *
 * E-POSTA ÇÖZÜMÜ — YALNIZ KURUMSAL (08.10.2026 düzeltmesi):
 *   User.email (employeeId = sicilNo) → Personnel.azureAdEmail, ikisi de
 *   @ilerigroup.com ise. Başka hiçbir alan kullanılmaz; kurumsal adres yoksa
 *   `email: null` döner ve form adres alanını BOŞ + salt okunur gösterir.
 *
 * ESKİ SIRA TERSİYDİ: `mailAdresi → azureAdEmail → User.email`. `mailAdresi`
 * çoğunlukla KİŞİSEL adres tutuyor (prod 08.10: Elif/Gökçe/Mehtap/Ayser'in
 * dördünde de gmail/hotmail) ve ilk sırada olduğu için kurumsal adresi eziyordu.
 * Sonuç: 20 planlı görev kişisel adrese kayıtlanmış, hatırlatmalar kişisel
 * kutulara gitmiş. Kişisel adres artık BU UÇTAN HİÇ dönmüyor.
 *
 * Auth: requireSession — içerik yalnız ad/sicil/bölüm (maaş vb. hassas alan yok).
 */

const AZAMI = 20

export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const search = (new URL(request.url).searchParams.get('search') ?? '').trim()

  // Prisma `mode: 'insensitive'` PostgreSQL'de ILIKE'a çevrilir; ILIKE Türkçe
  // İ/ı çiftinde DB collation'ına bağlıdır. Bu yüzden terim HEM olduğu gibi
  // HEM Türkçe büyük/küçük varyantlarıyla aranır — "işçi" ile "İŞÇİ" birbirini
  // bulsun.
  const varyantlar = search
    ? [...new Set([search, search.toLocaleLowerCase('tr'), search.toLocaleUpperCase('tr')])]
    : []

  const personeller = await prisma.personnel.findMany({
    where: {
      aktif: true,
      ...(varyantlar.length > 0
        ? {
            OR: varyantlar.flatMap((v) => [
              { adSoyad: { contains: v, mode: 'insensitive' as const } },
              { sicilNo: { contains: v, mode: 'insensitive' as const } },
            ]),
          }
        : {}),
    },
    select: {
      sicilNo: true,
      adSoyad: true,
      bolum: true,
      // mailAdresi KASITLI OLARAK OKUNMUYOR: kişisel adres taşıyor ve bu uca
      // girerse forma sızar. Kurumsal kaynak User.email + azureAdEmail.
      azureAdEmail: true,
    },
    orderBy: { adSoyad: 'asc' },
    take: AZAMI,
  })

  // Kurumsal e-posta: sicilNo ↔ User.employeeId. Tek sorgu (personel başına
  // sorgu YOK).
  const siciller = personeller.map((p) => p.sicilNo).filter((s): s is string => !!s)
  const kullanicilar = siciller.length
    ? await prisma.user.findMany({
        where: { employeeId: { in: siciller }, isActive: true },
        select: { employeeId: true, email: true },
      })
    : []
  const emailBySicil = new Map(kullanicilar.map((u) => [u.employeeId!, u.email]))

  const KURUMSAL_ALAN = '@ilerigroup.com'
  const kurumsalMi = (e: string | null | undefined): string | null => {
    const v = e?.trim().toLowerCase()
    return v && v.endsWith(KURUMSAL_ALAN) ? v : null
  }

  const sonuc = personeller.map((p) => ({
    // `id`: combobox listeyi bununla anahtarlıyor. Spec'te sayılmadı ama
    // olmadan React key çakışırdı; sicilNo zaten @unique.
    id: p.sicilNo ?? p.adSoyad,
    sicilNo: p.sicilNo,
    name: p.adSoyad,
    // Kurumsal adres yoksa null — personel YİNE SEÇİLEBİLİR (Melih kararı
    // 08.10): kayıt sicille bağlanır, görev Hub'da takip edilir, hatırlatma
    // maili gitmez ve görev özet raporunda "adres çözülemedi" olarak çıkar.
    // Aktif 188 personelin 131'i bu durumda (116 mavi, 12 gri, 3 beyaz yaka).
    email:
      (p.sicilNo ? kurumsalMi(emailBySicil.get(p.sicilNo)) : null) ??
      kurumsalMi(p.azureAdEmail),
    department: p.bolum,
    source: 'personnel' as const,
  }))

  return NextResponse.json(sonuc)
}
