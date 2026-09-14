import { createHash } from 'node:crypto'

/**
 * MAS MES → IPRO eşleme kuralları. SAF FONKSİYON (server-only DEĞİL, DB erişmez) — DB'siz test.
 * Sorgu/şema tarafı mas/uretim.ts'te; burada yalnız değer dönüşümleri + gruplama mantığı.
 */

/** MAS Auth.User.EmployeeNo → IPRO Personnel.sicilNo. 'ILR-' + 5 haneye sıfır dolgulu sayısal kısım.
 * Örn '0029' → 'ILR-00029', '01151' → 'ILR-01151'. Rakam yoksa null (eşlenemez). */
export function employeeNoToSicilNo(employeeNo: string | null | undefined): string | null {
  if (employeeNo == null) return null
  const rakam = String(employeeNo).replace(/\D/g, '')
  if (!rakam) return null
  return `ILR-${rakam.padStart(5, '0')}`
}

/** MAS WorkCenter.Code → ipro_tezgah.kod (birebir, trim). Boşsa null. */
export function workCenterToTezgahKod(code: string | null | undefined): string | null {
  const k = (code ?? '').trim()
  return k || null
}

/**
 * Üretim adedi: Amount > 0 ise Amount, değilse ReportedAmount. Sonra sayaç dönüşümü uygulanır:
 * ham × (CounterMultiplier || 1) / (CounterDivider || 1). Negatif/geçersiz → 0.
 */
export function uretimAdedi(input: {
  amount?: number | null
  reportedAmount?: number | null
  counterMultiplier?: number | null
  counterDivider?: number | null
}): number {
  const amount = Number(input.amount) || 0
  const reported = Number(input.reportedAmount) || 0
  const ham = amount > 0 ? amount : reported
  const mult = Number(input.counterMultiplier)
  const div = Number(input.counterDivider)
  const m = Number.isFinite(mult) && mult > 0 ? mult : 1
  const d = Number.isFinite(div) && div > 0 ? div : 1
  const sonuc = (ham * m) / d
  return Number.isFinite(sonuc) && sonuc > 0 ? sonuc : 0
}

/** Bir üretimin (ProductionMaster) tek satıra indirgenmiş, IPRO'ya yazılabilir özeti. */
export interface MasUretimGirdi {
  masId: number | string
  tezgahKod: string | null
  employeeNo: string | null
  workOrderNo: string | null
  operasyonNo: string | null
  amount?: number | null
  reportedAmount?: number | null
  counterMultiplier?: number | null
  counterDivider?: number | null
  startDateTime?: string | null
}

/**
 * Aynı WorkOrderNo'nun farklı operasyonları AYRI iş sayılmaz — bir iş emrinin adedi tekrar edilmiştir
 * (operasyonlarda aynı miktar). Girdiler WorkOrderNo'ya göre gruplanır; her grup için tek adet
 * (operasyonların EN BÜYÜK adedi — tekrar edilen değerde max = o değer). workOrderNo boşsa masId ile
 * kendi grubunda kalır (birleştirme yok). Farklı WorkOrderNo'lar ayrı iş.
 */
export interface MasIsGrubu {
  anahtar: string // workOrderNo ?? `PM:${masId}`
  workOrderNo: string | null
  tezgahKod: string | null
  employeeNo: string | null
  adet: number
  satirSayisi: number
}

export function isEmirineGrupla(girdiler: MasUretimGirdi[]): MasIsGrubu[] {
  const gruplar = new Map<string, MasIsGrubu>()
  for (const g of girdiler) {
    const anahtar = (g.workOrderNo ?? '').trim() || `PM:${g.masId}`
    const adet = uretimAdedi(g)
    const mevcut = gruplar.get(anahtar)
    if (!mevcut) {
      gruplar.set(anahtar, {
        anahtar,
        workOrderNo: (g.workOrderNo ?? '').trim() || null,
        tezgahKod: g.tezgahKod,
        employeeNo: g.employeeNo,
        adet,
        satirSayisi: 1,
      })
    } else {
      // Aynı iş emri: adet tekrar edilmiş → max (tekrar edilen değerde max = o değer).
      mevcut.adet = Math.max(mevcut.adet, adet)
      mevcut.satirSayisi++
    }
  }
  return [...gruplar.values()]
}

/** Değişiklik tespiti için üretim özet hash'i (masId + tezgah + adet + iş emri). */
export function uretimHash(g: MasIsGrubu): string {
  return createHash('sha256')
    .update(JSON.stringify({ a: g.anahtar, t: g.tezgahKod, e: g.employeeNo, q: g.adet }))
    .digest('hex')
}
