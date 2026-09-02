import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { canAccessSandbox } from '@/lib/sandbox-config'
import { prisma } from '@/lib/prisma'
import { bulSorumluBolumleri } from '../_lib/avans-formu-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET: Sidebar için avans-formu menü bayrakları (Melih Bey'in Sidebar.tsx'e
 * ekleyeceği iaFlags/kadroTalepAcabilir deseninin avans karşılığı).
 * Tekil kullanıcı kontrolü — 84 sorumluyu taramaz, sadece giriş yapanın
 * kendi adını 4 alanda arar (bulSorumluBolumleri: tek findMany + JS filtre).
 */
export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  if (!canAccessSandbox('nurgul', user.email, user.role)) {
    return NextResponse.json({ kendimGorunur: false, sorumluGorunur: false })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { personnelId: true },
  })
  if (!dbUser?.personnelId) {
    return NextResponse.json({ kendimGorunur: false, sorumluGorunur: false })
  }

  const personel = await prisma.personnel.findUnique({
    where: { id: dbUser.personnelId },
    select: { adSoyad: true, yakaRengi: true },
  })
  if (!personel) {
    return NextResponse.json({ kendimGorunur: false, sorumluGorunur: false })
  }

  const kendimGorunur = personel.yakaRengi === 'BEYAZ' || personel.yakaRengi === 'GRI'
  const bolumler = await bulSorumluBolumleri(personel.adSoyad)

  return NextResponse.json({ kendimGorunur, sorumluGorunur: bolumler.length > 0 })
}
