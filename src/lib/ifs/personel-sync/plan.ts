/**
 * Hub → IFS personel senkronu — PLANLAYICI (faz 1). Yazmaz.
 *
 * Hub'ı ve IFS'in güncel durumunu okur, varlık sırasıyla ne yapılacağını hesaplar:
 *   AYRILMA_NEDENI (SGK kodları) → CALISAN_STATUSU (AYRILDI) → ORG (üstten alta) → POZISYON → LABOR_CLASS → EMPLOYEE (önce PASIF) → SF_EMPLOYEE → SF_SITE
 * Her kalem CREATE | UPDATE | PASIF | NOOP | ATLA. ATLA'nın sebebi her zaman yazılır
 * (koltuksuz kişi, kod sınırı, yeniden-aktif, labor class yok…). Uygulayıcı
 * (uygula.ts) bu planı sırayla yürütür; dryRun = plan çıktısının kendisi.
 */
import type { prisma as PrismaTip } from '@/lib/prisma'
import {
  EMPLOYEE_ATAMA_ALANLARI, EMPLOYEE_PASIF_DESTEKLI, EMPLOYEE_PATCH_ALANLARI, EMPLOYEE_SABITLERI, IFS_ACIK_UCLU_TARIH, IFS_LABOR_CLASS_SABITLERI, IFS_ORG_TERM, IFS_STRUCTURE, IFS_STRUCT_BU_ID, IFS_ORG_VALID_FROM, IFS_ORG_VALID_TO, KAYNAKHANE_BOLUM, KURUL_KOD_ONEKI,
  KodTuretmeHatasi, adSoyadAyir, baslikHali, bolumShopFloorMu, ifsCinsiyet, ifsTarih, kaynakTuru, kisiShopFloorMu,
  laborClassAciklamasi, laborClassKodu, orgKodu, posKodu, sicilSenkronKapsamindaMi, type KaynakTuru,
} from './kodlar'
import {
  IfsSyncHatasi, listEmployeeStatuses, listEmployees, listLaborClasses, listLeavingCauses, listOrgs, listPositions, listSfEmployees, listSfSites,
  type IfsEmployee, type IfsEmployeeStatus, type IfsLaborClass, type IfsLeavingCause, type IfsOrg, type IfsPos, type IfsSfEmployee, type IfsSfSite,
} from './ifs-api'
import { SGK_CIKIS_KODLARI, sgkBaslatan, sgkCikisKoduGecerliMi } from '@/lib/sgk-cikis-kodlari'
import { IFS_CALISAN_STATULERI } from './kodlar'

export type VarlikTipi = 'AYRILMA_NEDENI' | 'CALISAN_STATUSU' | 'ORG' | 'POZISYON' | 'LABOR_CLASS' | 'EMPLOYEE' | 'SF_EMPLOYEE' | 'SF_SITE'
export type Islem = 'CREATE' | 'UPDATE' | 'PASIF' | 'NOOP' | 'ATLA'
export const VARLIK_SIRASI: VarlikTipi[] = ['AYRILMA_NEDENI', 'CALISAN_STATUSU', 'ORG', 'POZISYON', 'LABOR_CLASS', 'EMPLOYEE', 'SF_EMPLOYEE', 'SF_SITE']

export interface PlanKalemi {
  varlik: VarlikTipi
  hubId: string
  ifsAnahtar: string
  /** İnsan gözü için: sicil/ad, bölüm adı, koltuk adı. */
  etiket: string
  islem: Islem
  /** CREATE/UPDATE/PASIF gövdesi (PATCH'te yalnız değişen alanlar). */
  govde?: Record<string, unknown>
  /** UPDATE'te alan bazında eski→yeni. */
  fark?: Record<string, { eski: unknown; yeni: unknown }>
  etag?: string | null
  sebep?: string
}

export interface SenkronPlani {
  olusturuldu: string
  kapsam: 'TAM' | { siciller: string[] }
  kalemler: PlanKalemi[]
  ozet: Record<VarlikTipi, Record<Islem, number>>
  uyarilar: string[]
}

export interface PlanSecenekleri {
  /** Verilirse yalnız bu siciller ve onların bağımlı org/pozisyon/labor class'ları planlanır (pilot). */
  siciller?: string[]
  /** Kuyruktan gelen hedefler (cron): yalnız bu Hub id'lerine bakılır. Boş/undefined = tam tarama. */
  hedefler?: Partial<Record<VarlikTipi, Set<string>>>
}

type Db = typeof PrismaTip

