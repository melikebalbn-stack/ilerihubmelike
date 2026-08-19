import { requirePermission } from '@/lib/auth/require-permission'
import { getWorkCenterDepartments } from '@/lib/ifs/work-center-departments'
import { TerminalMenuClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'IPRO' }

// Üretim Terminali — ana menü (T1). Guard geçici: /uretim/bildirim ile aynı
// admin.system.manage kontrolü (ayrı iş). İlk ekran ARTIK bölüm (departman) seçimi:
// operatör IFS bölümlerinden birini seçer (?dept query ile taşınır). Alt akış
// (tezgah → iş emri) ayrı iş — bu ekran yalnız bölüm listesini gösterir.
export default async function UretimTerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>
}) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  const { dept } = await searchParams
  const seciliDept = typeof dept === 'string' && dept.trim() ? dept.trim() : null

  // IFS "Bakım Atölyesi Bölümleri" — site (ILER2) için tüm bölümler (10 kayıt).
  // Kaynak: WorkCenterHandling.svc/Reference_WorkCenterDepartment. Filtreleme yok.
  let departmanlar: { kod: string; ad: string }[] = []
  let ifsError: string | null = null
  try {
    departmanlar = await getWorkCenterDepartments()
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
  }

  // Seçili bölümün adı (yer tutucu başlığında kod yerine ad göstermek için).
  const seciliDeptAd = seciliDept
    ? (departmanlar.find((d) => d.kod === seciliDept)?.ad ?? '')
    : ''

  return (
    <TerminalMenuClient
      operatorName={session.user.name ?? 'Operatör'}
      departmanlar={departmanlar}
      seciliDept={seciliDept}
      seciliDeptAd={seciliDeptAd}
      ifsError={ifsError}
    />
  )
}
