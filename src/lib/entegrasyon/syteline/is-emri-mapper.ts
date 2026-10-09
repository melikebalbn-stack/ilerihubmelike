import { createHash } from 'node:crypto'

/**
 * Syteline iş emri (başlık + rota operasyonları) → IFS { baslik: ShopOrd, operasyonlar: ShopOrderOperation }.
 * SAF FONKSİYON (server-only DEĞİL, DB/IFS erişmez) — DB'siz unit test edilir. Kaynak hatası →
 * { hata } (kayıt HATA'ya çekilir, IFS'e gidilmez). KURAL: operasyonlardan biri bile hatalıysa
 * TÜM iş emri hata (kısmi yazma YOK). Zorunlu başlık alan seti HUBTEST-J1 create'inde doğrulandı.
 */

/** Mapper'ın kullandığı Syteline iş emri başlık alanları (server-only is-emri.ts'ten decouple). */
export interface IsEmriBaslikGirdi {
  job: string | null
  item: string | null
  qty_released: number | null
  job_date: Date | string | null
  description?: string | null
}

/** Mapper'ın kullandığı Syteline operasyon alanları. */
export interface IsEmriOperasyonGirdi {
  oper_num: number | null
  wc: string | null
  RESID: string | null
  pcs_per_mch_hr: number | null
  setup_hrs?: number | null
  qty_received?: number | null
}

/**
 * Hub eşleme tabloları (SyteEsleme, entity=IS_EMRI). Boş/eksik ise mapper sabit davranışa düşer.
 *  - tezgah: Syteline RESID (kaynak) → IFS ResourceId (WC haritasında bunun karşılığı aranır).
 */
export interface IsEmriEslemeHaritalari {
  tezgah?: Map<string, string>
}

export interface IsEmriReferans {
  contract: string
  /** IFS ResourceId → WorkCenterNo (WorkCenterHandling.svc/Reference_WorkCenterResource'tan). */
  kaynakHaritasi: Map<string, string>
  esleme?: IsEmriEslemeHaritalari
}

export interface IsEmriBaslikCikti {
  OrderNo: string
  ReleaseNo: string
  SequenceNo: string
  Contract: string
  PartNo: string
  OrgQtyDue: number
  RevisedQtyDue: number
  DemandCode: 'InventOrder'
  OrderCode: 'Manufacturing'
  PartOwnership: 'CompanyOwned'
  RevisedStartDate: string
  OrgStartDate: string
  EarliestStartDate: string
  RevisedDueDate: string
  OrgDueDate: string
  NeedDate: string
}

export interface IsEmriOperasyonCikti {
  OrderNo: string
  ReleaseNo: string
  SequenceNo: string
  Contract: string
  PartNo: string
  OperationNo: number
  /** IFS'te zorunlu (ORA-20124 NULLVALUE). Syteline jobroute'ta açıklama yok → "Op <no> <wc>" (≤35 karakter). */
  OperationDescription: string
  WorkCenterNo: string
  PreferredResourceId: string
  MachRunFactor: number
  RunTimeCode: 'UnitsHour'
  OperationQty: number
  // IFS ShopOrderOperation zorunlu süre alanları (ORA-20124 NULLVALUE, saat). Syteline'da karşılığı olan
  // yalnız hazırlık (setup_hrs); diğerleri 0. İşçilik = 0 (IPRO makine bazlı), ekip 1.
  QueueTime: number
  MoveTime: number
  MachSetupTime: number
  LaborSetupTime: number
  LaborRunFactor: number
  CrewSize: number
  SetupCrewSize: number
}

/** IFS'in zorunlu tuttuğu operasyon alanlarını tamamlar (eski saklı payload'lar dahil). */
export function operasyonVarsayilanlari<T extends Partial<IsEmriOperasyonCikti> & { OperationNo: number; WorkCenterNo: string }>(
  o: T,
): T & Pick<IsEmriOperasyonCikti, 'OperationDescription' | 'QueueTime' | 'MoveTime' | 'MachSetupTime' | 'LaborSetupTime' | 'LaborRunFactor' | 'CrewSize' | 'SetupCrewSize'> {
  return {
    ...o,
    OperationDescription: o.OperationDescription || `Op ${o.OperationNo} ${o.WorkCenterNo}`.slice(0, 35),
    QueueTime: o.QueueTime ?? 0,
    MoveTime: o.MoveTime ?? 0,
    MachSetupTime: o.MachSetupTime ?? 0,
    LaborSetupTime: o.LaborSetupTime ?? 0,
    LaborRunFactor: o.LaborRunFactor ?? 0,
    CrewSize: o.CrewSize ?? 1,
    SetupCrewSize: o.SetupCrewSize ?? 1,
  }
}