interface HubOrg { id: string; code: string; name: string; parentId: string | null; ifsKod: string; supIfsKod: string }
interface HubPos { id: string; code: string; name: string; ifsKod: string }
interface HubLc { anahtar: string; bolumOrgUnitId: string; bolumAdi: string; kod: string; aciklama: string; tur?: KaynakTuru }
interface HubKisi {
  id: string; sicilNo: string; adSoyad: string; aktif: boolean; yakaRengi: string; cinsiyet: string | null; gorev: string; bolum: string
  iseGirisTarihi: Date; cikisTarihi: Date | null
  /** Son istihdam döneminin SGK çıkış kodu (EmploymentPeriod.exitCode) — PASIF kaleminde LeavingCauseId. */
  cikisKodu: string | null
  departmentOrgUnitId: string | null; koltuk: HubPos | null; koltukSayisi: number
}

const norm = (v: unknown) => (v === undefined || v === '' ? null : v)
const bosOzet = (): Record<Islem, number> => ({ CREATE: 0, UPDATE: 0, PASIF: 0, NOOP: 0, ATLA: 0 })

function fark(mevcut: Record<string, unknown>, hedef: Record<string, unknown>) {
  const f: Record<string, { eski: unknown; yeni: unknown }> = {}
  for (const [k, yeni] of Object.entries(hedef)) {
    const eski = norm(mevcut[k])
    if (JSON.stringify(eski) !== JSON.stringify(norm(yeni))) f[k] = { eski, yeni }
  }
  return f
}

