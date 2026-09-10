import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { topluPersonelVerisi, hesaplaPersonelRaporu } from '@/lib/personnel-report-core'

export const dynamic = 'force-dynamic'

const REPORT_ROLES = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

export async function GET() {
  try {
    // PR-PERSONNEL-SECURITY: HR-only role check (rapor TC/SGK içeren sensitive data dahil)
    const { user, error } = await requireUser()
    if (error) return error

    if (!REPORT_ROLES.includes(user.role) && !isHRDepartment(user.department)) {
      return NextResponse.json(
        { error: 'Personnel raporu için HR_MANAGER veya admin yetkisi gerekli' },
        { status: 403 }
      )
    }

    // Hesap çekirdeği @/lib/personnel-report-core'da — haftalık personel maili de
    // aynı fonksiyonu kullanır, böylece ekran ile mail aynı sayıyı gösterir.
    const { tumBolumler: _tumBolumler, ...rapor } = hesaplaPersonelRaporu(await topluPersonelVerisi())

    // tumBolumler yalnız mail şablonu için hesaplanır; uç noktanın yanıt şekli
    // DEĞİŞMEZ (ekran tarafında karşılığı yok).
    return NextResponse.json(rapor)
  } catch (error) {
    console.error('Rapor verisi alınırken hata:', error)
    return NextResponse.json({ error: 'Rapor verisi alınırken bir hata oluştu' }, { status: 500 })
  }
}