export type IsEmriMapSonuc =
  | { baslik: IsEmriBaslikCikti; operasyonlar: IsEmriOperasyonCikti[]; hash: string }
  | { hata: string }

/** job_date → IFS ISO datetime (UTC). Date | 'YYYY-MM-DD' | ISO string kabul eder. */
function isoTarih(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v)
  return d.toISOString()
}

export function isEmriMapla(
  baslik: IsEmriBaslikGirdi,
  operasyonlar: IsEmriOperasyonGirdi[],
  ref: IsEmriReferans,
): IsEmriMapSonuc {
  const orderNo = (baslik.job ?? '').trim()
  if (!orderNo) return { hata: 'job (OrderNo) boş' }

  const partNo = (baslik.item ?? '').trim()
  if (!partNo) return { hata: `malzeme (PartNo) boş: ${orderNo}` }

  const qty = Number(baslik.qty_released)
  if (!Number.isFinite(qty) || qty <= 0) return { hata: `iş emri miktarı geçersiz: ${orderNo}` }

  if (baslik.job_date == null) return { hata: `iş emri tarihi boş: ${orderNo}` }
  const tarih = isoTarih(baslik.job_date)

  if (!operasyonlar || operasyonlar.length === 0) return { hata: `operasyon yok: ${orderNo}` }

  const esleme = ref.esleme ?? {}
  const baslikCikti: IsEmriBaslikCikti = {
    OrderNo: orderNo,
    ReleaseNo: '*',
    SequenceNo: '*',
    Contract: ref.contract,
    PartNo: partNo,
    OrgQtyDue: qty,
    RevisedQtyDue: qty,
    DemandCode: 'InventOrder',
    OrderCode: 'Manufacturing',
    PartOwnership: 'CompanyOwned',
    // Tutarlı tarih seti — START_AFTER_NEW_NEED yememek için hepsi job_date.
    RevisedStartDate: tarih,
    OrgStartDate: tarih,
    EarliestStartDate: tarih,
    RevisedDueDate: tarih,
    OrgDueDate: tarih,
    NeedDate: tarih,
  }

  const opCikti: IsEmriOperasyonCikti[] = []
  for (const op of operasyonlar) {
    const operNo = Number(op.oper_num)
    if (!Number.isFinite(operNo)) return { hata: `operasyon no geçersiz: ${orderNo}` }

    const residHam = (op.RESID ?? '').trim()
    if (!residHam) return { hata: `kaynak yok: ${(op.wc ?? '').trim() || '?'}/${operNo}` }
    // TEZGAH eşlemesi: Syteline RESID → IFS ResourceId override (yoksa aynen).
    const resid = esleme.tezgah?.get(residHam) ?? residHam

    const wc = ref.kaynakHaritasi.get(resid)
    if (!wc) return { hata: `tezgah IFS'te tanımlı değil: ${resid}` }

    const cevrim = Number(op.pcs_per_mch_hr)
    if (!Number.isFinite(cevrim) || cevrim <= 0) return { hata: `çevrim yok: ${resid}/${operNo}` }

    opCikti.push({
      OrderNo: orderNo,
      ReleaseNo: '*',
      SequenceNo: '*',
      Contract: ref.contract,
      PartNo: partNo,
      OperationNo: operNo,
      OperationDescription: `Op ${operNo} ${(op.wc ?? '').trim() || wc}`.slice(0, 35),
      WorkCenterNo: wc,
      PreferredResourceId: resid,
      MachRunFactor: cevrim,
      RunTimeCode: 'UnitsHour',
      OperationQty: qty,
      QueueTime: 0,
      MoveTime: 0,
      MachSetupTime: Number.isFinite(Number(op.setup_hrs)) && Number(op.setup_hrs) > 0 ? Number(op.setup_hrs) : 0,
      LaborSetupTime: 0,
      LaborRunFactor: 0,
      CrewSize: 1,
      SetupCrewSize: 1,
    })
  }

  const hash = createHash('sha256').update(JSON.stringify({ baslik: baslikCikti, operasyonlar: opCikti })).digest('hex')
  return { baslik: baslikCikti, operasyonlar: opCikti, hash }
}
