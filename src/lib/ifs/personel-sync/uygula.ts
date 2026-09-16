/**
 * Hub → IFS personel senkronu — UYGULAYICI (faz 1).
 * Planı sırayla yürütür: create-then-update, idempotent, ETag'li PATCH, DELETE yok.
 * Her yazım permission_audit_log'a (IFS_PERSONEL_SYNC, targetId = IFS anahtarı) düşer.
 * Bir kalemin hatası diğerlerini durdurmaz; bağımlı katman (SF_SITE) kendi hatasını alır.
 */
import type { prisma as PrismaTip } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { IfsSyncHatasi, atamaDegistir, createEmployee, createEmployeeStatus, createLaborClass, createLeavingCause, createOrg, createPosition, createSfEmployee, createSfSite, patchEmployeeFile, patchEmployeeStatus, patchLaborClass, patchLeavingCause, patchOrg, patchPosition, patchSfSite, sfSiteDurum } from './ifs-api'
import type { KuyrukDeposu } from './kuyruk'
import type { PlanKalemi, SenkronPlani } from './plan'

export interface KalemSonucu extends Pick<PlanKalemi, 'varlik' | 'hubId' | 'ifsAnahtar' | 'etiket' | 'islem' | 'sebep'> {
  durum: 'YAZILDI' | 'HATA' | 'ATLANDI' | 'NOOP' | 'KURU'
  hata?: string
  http?: number
}

export interface UygulamaSonucu {
  dryRun: boolean
  kalemler: KalemSonucu[]
  ozet: { yazildi: number; hata: number; atlandi: number; noop: number }
}

const AUDIT_ACTION = 'IFS_PERSONEL_SYNC'

async function yaz(k: PlanKalemi): Promise<number> {
  const g = k.govde ?? {}
  const etag = k.etag ?? ''
  switch (k.varlik) {
    case 'AYRILMA_NEDENI': return (k.islem === 'CREATE' ? await createLeavingCause(g) : await patchLeavingCause(Number(k.ifsAnahtar), g, etag)).status
    case 'CALISAN_STATUSU': return (k.islem === 'CREATE' ? await createEmployeeStatus(g) : await patchEmployeeStatus(Number(k.ifsAnahtar), g)).status
    case 'ORG': return (k.islem === 'CREATE' ? await createOrg(g) : await patchOrg(k.ifsAnahtar, g, etag)).status
    case 'POZISYON': return (k.islem === 'CREATE' ? await createPosition(g) : await patchPosition(k.ifsAnahtar, g, etag)).status
    case 'LABOR_CLASS': return (k.islem === 'CREATE' ? await createLaborClass(g) : await patchLaborClass(k.ifsAnahtar, g, etag)).status
    // CREATE EmployeesHandling'de; UPDATE PersonnelFileHandling'de (kendi GET→ETag'i ile; CompanyPersons PATCH kabul etmiyor).
    case 'EMPLOYEE': {
      if (k.islem === 'CREATE') return (await createEmployee(g)).status
      // Atama sihirbazı + (varsa) Employee File PATCH.
      const { _atama, ...alanlar } = g as { _atama?: { OrgCode: string; PosCode: string; ValidFrom: string } } & Record<string, unknown>
      let st = 204
      if (_atama) st = (await atamaDegistir(k.ifsAnahtar, _atama.OrgCode, _atama.PosCode, _atama.ValidFrom)).status
      if (Object.keys(alanlar).length) st = (await patchEmployeeFile(k.ifsAnahtar, alanlar)).status
      return st
    }
    case 'SF_EMPLOYEE': return (await createSfEmployee(k.ifsAnahtar)).status
    case 'SF_SITE': {
      if (k.islem === 'CREATE') return (await createSfSite(k.ifsAnahtar, String(g.PrimaryLaborClass))).status
      if (k.islem === 'PASIF') return (await sfSiteDurum(k.ifsAnahtar, 'Blocked')).status
      let st = 204
      if (g.PrimaryLaborClass) st = (await patchSfSite(k.ifsAnahtar, { PrimaryLaborClass: g.PrimaryLaborClass }, etag)).status
      if (g.Objstate === 'Active') st = (await sfSiteDurum(k.ifsAnahtar, 'Active')).status
      return st
    }
  }
}

