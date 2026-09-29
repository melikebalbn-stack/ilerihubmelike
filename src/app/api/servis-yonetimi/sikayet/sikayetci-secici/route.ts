import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { sikayetciAra } from '@/lib/servis-yonetimi/sikayetci-secici'

export const dynamic = 'force-dynamic'

// MASTER Madde 46 — şikâyet formundaki "Şikâyetçi" alanı için personel arama.
//
// AYRI UÇ, mevcut personel seçicileri (personnel/secici, personnel/search,
// bolum-degisiklik-talep/personel-secici, toplu-kart-okutamama/personnel-search)
// YENİDEN KULLANILMADI: hiçbiri servis.sikayet.manage ile korunmuyor, ikisi
// (search, secici) KVKK minimumunun üstünde alan (email) veya arama/limit
// olmadan tüm aktif personeli döndürüyor. Ölçüm raporu: 2026-09-29.
//
// İş mantığı (arama, min uzunluk, select) sikayetciAra()'da — bu dosya
// yalnız HTTP kabuğu: yetki + parametre.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.sikayet.manage')
  if (error) return error

  const arama = request.nextUrl.searchParams.get('arama')
  const sonuc = await sikayetciAra(prisma, arama)

  return NextResponse.json(sonuc)
}
