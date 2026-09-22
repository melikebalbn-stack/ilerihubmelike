// Yönetim → KPI yetki çözümü (tek kaynak: sayfa guard'ı, API uçları, Sidebar bayrağı).
//
// Kararlar (22.09.2026):
// - "Müdür" = DepartmentDefinition'da müdür VEYA müdür yardımcısı koltuğu (rol değil);
//   kapsam kadro talepteki resolveMudurKoltukDeptler emsali (koltuk + alt ağaç).
// - Görüntüleme: kpi.view ∨ kpi.manage ∨ müdür koltuğu → TÜM departmanlar (kapsam süzgeci yok).
// - Yazma (ölçüm / ortalama / aksiyon ekle-düzenle): kpi.manage ∨ (koltuk ∧ KPI'nın
//   orgUnit'i koltuk ağacındaki DeptDef.orgUnitId kümesinde). Kapsam dışı → 403.
// - KPI tanımı oluştur/düzenle/sil, import, şablon: yalnız kpi.manage (route'larda
//   requirePermission ile kalır; burada dokunulmaz).
// - kpi.view / kpi.manage sahiplerinin davranışı değişmez (manage → yazilabilirOrgUnitIdler = null = tümü).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { resolveMudurKoltukDeptler } from '@/lib/overtime-performance'

export interface KpiYetki {
  /** KPI Takibi + KPI Özet açılır / GET uçları */
  goruntule: boolean
  /** kpi.manage — tanım oluştur/sil/düzenle, import, şablon; yazma kapsamı sınırsız */
  manage: boolean
  /** Ölçüm/ortalama/aksiyon girilebilecek OrgUnit id'leri. null = tümü (manage). Boş dizi = hiçbiri. */
  yazilabilirOrgUnitIdler: string[] | null
}

const YETKI_YOK: KpiYetki = { goruntule: false, manage: false, yazilabilirOrgUnitIdler: [] }

/**
 * Müdür koltuğu var mı + koltuk ağacındaki DeptDef'lerin OrgUnit id'leri
 * (orgUnitId boş olanlar yazma kapsamından düşer; 22.09 itibarıyla 28/28 dolu).
 */
export async function mudurKoltukOrgUnitIdler(userId: string): Promise<{ koltukVar: boolean; orgUnitIdler: string[] }> {
  const deptler = await resolveMudurKoltukDeptler(userId)
  if (deptler.length === 0) return { koltukVar: false, orgUnitIdler: [] }
  const rows = await prisma.departmentDefinition.findMany({
    where: { id: { in: deptler.map((d) => d.id) }, orgUnitId: { not: null } },
    select: { orgUnitId: true },
  })
  return { koltukVar: true, orgUnitIdler: [...new Set(rows.map((r) => r.orgUnitId as string))] }
}

export async function kpiYetkisiCoz(userId: string): Promise<KpiYetki> {
  const perms = await getUserPermissions(userId)
  const manage = perms.has(PERMISSION_KEYS.KPI_MANAGE)
  const view = perms.has(PERMISSION_KEYS.KPI_VIEW)
  if (manage) return { goruntule: true, manage: true, yazilabilirOrgUnitIdler: null }
  const { koltukVar, orgUnitIdler } = await mudurKoltukOrgUnitIdler(userId)
  return { goruntule: view || koltukVar, manage: false, yazilabilirOrgUnitIdler: orgUnitIdler }
}

/** KPI'ya yazabilir mi (manage ∨ orgUnit koltuk ağacında). */
export function kpiYazabilirMi(yetki: KpiYetki, orgUnitId: string): boolean {
  if (yetki.manage) return true
  return (yetki.yazilabilirOrgUnitIdler ?? []).includes(orgUnitId)
}

type Basari = { userId: string; yetki: KpiYetki; error: null }
type Hata = { userId: null; yetki: null; error: NextResponse }

/** Görüntüleme kapısı (GET uçları): 401 oturum yok, 403 görüntüleme yok. */
export async function requireKpiGoruntule(): Promise<Basari | Hata> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { userId: null, yetki: null, error: NextResponse.json({ error: 'Yetkisiz: oturum bulunamadı' }, { status: 401 }) }
  }
  const yetki = await kpiYetkisiCoz(session.user.id)
  if (!yetki.goruntule) {
    return {
      userId: null,
      yetki: null,
      error: NextResponse.json({ error: 'Yetersiz yetki', required: [PERMISSION_KEYS.KPI_VIEW, 'müdür koltuğu'] }, { status: 403 }),
    }
  }
  return { userId: session.user.id, yetki, error: null }
}

/**
 * Yazma kapısı (ölçüm / ortalama / aksiyon): KPI'yı bulur, manage ∨ koltuk kapsamı
 * kontrol eder. 404 KPI yok, 403 kapsam dışı. Başarıda kpi (id, orgUnitId) döner.
 */
export async function requireKpiYaz(
  kpiId: string,
): Promise<(Basari & { kpi: { id: string; orgUnitId: string } }) | Hata> {
  const kapi = await requireKpiGoruntule()
  if (kapi.error) return kapi
  const kpi = await prisma.kPIDefinition.findUnique({ where: { id: kpiId }, select: { id: true, orgUnitId: true } })
  if (!kpi) return { userId: null, yetki: null, error: NextResponse.json({ error: 'KPI bulunamadı' }, { status: 404 }) }
  if (!kpiYazabilirMi(kapi.yetki, kpi.orgUnitId)) {
    return {
      userId: null,
      yetki: null,
      error: NextResponse.json({ error: 'Bu departmanın KPI verisine yazma yetkiniz yok' }, { status: 403 }),
    }
  }
  return { ...kapi, kpi }
}

/** Sayfa guard'ı (server component): oturum + görüntüleme. */
export async function kpiGoruntuleyebilirMi(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false
  return (await kpiYetkisiCoz(session.user.id)).goruntule
}

/** Sidebar / istemci için özet (kpiYetkisiCoz'un JSON hâli). */
export type KpiYetkiOzeti = KpiYetki
