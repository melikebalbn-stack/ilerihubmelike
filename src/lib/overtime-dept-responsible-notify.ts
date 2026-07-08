// Mesai formu son onayı (APPROVED) sonrası birim sorumlularına bilgi maili.
// Sorumlu = formdaki personellerin workDepartment'larının DOĞRUDAN sorumluları
// (DepartmentDefinition.mudur/mudurYardimcisi/sorumlu1-3 — Personnel FK).
// Personnel → User.personnelId → email. Kişi bazında tekilleştirilir; her sorumlu
// YALNIZ kendi sorumlu olduğu bölüm(ler)in personelini görür. Non-blocking.
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { formatVardiyaHafta } from '@/lib/vardiya-hafta'
import {
  approvedDeptResponsibleSubject,
  buildApprovedDeptResponsibleMailText,
  buildApprovedDeptResponsibleMailHtml,
  type DeptGroup,
} from '@/lib/email-templates/overtime-approved-dept-responsible'

export interface DeptResponsibleRecipient {
  userId: string
  email: string
  name: string
  departments: DeptGroup[] // yalnız bu kişinin sorumlu olduğu bölüm(ler) + o formdaki personel
}
export interface UnresolvedResponsible {
  dept: string
  personnelId: string
}

/**
 * Verilen bölüm→personel haritası için DOĞRUDAN sorumluları User'a resolve edip
 * kişi bazında tekilleştirir. Resolve edilemeyen sorumlular ayrı listelenir (loglanır).
 */
export async function resolveDeptResponsibleRecipients(
  personelByDept: Map<string, string[]>
): Promise<{ recipients: DeptResponsibleRecipient[]; unresolved: UnresolvedResponsible[] }> {
  const deptNames = [...personelByDept.keys()]
  if (deptNames.length === 0) return { recipients: [], unresolved: [] }

  const depts = await prisma.departmentDefinition.findMany({
    where: { name: { in: deptNames } },
    select: {
      name: true,
      mudurId: true,
      mudurYardimcisiId: true,
      sorumlu1Id: true,
      sorumlu2Id: true,
      sorumlu3Id: true,
    },
  })

  // bölüm → sorumlu personnelId'leri (doğrudan, 5 slot)
  const respByDept = new Map<string, string[]>()
  const allPersonnelIds = new Set<string>()
  for (const d of depts) {
    const ids = [d.mudurId, d.mudurYardimcisiId, d.sorumlu1Id, d.sorumlu2Id, d.sorumlu3Id].filter(
      (x): x is string => !!x
    )
    respByDept.set(d.name, ids)
    for (const id of ids) allPersonnelIds.add(id)
  }

  const users = allPersonnelIds.size
    ? await prisma.user.findMany({
        where: { personnelId: { in: [...allPersonnelIds] } },
        select: { id: true, email: true, name: true, personnelId: true },
      })
    : []
  const userByPersonnel = new Map(users.map((u) => [u.personnelId as string, u]))

  const unresolved: UnresolvedResponsible[] = []
  const byUser = new Map<string, DeptResponsibleRecipient>()
  for (const [deptName, respIds] of respByDept) {
    const personel = personelByDept.get(deptName) ?? []
    for (const pid of respIds) {
      const u = userByPersonnel.get(pid)
      if (!u || !u.email) {
        unresolved.push({ dept: deptName, personnelId: pid })
        continue
      }
      let rec = byUser.get(u.id)
      if (!rec) {
        rec = { userId: u.id, email: u.email, name: u.name ?? u.email, departments: [] }
        byUser.set(u.id, rec)
      }
      if (!rec.departments.some((x) => x.name === deptName)) {
        rec.departments.push({ name: deptName, personel })
      }
    }
  }
  return { recipients: [...byUser.values()], unresolved }
}

type FormForNotify = {
  id: string
  formNo: string
  date: Date
  formTipi: 'MESAI' | 'VARDIYA'
  vardiyaHaftaMi: boolean
  personnel: { workDepartment: string; personnel: { adSoyad: string } | null }[]
}

/** Formdaki personelleri workDepartment'a göre grupla (mail içeriği için). */
export function buildPersonelByDept(form: FormForNotify): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const op of form.personnel) {
    const dept = op.workDepartment
    if (!dept) continue
    const ad = op.personnel?.adSoyad ?? '—'
    if (!map.has(dept)) map.set(dept, [])
    map.get(dept)!.push(ad)
  }
  return map
}

/**
 * MESAI formu APPROVED olduğunda birim sorumlularına bilgi maili gönderir.
 * Non-blocking: her alıcı için ayrı try-catch; toplam hata onayı KIRMAZ (çağıran da
 * try-catch'ler). Resolve edilemeyen sorumlu → console.warn + atla.
 */
export async function notifyDeptResponsiblesOnApproval(form: FormForNotify): Promise<void> {
  const personelByDept = buildPersonelByDept(form)
  const { recipients, unresolved } = await resolveDeptResponsibleRecipients(personelByDept)

  for (const u of unresolved) {
    console.warn(
      `[mesai-onay-maili] sorumlu User/email'e resolve edilemedi: bölüm="${u.dept}" personnelId=${u.personnelId} → atlandı`
    )
  }

  const isVardiya = form.formTipi === 'VARDIYA'
  const turAdi: 'mesai' | 'vardiya' = isVardiya ? 'vardiya' : 'mesai'
  // Dönem metni: vardiya + hafta modu → "38. Hafta (14-18 Temmuz)"; aksi → tam tarih.
  const tarihLabel = isVardiya ? (form.vardiyaHaftaMi ? 'Vardiya haftası' : 'Vardiya tarihi') : 'Mesai tarihi'
  const tarihStr =
    isVardiya && form.vardiyaHaftaMi
      ? formatVardiyaHafta(form.date)
      : form.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  const link = ileriHubUrl(`/forms/overtime/${form.id}`)

  for (const r of recipients) {
    try {
      const input = { formNo: form.formNo, turAdi, tarihLabel, tarihStr, departments: r.departments, link }
      await sendEmail(
        [{ email: r.email, name: r.name }],
        approvedDeptResponsibleSubject(form.formNo, isVardiya),
        buildApprovedDeptResponsibleMailText(input),
        buildApprovedDeptResponsibleMailHtml(input)
      )
    } catch (e) {
      console.error(`[mesai-onay-maili] gönderim hatası (${r.email}):`, e)
    }
  }
}