export async function uygula(
  db: typeof PrismaTip,
  plan: SenkronPlani,
  opts: { dryRun: boolean; kuyruk?: KuyrukDeposu; actorId?: string },
): Promise<UygulamaSonucu> {
  const sonuclar: KalemSonucu[] = []
  const hataliAnahtarlar = new Set<string>() // aynı kişide EMPLOYEE hata aldıysa SF katmanlarını deneme
  const hataliLc = new Set<string>()
  for (const k of plan.kalemler) {
    const kk = { varlikTipi: k.varlik, hubId: k.hubId }
    const temel = { varlik: k.varlik, hubId: k.hubId, ifsAnahtar: k.ifsAnahtar, etiket: k.etiket, islem: k.islem, sebep: k.sebep }
    if (k.islem === 'NOOP') { sonuclar.push({ ...temel, durum: 'NOOP' }); await opts.kuyruk?.sonuc(kk, { durum: 'ISLENDI', islem: 'NOOP', ifsAnahtar: k.ifsAnahtar }); continue }
    if (k.islem === 'ATLA') { sonuclar.push({ ...temel, durum: 'ATLANDI' }); await opts.kuyruk?.sonuc(kk, { durum: 'ATLANDI', islem: 'ATLA', ifsAnahtar: k.ifsAnahtar, hata: k.sebep }); continue }
    // Bu turda yaratılamayan labor class'a bağlı SF_SITE kalemi denenmez (LaborClass.FND_RECORD_NOT_EXIST gürültüsü).
    const lcKodu = k.varlik === 'SF_SITE' ? String(k.govde?.PrimaryLaborClass ?? '') : ''
    if (lcKodu && hataliLc.has(lcKodu)) {
      sonuclar.push({ ...temel, durum: 'ATLANDI', hata: `labor class ${lcKodu} bu turda yaratılamadı` }); await opts.kuyruk?.sonuc(kk, { durum: 'HATA', islem: k.islem, hata: `labor class ${lcKodu} yok` }); continue
    }
    if ((k.varlik === 'SF_EMPLOYEE' || k.varlik === 'SF_SITE') && hataliAnahtarlar.has(k.ifsAnahtar)) {
      sonuclar.push({ ...temel, durum: 'ATLANDI', hata: 'üst katman (EMPLOYEE) hatalı' }); await opts.kuyruk?.sonuc(kk, { durum: 'HATA', islem: k.islem, hata: 'üst katman hatalı' }); continue
    }
    if (opts.dryRun) { sonuclar.push({ ...temel, durum: 'KURU' }); continue }
    try {
      const http = await yaz(k)
      sonuclar.push({ ...temel, durum: 'YAZILDI', http })
      await opts.kuyruk?.sonuc(kk, { durum: 'ISLENDI', islem: k.islem, ifsAnahtar: k.ifsAnahtar })
      await logAuditEvent({
        action: AUDIT_ACTION, actorId: opts.actorId ?? 'cron:ifs-personel-sync', targetType: 'IFS_PERSONEL_SYNC', targetId: `${k.varlik}:${k.ifsAnahtar}`,
        details: { varlik: k.varlik, hubId: k.hubId, islem: k.islem, etiket: k.etiket, govde: k.govde ?? null, fark: k.fark ?? null, http },
      })
    } catch (e) {
      const hata = e instanceof IfsSyncHatasi ? `${e.status} ${e.detay}` : (e as Error).message
      const http = e instanceof IfsSyncHatasi ? e.status : undefined
      sonuclar.push({ ...temel, durum: 'HATA', hata, http })
      if (k.varlik === 'EMPLOYEE') hataliAnahtarlar.add(k.ifsAnahtar)
      if (k.varlik === 'LABOR_CLASS') hataliLc.add(k.ifsAnahtar)
      await opts.kuyruk?.sonuc(kk, { durum: 'HATA', islem: k.islem, ifsAnahtar: k.ifsAnahtar, hata })
      await logAuditEvent({
        action: AUDIT_ACTION, actorId: opts.actorId ?? 'cron:ifs-personel-sync', targetType: 'IFS_PERSONEL_SYNC', targetId: `${k.varlik}:${k.ifsAnahtar}`,
        details: { varlik: k.varlik, hubId: k.hubId, islem: k.islem, etiket: k.etiket, govde: k.govde ?? null, hata, http },
      })
    }
  }
  const ozet = { yazildi: 0, hata: 0, atlandi: 0, noop: 0 }
  for (const s of sonuclar) { if (s.durum === 'YAZILDI' || s.durum === 'KURU') ozet.yazildi++; else if (s.durum === 'HATA') ozet.hata++; else if (s.durum === 'ATLANDI') ozet.atlandi++; else ozet.noop++ }
  return { dryRun: opts.dryRun, kalemler: sonuclar, ozet }
}