export async function planla(db: Db, sec: PlanSecenekleri = {}): Promise<SenkronPlani> {
  const uyarilar: string[] = []
  const kalemler: PlanKalemi[] = []

  // ── Hub okuma ────────────────────────────────────────────────────────────
  const [orgUnits, deptDefs, personel] = await Promise.all([
    db.orgUnit.findMany({ where: { unitType: { in: ['DEPARTMENT', 'POSITION'] } }, select: { id: true, code: true, name: true, parentId: true, unitType: true } }),
    db.departmentDefinition.findMany({ where: { isActive: true }, select: { id: true, name: true, orgUnitId: true } }),
    db.personnel.findMany({
      where: { sicilNo: { startsWith: 'ILR-' }, ...(sec.siciller ? { sicilNo: { in: sec.siciller } } : {}) },
      select: {
        id: true, sicilNo: true, adSoyad: true, aktif: true, yakaRengi: true, cinsiyet: true, gorev: true, bolum: true, iseGirisTarihi: true,
        department: { select: { orgUnitId: true, name: true } },
        employmentPeriods: { select: { girisTarihi: true, cikisTarihi: true, exitCode: true }, orderBy: { girisTarihi: 'desc' }, take: 1 },
      },
    }),
  ])
  // OrgEmployee.personnelId FK'sız çıplak String (Personnel'de ters ilişki yok) — ayrı sorgu.
  const koltukKayitlari = await db.orgEmployee.findMany({
    where: { personnelId: { in: personel.map((p) => p.id) }, isActive: true },
    select: { personnelId: true, createdAt: true, orgUnit: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const koltukByKisi = new Map<string, typeof koltukKayitlari>()
  for (const k of koltukKayitlari) { if (!k.personnelId) continue; const l = koltukByKisi.get(k.personnelId) ?? []; l.push(k); koltukByKisi.set(k.personnelId, l) }

  const unitById = new Map(orgUnits.map((u) => [u.id, u]))
  const kokKod = 'ORG-TF'
  const deptUnits = orgUnits.filter((u) => u.unitType === 'DEPARTMENT' && !u.code.startsWith(KURUL_KOD_ONEKI) && u.code !== kokKod)
  // Hub şemasında bölüm kutusunun üstü çoğunlukla bir KOLTUK (müdür pozisyonu), onun üstü
  // müdürlük bölümü. Org hiyerarşisi için en yakın DEPARTMENT atası aranır (kök/kurul hariç).
  const ustBolumId = (unitId: string | null): string | null => {
    let pid = unitId
    while (pid) {
      const u = unitById.get(pid); if (!u) return null
      if (u.unitType === 'DEPARTMENT') return u.code === kokKod || u.code.startsWith(KURUL_KOD_ONEKI) ? null : u.id
      pid = u.parentId
    }
    return null
  }
  const hubOrgs = new Map<string, HubOrg>()
  for (const u of deptUnits) {
    try {
      const ustId = ustBolumId(u.parentId)
      const ust = ustId ? unitById.get(ustId) : null
      hubOrgs.set(u.id, { id: u.id, code: u.code, name: u.name, parentId: ustId, ifsKod: orgKodu(u.code), supIfsKod: ust ? orgKodu(ust.code) : '*' })
    } catch (e) { uyarilar.push(`ORG ${u.code}: ${(e as Error).message}`) }
  }
  const hubPosMap = new Map<string, HubPos>()
  for (const u of orgUnits.filter((x) => x.unitType === 'POSITION' && !x.code.startsWith(KURUL_KOD_ONEKI))) {
    try { hubPosMap.set(u.id, { id: u.id, code: u.code, name: u.name, ifsKod: posKodu(u.code) }) } catch (e) { uyarilar.push(`POZISYON ${u.code}: ${(e as Error).message}`) }
  }
  const deptByName = new Map(deptDefs.map((d) => [d.name, d]))

  // Kişiler
  const kisiler: HubKisi[] = []
  for (const p of personel) {
    if (!sicilSenkronKapsamindaMi(p.sicilNo)) continue
    const koltuklar = (koltukByKisi.get(p.id) ?? []).filter((k) => !k.orgUnit.code.startsWith(KURUL_KOD_ONEKI))
    const koltuk = koltuklar[0] ? hubPosMap.get(koltuklar[0].orgUnit.id) ?? null : null
    const deptOrgUnitId = p.department?.orgUnitId ?? deptByName.get(p.bolum)?.orgUnitId ?? null
    const donem = p.employmentPeriods[0]
    kisiler.push({
      id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, aktif: p.aktif, yakaRengi: p.yakaRengi, cinsiyet: p.cinsiyet, gorev: p.gorev, bolum: p.bolum,
      iseGirisTarihi: p.iseGirisTarihi, cikisTarihi: donem?.cikisTarihi ?? null, cikisKodu: donem?.exitCode?.trim() || null,
      departmentOrgUnitId: deptOrgUnitId, koltuk, koltukSayisi: koltuklar.length,
    })
  }

  // Üretim bölümleri (Karar 2): aktif MAVI/GRI personeli olan bölüm, SHOP_FLOOR_DISI hariç.
  // Tam tarama gerektirir — pilot kapsamında da tüm aktif personelden hesaplanır ki sınıf listesi kapsama göre değişmesin.
  const maviGriBolumler = new Set(
    (sec.siciller
      ? await db.personnel.findMany({ where: { aktif: true, yakaRengi: { in: ['MAVI', 'GRI'] } }, select: { bolum: true }, distinct: ['bolum'] })
      : personel.filter((p) => p.aktif && ['MAVI', 'GRI'].includes(p.yakaRengi))
    ).map((p) => p.bolum),
  )
  const shopFloorBolumler = new Set<string>()
  for (const d of deptDefs) if (bolumShopFloorMu(d.name, maviGriBolumler.has(d.name))) shopFloorBolumler.add(d.name)
  const hubLcs = new Map<string, HubLc>()
  for (const ad of shopFloorBolumler) {
    const d = deptByName.get(ad)
    const u = d?.orgUnitId ? unitById.get(d.orgUnitId) : null
    if (!u) { uyarilar.push(`LABOR_CLASS ${ad}: bölümün şema kutusu (orgUnitId) yok — sınıf üretilemez`); continue }
    const turler: (KaynakTuru | undefined)[] = ad === KAYNAKHANE_BOLUM ? ['R', 'M'] : [undefined]
    for (const tur of turler) {
      try {
        const kod = laborClassKodu(u.code, tur ? { kaynakTuru: tur } : undefined)
        hubLcs.set(kod, { anahtar: kod, bolumOrgUnitId: u.id, bolumAdi: ad, kod, aciklama: laborClassAciklamasi(ad, tur), tur })
      } catch (e) { uyarilar.push(`LABOR_CLASS ${ad}: ${(e as Error).message}`) }
    }
  }
  const kisiLaborClass = (k: HubKisi): string | null => {
    if (!shopFloorBolumler.has(k.bolum) || !k.departmentOrgUnitId) return null
    const u = unitById.get(k.departmentOrgUnitId); if (!u) return null
    try { return laborClassKodu(u.code, k.bolum === KAYNAKHANE_BOLUM ? { kaynakTuru: kaynakTuru(k.gorev) } : undefined) } catch { return null }
  }

  // ── IFS okuma ───────────────────────────────────────────────────────────
  const [ifsOrgs, ifsPos, ifsLcs, ifsEmps, ifsSfEmps, ifsSfSites] = await Promise.all([
    listOrgs(), listPositions(), listLaborClasses(), listEmployees(), listSfEmployees(), listSfSites(),
  ])
  // Ayrılma nedenleri: grant yoksa (403) plan durmaz — kalemler ATLA(GRANT_YOK) olur.
  let ifsAyrilma: IfsLeavingCause[] | null = null
  try { ifsAyrilma = await listLeavingCauses() } catch (e) {
    if (e instanceof IfsSyncHatasi && e.status === 403) uyarilar.push('AYRILMA_NEDENI: ReasonsForLeavingHandling 403 — grant yok, kalemler atlandı')
    else throw e
  }
  const ifsOrgMap = new Map<string, IfsOrg>(ifsOrgs.map((o) => [o.OrgCode, o]))
  const ifsPosMap = new Map<string, IfsPos>(ifsPos.map((p) => [p.PosCode, p]))
  const ifsLcMap = new Map<string, IfsLaborClass>(ifsLcs.map((l) => [l.LaborClassNo, l]))
  const ifsEmpMap = new Map<string, IfsEmployee>(ifsEmps.map((e) => [e.EmpNo, e]))
  const ifsSfeMap = new Map<string, IfsSfEmployee>(ifsSfEmps.map((e) => [e.EmployeeId, e]))
  const ifsSfsMap = new Map<string, IfsSfSite>(ifsSfSites.map((s) => [s.EmployeeId, s]))

  // ── Kapsam daraltma (pilot / kuyruk) ─────────────────────────────────────
  const gerekliOrg = new Set<string>(), gerekliPos = new Set<string>(), gerekliLc = new Set<string>()
  const daralt = !!sec.siciller || !!sec.hedefler
  if (sec.siciller) {
    for (const k of kisiler) {
      let oid = k.departmentOrgUnitId
      while (oid && hubOrgs.has(oid)) { gerekliOrg.add(oid); oid = hubOrgs.get(oid)!.parentId }
      if (k.koltuk) gerekliPos.add(k.koltuk.id)
      const lc = kisiLaborClass(k); if (lc && kisiShopFloorMu(k.yakaRengi, true)) gerekliLc.add(lc)
    }
  }
  if (sec.hedefler) {
    sec.hedefler.ORG?.forEach((id) => gerekliOrg.add(id)); sec.hedefler.POZISYON?.forEach((id) => gerekliPos.add(id)); sec.hedefler.LABOR_CLASS?.forEach((k) => gerekliLc.add(k))
  }
  const orgDahil = (id: string) => !daralt || gerekliOrg.has(id)
  const posDahil = (id: string) => !daralt || gerekliPos.has(id)
  const lcDahil = (kod: string) => !daralt || gerekliLc.has(kod)
  const kisiDahil = (k: HubKisi) => !sec.hedefler || sec.hedefler.EMPLOYEE?.has(k.id) || sec.hedefler.SF_EMPLOYEE?.has(k.id) || sec.hedefler.SF_SITE?.has(k.id) || !!sec.siciller

  // ── AYRILMA_NEDENI: SGK 47 kodu → IFS LeavingCause (şirketten bağımsız temel veri; kapsamdan bağımsız hep planlanır) ──
  // LeavingCauseId = kodun sayısal hâli (01 → 1); LeavingCauseType = "02 Deneme süreli…" (≤100); LeavingInitiatedBy işçi/işveren.
  if (!sec.hedefler || sec.hedefler.AYRILMA_NEDENI) {
    const ifsAyrilmaMap = new Map<number, IfsLeavingCause>((ifsAyrilma ?? []).map((a) => [Number(a.LeavingCauseId), a]))
    for (const k of SGK_CIKIS_KODLARI) {
      const id = Number(k.kod)
      const hedef = { LeavingCauseType: `${k.kod} ${k.aciklama}`.slice(0, 100), LeavingInitiatedBy: sgkBaslatan(k.kod) }
      const etiket = `SGK ${k.kod} · ${k.aciklama.slice(0, 60)}`
      if (ifsAyrilma === null) { kalemler.push({ varlik: 'AYRILMA_NEDENI', hubId: k.kod, ifsAnahtar: String(id), etiket, islem: 'ATLA', sebep: 'GRANT_YOK: ReasonsForLeavingHandling 403' }); continue }
      const m = ifsAyrilmaMap.get(id)
      if (!m) kalemler.push({ varlik: 'AYRILMA_NEDENI', hubId: k.kod, ifsAnahtar: String(id), etiket, islem: 'CREATE', govde: { LeavingCauseId: id, ...hedef } })
      else {
        const f = fark(m as unknown as Record<string, unknown>, hedef)
        kalemler.push({ varlik: 'AYRILMA_NEDENI', hubId: k.kod, ifsAnahtar: String(id), etiket, islem: Object.keys(f).length ? 'UPDATE' : 'NOOP', fark: f, govde: Object.fromEntries(Object.entries(f).map(([a, v]) => [a, v.yeni])), etag: m['@odata.etag'] ?? null })
      }
    }
  }

  // ── CALISAN_STATUSU: AYRILDI (okuma LOV'dan; yazma EmployeeStatusHandling, grant bekliyor olabilir) ──
  if (!sec.hedefler || sec.hedefler.CALISAN_STATUSU) {
    let statuler: IfsEmployeeStatus[] = []
    try { statuler = await listEmployeeStatuses() } catch (e) { uyarilar.push(`CALISAN_STATUSU okunamadı: ${(e as Error).message}`) }
    const enBuyukSeq = statuler.reduce((m, s) => Math.max(m, Number(s.SeqNo) || 0), 0)
    let sonrakiSeq = enBuyukSeq + 1
    for (const st of IFS_CALISAN_STATULERI) {
      const m = statuler.find((s) => s.EmployeeStatus === st.EmployeeStatus)
      const hedef = { Active: st.Active, Preliminary: st.Preliminary, StatusObsolete: st.StatusObsolete }
      const etiket = `Statü ${st.EmployeeStatus} (aktif=${st.Active})`
      if (!m) kalemler.push({ varlik: 'CALISAN_STATUSU', hubId: st.EmployeeStatus, ifsAnahtar: String(sonrakiSeq++), etiket, islem: 'CREATE', govde: { SeqNo: sonrakiSeq - 1, EmployeeStatus: st.EmployeeStatus, ...hedef, BusPlanInclude: st.BusPlanInclude } })
      else {
        const f = fark(m as unknown as Record<string, unknown>, hedef)
        kalemler.push({ varlik: 'CALISAN_STATUSU', hubId: st.EmployeeStatus, ifsAnahtar: String(m.SeqNo), etiket, islem: Object.keys(f).length ? 'UPDATE' : 'NOOP', fark: f, govde: Object.fromEntries(Object.entries(f).map(([a, v]) => [a, v.yeni])) })
      }
    }
  }

  // ── ORG: üstten alta (derinlik sırası) ──────────────────────────────────
  const derinlik = (o: HubOrg): number => { let d = 0, p = o.parentId; while (p && hubOrgs.has(p)) { d++; p = hubOrgs.get(p)!.parentId } return d }
  for (const o of [...hubOrgs.values()].filter((o) => orgDahil(o.id)).sort((a, b) => derinlik(a) - derinlik(b))) {
    const hedef = { OrgName: o.name.slice(0, 40), SupOrgCode: o.supIfsKod }
    const m = ifsOrgMap.get(o.ifsKod)
    if (!m) kalemler.push({ varlik: 'ORG', hubId: o.id, ifsAnahtar: o.ifsKod, etiket: o.name, islem: 'CREATE', govde: { OrgCode: o.ifsKod, ...hedef, OrgTermId: o.supIfsKod === '*' ? IFS_ORG_TERM.UST : IFS_ORG_TERM.ALT, ExclusiveReg: false, ExcludeFromOrgChart: false, ValidFrom: IFS_ORG_VALID_FROM, ValidTo: IFS_ORG_VALID_TO } })
    else {
      const f = fark(m as unknown as Record<string, unknown>, hedef)
      kalemler.push({ varlik: 'ORG', hubId: o.id, ifsAnahtar: o.ifsKod, etiket: o.name, islem: Object.keys(f).length ? 'UPDATE' : 'NOOP', fark: f, govde: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.yeni])), etag: m['@odata.etag'] ?? null })
    }
  }

  // ── POZISYON: düz, SupPosCode '*' (Karar 3) ─────────────────────────────
  for (const p of [...hubPosMap.values()].filter((p) => posDahil(p.id))) {
    const hedef = { PositionTitle: p.name.slice(0, 60), SupPosCode: '*' }
    const m = ifsPosMap.get(p.ifsKod)
    if (!m) kalemler.push({ varlik: 'POZISYON', hubId: p.id, ifsAnahtar: p.ifsKod, etiket: p.name, islem: 'CREATE', govde: { PosCode: p.ifsKod, ...hedef, StructureId: IFS_STRUCTURE, StructBuId: IFS_STRUCT_BU_ID, AssignedProtected: false, DefaultAccessExtension: false, ExportEmployees: false, ExcludeFromExport: false, ValidFrom: IFS_ORG_VALID_FROM, ValidTo: IFS_ACIK_UCLU_TARIH } })
    else {
      const f = fark(m as unknown as Record<string, unknown>, { PositionTitle: hedef.PositionTitle })
      kalemler.push({ varlik: 'POZISYON', hubId: p.id, ifsAnahtar: p.ifsKod, etiket: p.name, islem: Object.keys(f).length ? 'UPDATE' : 'NOOP', fark: f, govde: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.yeni])), etag: m['@odata.etag'] ?? null })
    }
  }

  // ── LABOR_CLASS ─────────────────────────────────────────────────────────
  for (const lc of [...hubLcs.values()].filter((l) => lcDahil(l.kod))) {
    const m = ifsLcMap.get(lc.kod)
    if (!m) kalemler.push({ varlik: 'LABOR_CLASS', hubId: lc.kod, ifsAnahtar: lc.kod, etiket: lc.aciklama, islem: 'CREATE', govde: { LaborClassNo: lc.kod, LaborClassDescription: lc.aciklama, ...IFS_LABOR_CLASS_SABITLERI } })
    else {
      const f = fark(m as unknown as Record<string, unknown>, { LaborClassDescription: lc.aciklama })
      kalemler.push({ varlik: 'LABOR_CLASS', hubId: lc.kod, ifsAnahtar: lc.kod, etiket: lc.aciklama, islem: Object.keys(f).length ? 'UPDATE' : 'NOOP', fark: f, govde: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.yeni])), etag: m['@odata.etag'] ?? null })
    }
  }

  // ── EMPLOYEE: önce pasifleştirmeler ─────────────────────────────────────
  const bugun = new Date().toISOString().slice(0, 10)
  const empKalemleri: PlanKalemi[] = [], sfeKalemleri: PlanKalemi[] = [], sfsKalemleri: PlanKalemi[] = []
  for (const k of kisiler.filter(kisiDahil)) {
    const m = ifsEmpMap.get(k.sicilNo)
    const etiket = `${k.sicilNo} ${baslikHali(k.adSoyad)} · ${k.bolum} · ${k.yakaRengi}`
    if (!k.aktif) {
      if (!m) continue // IFS'te yok, pasif — hiçbir şey yapma
      // IFS'te istihdam açık mı? (CompanyPersons.EmploymentEndDate = EmpEmployedTimes.DateOfLeaving görünümü; 2099-12-31 = açık uçlu)
      const acik = !m.EmploymentEndDate || m.EmploymentEndDate >= IFS_ACIK_UCLU_TARIH || m.EmploymentEndDate > bugun
      if (!acik) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'NOOP', sebep: `zaten kapalı (${m.EmploymentEndDate})` })
      else if (!EMPLOYEE_PASIF_DESTEKLI) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: 'IFS_PASIF_YOLU_KAPALI: EMPLOYEE_PASIF_DESTEKLI=false' })
      else {
        // PASIF kalemi: TerminateEmploymentHandling asistanı (terminate.ts). Çıkış tarihi + SGK kodu → LeavingCauseId ŞART.
        const bitis = ifsTarih(k.cikisTarihi)
        // exitCode: yeni kayıtlarda '03', eski kayıtlarda '03 belirsiz…' / '14- Emeklilik…' / 'FESİH'.
        // Baştaki 1-2 hane SGK listesindeyse kod odur; kodsuz metin TAHMİN EDİLMEZ → ATLA (İK Hub'da düzeltir).
        const kodEsleme = k.cikisKodu ? /^\s*(\d{1,2})(?!\d)/.exec(k.cikisKodu) : null
        const kodStr = kodEsleme ? kodEsleme[1].padStart(2, '0') : null
        const kodNo = kodStr && sgkCikisKoduGecerliMi(kodStr) ? Number(kodStr) : null
        const neden = kodNo !== null ? (ifsAyrilma ?? []).find((a) => Number(a.LeavingCauseId) === kodNo) : undefined
        if (!bitis) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: 'PASIF_EKSIK: Hub pasif ama istihdam döneminde çıkış tarihi yok' })
        else if (!k.cikisKodu) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: `PASIF_EKSIK: Hub pasif (çıkış ${bitis}) ama SGK çıkış kodu yok` })
        else if (kodNo === null) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: `PASIF_EKSIK: çıkış kodu '${k.cikisKodu}' SGK listesine çözülemedi (Hub'da kod seçilmeli)` })
        else if (ifsAyrilma === null) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: 'GRANT_YOK: ReasonsForLeavingHandling 403 — LeavingCauseId doğrulanamadı' })
        else if (!neden) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: `PASIF_EKSIK: SGK ${k.cikisKodu} IFS LeavingCause listesinde yok (AYRILMA_NEDENI kalemi önce yazılmalı)` })
        else empKalemleri.push({
          varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'PASIF',
          govde: { EmploymentEndDate: bitis, LeavingCauseId: kodNo, LeavingCauseType: neden.LeavingCauseType ?? kodStr },
          etag: m['@odata.etag'] ?? null, sebep: `Hub pasif (çıkış ${bitis}, SGK ${kodStr}) → TerminateEmployment asistanı`,
        })
      }
      const s = ifsSfsMap.get(k.sicilNo)
      if (s && s.Objstate === 'Active') sfsKalemleri.push({ varlik: 'SF_SITE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'PASIF', govde: { Objstate: 'Blocked' }, etag: s['@odata.etag'] ?? null, sebep: 'Hub pasif → SetBlocked' })
      continue
    }
    // Aktif kişi
    if (m && m.EmploymentEndDate && m.EmploymentEndDate < bugun) {
      empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: `YENIDEN_AKTIF: IFS'te istihdam ${m.EmploymentEndDate}'te kapanmış — faz 1'de elle (Karar 4)` })
      continue
    }
    if (!k.departmentOrgUnitId || !hubOrgs.has(k.departmentOrgUnitId)) { empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: `bölümün şema kutusu yok (${k.bolum})` }); continue }
    if (!k.koltuk) { empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: k.koltukSayisi === 0 ? 'KOLTUKSUZ: şemada ana koltuğu yok' : 'koltuk kodu türetilemedi' }); continue }
    const org = hubOrgs.get(k.departmentOrgUnitId)!
    const { Fname, Lname } = adSoyadAyir(k.adSoyad)
    const gorunenAd = baslikHali(k.adSoyad)
    const giris = ifsTarih(k.iseGirisTarihi)!
    const cinsiyet = ifsCinsiyet(k.cinsiyet)
    const hedef: Record<string, unknown> = {
      Fname, Lname, InternalDisplayName: gorunenAd,
      OrgCode: org.ifsKod, PosCode: k.koltuk.ifsKod,
      EmploymentDate: giris, MasterEmployment: EMPLOYEE_SABITLERI.MasterEmployment,
      ...(cinsiyet ? { Gender: cinsiyet } : {}),
      // FreeField1/2 (yaka, bölüm adı) CREATE gövdesinde gönderilir ama pilot 16.09: IFS bu
      // projeksiyonda KALICI YAZMIYOR (round-trip null). Fark hesabına alınmaz — yoksa her
      // kişi sonsuza dek UPDATE görünür.
    }
    const sebepNot = k.koltukSayisi > 1 ? `çok koltuklu (${k.koltukSayisi}) → en eski koltuk ${k.koltuk.code}` : undefined
    if (!m) {
      empKalemleri.push({
        varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'CREATE', sebep: sebepNot,
        govde: {
          EmpNo: k.sicilNo, PersonId: k.sicilNo, Fname, Lname, InternalDisplayName: gorunenAd, ExternalDisplayName: gorunenAd, EmployeeName: gorunenAd,
          ValidFrom: giris, ValidTo: IFS_ACIK_UCLU_TARIH, EmploymentDate: giris, EmploymentEndDate: IFS_ACIK_UCLU_TARIH,
          EmpOrgCode: org.ifsKod, EmpPosCode: k.koltuk.ifsKod, ...EMPLOYEE_SABITLERI,
          ...(cinsiyet ? { Gender: cinsiyet } : {}), FreeField1: k.yakaRengi, FreeField2: k.bolum,
        },
      })
    } else {
      const f = fark(m as unknown as Record<string, unknown>, hedef)
      // Yalnız PersonnelFileHandling'in kabul ettiği alanlar PATCH'lenir; kalan farklar
      // (ad, cinsiyet, ORG/POZİSYON ATAMASI) bu istemciye açık projeksiyonlarla yazılamıyor → sebepte listelenir.
      const yazilabilir = Object.fromEntries(Object.entries(f).filter(([a]) => EMPLOYEE_PATCH_ALANLARI.includes(a)))
      const atamaDegisti = Object.keys(f).some((a) => EMPLOYEE_ATAMA_ALANLARI.includes(a))
      const yazilamaz = Object.keys(f).filter((a) => !EMPLOYEE_PATCH_ALANLARI.includes(a) && !EMPLOYEE_ATAMA_ALANLARI.includes(a))
      const govde: Record<string, unknown> = Object.fromEntries(Object.entries(yazilabilir).map(([a, v]) => [a, v.yeni]))
      // Atama değişimi: sihirbaz (org+pos birlikte; ValidFromNew = bugün, eski atama dün kapanır).
      if (atamaDegisti) govde._atama = { OrgCode: org.ifsKod, PosCode: k.koltuk.ifsKod, ValidFrom: bugun }
      const yazilamazNotu = yazilamaz.length ? `IFS_AD_GUNCELLEME_YOK: ${yazilamaz.join(',')} farklı ama açık projeksiyonlarda güncellenemiyor` : undefined
      if (Object.keys(yazilabilir).length || atamaDegisti) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'UPDATE', fark: f, govde, etag: m['@odata.etag'] ?? null, sebep: [sebepNot, yazilamazNotu].filter(Boolean).join(' · ') || undefined })
      else if (yazilamaz.length) empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', fark: f, sebep: yazilamazNotu })
      else empKalemleri.push({ varlik: 'EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'NOOP', fark: f, sebep: sebepNot })
    }
    // Shop-floor (Karar 2)
    const bolumSf = shopFloorBolumler.has(k.bolum)
    if (!kisiShopFloorMu(k.yakaRengi, bolumSf)) {
      if (['MAVI', 'GRI'].includes(k.yakaRengi)) sfeKalemleri.push({ varlik: 'SF_EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: `SHOP_FLOOR_DISI bölüm (${k.bolum})` })
      // Shop-floor dışı kişinin (beyaz yaka / SHOP_FLOOR_DISI bölüm) IFS'te AKTİF site'ı varsa
      // (eski operatör senkronu kalıntısı) Blocked'a çekilir — Karar 2: beyaz asla shop-floor değil.
      const eskiSite = ifsSfsMap.get(k.sicilNo)
      if (eskiSite && eskiSite.Objstate === 'Active') sfsKalemleri.push({ varlik: 'SF_SITE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'PASIF', govde: { Objstate: 'Blocked' }, etag: eskiSite['@odata.etag'] ?? null, sebep: `shop-floor dışı (${k.yakaRengi} · ${k.bolum}) ama site Active → SetBlocked` })
      continue
    }
    const lc = kisiLaborClass(k)
    if (!ifsSfeMap.has(k.sicilNo)) sfeKalemleri.push({ varlik: 'SF_EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'CREATE', govde: { EmployeeId: k.sicilNo } })
    else sfeKalemleri.push({ varlik: 'SF_EMPLOYEE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'NOOP' })
    if (!lc) { sfsKalemleri.push({ varlik: 'SF_SITE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: 'ATLA', sebep: 'labor class türetilemedi' }); continue }
    const s = ifsSfsMap.get(k.sicilNo)
    const lcVar = ifsLcMap.has(lc) || hubLcs.has(lc) // plan sırasında yaratılacak
    if (!s) sfsKalemleri.push({ varlik: 'SF_SITE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket, islem: lcVar ? 'CREATE' : 'ATLA', govde: { EmployeeId: k.sicilNo, PrimaryLaborClass: lc }, sebep: lcVar ? undefined : `labor class ${lc} IFS'te yok` })
    else {
      const f = fark(s as unknown as Record<string, unknown>, { PrimaryLaborClass: lc })
      const aktifDegil = s.Objstate !== 'Active'
      sfsKalemleri.push({
        varlik: 'SF_SITE', hubId: k.id, ifsAnahtar: k.sicilNo, etiket,
        islem: Object.keys(f).length || aktifDegil ? 'UPDATE' : 'NOOP',
        fark: { ...f, ...(aktifDegil ? { Objstate: { eski: s.Objstate, yeni: 'Active' } } : {}) },
        govde: { ...(Object.keys(f).length ? { PrimaryLaborClass: lc } : {}), ...(aktifDegil ? { Objstate: 'Active' } : {}) },
        etag: s['@odata.etag'] ?? null,
      })
    }
  }
  // Pasifleştirmeler her turda önce (brief).
  const once = (a: PlanKalemi, b: PlanKalemi) => Number(b.islem === 'PASIF') - Number(a.islem === 'PASIF')
  kalemler.push(...empKalemleri.sort(once), ...sfeKalemleri, ...sfsKalemleri.sort(once))

  const ozet = Object.fromEntries(VARLIK_SIRASI.map((v) => [v, bosOzet()])) as SenkronPlani['ozet']
  for (const k of kalemler) ozet[k.varlik][k.islem]++
  return { olusturuldu: new Date().toISOString(), kapsam: sec.siciller ? { siciller: sec.siciller } : 'TAM', kalemler, ozet, uyarilar }
}

export function planOzetiMetni(plan: SenkronPlani): string {
  const satirlar = VARLIK_SIRASI.map((v) => { const o = plan.ozet[v]; return `${v.padEnd(12)} create ${o.CREATE}  update ${o.UPDATE}  pasif ${o.PASIF}  noop ${o.NOOP}  atla ${o.ATLA}` })
  return [`Plan ${plan.olusturuldu} kapsam=${plan.kapsam === 'TAM' ? 'TAM' : plan.kapsam.siciller.join(',')}`, ...satirlar, ...(plan.uyarilar.length ? ['Uyarılar:', ...plan.uyarilar.map((u) => '  ! ' + u)] : [])].join('\n')
}

export { KodTuretmeHatasi }
