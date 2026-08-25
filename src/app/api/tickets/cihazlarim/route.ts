import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

/**
 * IT talebi açarken "ilgili cihaz" seçimi için, OTURUM SAHİBİNİN kendi
 * zimmetindeki aktif cihazlar.
 *
 * Bilinçli olarak permission kontrolü YOK: yetkilendirme sahipliğin kendisi.
 * `zimmet-formu.view` izni olmayan bir kullanıcı da kendi cihazını talebe
 * bağlayabilmeli. Bu yüzden mevcut /api/zimmet-formu/zimmetlerim ucuna
 * dokunulmadı — o uç zimmet modülünün kendi yetki duvarını korumaya devam
 * ediyor; burası yalnızca ticket formunun ihtiyacı olan dar alan kümesini
 * döndürür.
 *
 * zimmetSahibiId filtresi SABİTTİR — query parametresiyle ezilemez.
 */
export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const cihazlar = await prisma.zimmetFormu.findMany({
    where: {
      zimmetSahibiId: user.id,
      silindiMi: false,
      cihazDurumu: 'AKTIF',
      durum: 'ONAYLANDI',
    },
    orderBy: { verilisTarihi: { sort: 'desc', nulls: 'last' } },
    select: {
      id: true,
      tur: true,
      turDiger: true,
      marka: true,
      model: true,
      seriNumarasi: true,
      pcAdi: true,
      verilisTarihi: true,
    },
  })

  return NextResponse.json(cihazlar)
}
