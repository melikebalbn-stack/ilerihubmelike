import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

// Herkese açık - permission YOK. zimmetSahibiId: user.id filtresi (session'dan,
// sunucu tarafı, spoof edilemez) tek başına yeterli: kullanıcı SADECE kendi
// kayıtlarını görebilir, query param'la ezilemez.
export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const zimmetler = await prisma.zimmetFormu.findMany({
    where: {
      zimmetSahibiId: user.id,
      silindiMi: false,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tur: true,
      turDiger: true,
      marka: true,
      model: true,
      aciklama: true,
      ozellik: true,
      macAdresi: true,
      pcAdi: true,
      imeiNumarasi: true,
      departman: true,
      seriNumarasi: true,
      verilisTarihi: true,
      durum: true,
      kaynak: true,
      redSebebi: true,
      zimmetSahibiImzaTarihi: true,
      imzaModu: true,
      islakImzaDosyasi: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json(zimmetler)
}
