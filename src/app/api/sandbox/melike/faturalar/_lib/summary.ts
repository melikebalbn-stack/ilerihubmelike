const SISTEM_GELISTIRME_LABEL = 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ'

export interface InvoiceForSummary {
  invoiceDate: Date
  amountEUR: unknown // Prisma Decimal
  amountTRY: unknown
  departmentName: string | null
  allocations: { departmentName: string; amountEUR: unknown; amountTRY: unknown }[]
}

interface MonthBucket {
  genel: number
  sistemGelistirme: number
  toplamTRY: number
  toplamEUR: number
  genelTRY: number
  sistemGelistirmeTRY: number
  byDepartment: Map<string, { eur: number; tl: number }>
}

export interface MonthSummary {
  key: string
  genel: number
  sistemGelistirme: number
  toplamTRY: number
  toplamEUR: number
  genelTRY: number
  sistemGelistirmeTRY: number
  departments: { label: string; eur: number; tl: number }[]
}

export interface Summary {
  totals: { genel: number; sistemGelistirme: number; toplam: number; oran: number }
  months: MonthSummary[]
  departments: { label: string; eur: number; tl: number }[]
}

/** Faturaları (çoklu bölüme bölünmüş olanlar dahil) ay + bölüm bazında kırılıma çevirir. */
export function computeSummary(invoices: InvoiceForSummary[]): Summary {
  const parts = invoices.flatMap((inv) => {
    if (inv.allocations.length > 0) {
      const allocParts = inv.allocations.map((a) => ({
        invoiceDate: inv.invoiceDate,
        label: a.departmentName,
        eur: Number(a.amountEUR),
        tl: Number(a.amountTRY),
      }))
      // Bölümlerin yüzdesi %100'ü bulmuyorsa kalan kısım örtük "Genel"dir (ayrı satır olarak saklanmaz)
      const allocEur = allocParts.reduce((s, p) => s + p.eur, 0)
      const allocTl = allocParts.reduce((s, p) => s + p.tl, 0)
      const remainderEur = Number(inv.amountEUR) - allocEur
      const remainderTl = Number(inv.amountTRY) - allocTl
      if (remainderEur > 0.005) {
        allocParts.push({ invoiceDate: inv.invoiceDate, label: 'Genel', eur: remainderEur, tl: remainderTl })
      }
      return allocParts
    }
    return [
      {
        invoiceDate: inv.invoiceDate,
        label: inv.departmentName ?? 'Genel',
        eur: Number(inv.amountEUR),
        tl: Number(inv.amountTRY),
      },
    ]
  })

  let genel = 0
  let sistemGelistirme = 0
  const monthly = new Map<string, MonthBucket>()
  const byDepartment = new Map<string, { eur: number; tl: number }>()

  for (const part of parts) {
    const dept = byDepartment.get(part.label) ?? { eur: 0, tl: 0 }
    dept.eur += part.eur
    dept.tl += part.tl
    byDepartment.set(part.label, dept)

    const key = part.invoiceDate.toISOString().slice(0, 7)
    if (!monthly.has(key)) {
      monthly.set(key, {
        genel: 0,
        sistemGelistirme: 0,
        toplamTRY: 0,
        toplamEUR: 0,
        genelTRY: 0,
        sistemGelistirmeTRY: 0,
        byDepartment: new Map(),
      })
    }
    const bucket = monthly.get(key)!
    bucket.toplamTRY += part.tl
    bucket.toplamEUR += part.eur

    const monthDept = bucket.byDepartment.get(part.label) ?? { eur: 0, tl: 0 }
    monthDept.eur += part.eur
    monthDept.tl += part.tl
    bucket.byDepartment.set(part.label, monthDept)

    if (part.label === SISTEM_GELISTIRME_LABEL) {
      sistemGelistirme += part.eur
      bucket.sistemGelistirme += part.eur
      bucket.sistemGelistirmeTRY += part.tl
    } else {
      genel += part.eur
      bucket.genel += part.eur
      bucket.genelTRY += part.tl
    }
  }

  const toplam = genel + sistemGelistirme
  const oran = toplam > 0 ? (sistemGelistirme / toplam) * 100 : 0

  const months = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      genel: v.genel,
      sistemGelistirme: v.sistemGelistirme,
      toplamTRY: v.toplamTRY,
      toplamEUR: v.toplamEUR,
      genelTRY: v.genelTRY,
      sistemGelistirmeTRY: v.sistemGelistirmeTRY,
      departments: Array.from(v.byDepartment.entries())
        .map(([label, d]) => ({ label, ...d }))
        .sort((a, b) => b.eur - a.eur),
    }))

  const departments = Array.from(byDepartment.entries())
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.eur - a.eur)

  return { totals: { genel, sistemGelistirme, toplam, oran }, months, departments }
}
