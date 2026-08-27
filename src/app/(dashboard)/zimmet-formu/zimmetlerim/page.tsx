import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { ZimmetlerimListesi } from './ZimmetlerimListesi'

export const dynamic = 'force-dynamic'

// Herkese açık - permission YOK. Erişim zaten oturum açmış olmaya indirgeniyor;
// hangi kayıtların görüneceği API'de zimmetSahibiId === user.id filtresiyle
// daraltılıyor (bkz. /api/zimmet-formu/zimmetlerim/route.ts), sayfa/permission
// düzeyinde ayrı bir kısıtlama gerekmiyor.
export default async function ZimmetlerimPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  return <ZimmetlerimListesi />
}
