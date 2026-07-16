import { getServerSession } from 'next-auth'
import type { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiUnauthorized, apiForbidden } from '@/lib/api-response'

/**
 * IPRO kiosk auth helper — requireSession/requireUser deseniyle BIREBIR.
 *
 * Pattern:
 *   const { kiosk, error } = await requireKiosk()
 *   if (error) return error
 *
 * Session'dan role=KIOSK dogrular, ardindan session.user.id -> IproKiosk (userId @unique)
 * cozer. Bagli tezgahlari (IproKioskTezgah -> IproTezgah) include eder.
 * kiosk yok veya aktif=false -> 403.
 *
 * Session role tasimasi: auth.ts jwt callback token.role=user.role, session callback
 * session.user.role=token.role. Kiosk provider role: 'KIOSK' donuyor -> session'a tasinir.
 */

type KioskWithTezgahlar = {
  id: string
  kod: string
  ad: string
  aktif: boolean
  userId: string
  tezgahlar: { tezgah: { id: string; kod: string; ad: string } }[]
}

export type RequireKioskResult =
  | { kiosk: KioskWithTezgahlar; error: null }
  | { kiosk: null; error: NextResponse }

export async function requireKiosk(): Promise<RequireKioskResult> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!session || !userId) {
    return { kiosk: null, error: apiUnauthorized() }
  }
  if (session.user.role !== 'KIOSK') {
    return { kiosk: null, error: apiForbidden() }
  }

  const kiosk = await prisma.iproKiosk.findUnique({
    where: { userId },
    include: {
      tezgahlar: {
        include: { tezgah: { select: { id: true, kod: true, ad: true } } },
      },
    },
  })

  if (!kiosk || !kiosk.aktif) {
    return { kiosk: null, error: apiForbidden() }
  }

  return { kiosk, error: null }
}
