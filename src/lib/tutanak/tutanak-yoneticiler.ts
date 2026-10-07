/**
 * IV-FR-03 Tutanak Formu — personelin YÖNETİCİ ZİNCİRİ.
 *
 * Formda yönetici, personelin org şemasındaki 1. ya da 2. yöneticisi arasından
 * RADIO ile seçilir; "bilgilendirilen son yönetici" zincirin EN ÜSTÜ olarak
 * otomatik hesaplanır (onay adımı DEĞİL, yalnız bilgilendirilir).
 *
 * Zincir birincil koltuktan (birincil-koltuk.ts — kurul koltukları ELENMİŞ)
 * yukarı doğru yürünerek kurulur: önce doğrudan raporlama hattı (reportsToId),
 * sonra üst zincirdeki SAHİPLİ POSITION kutuları. Kişinin kendisi ve zincirde
 * bir kez geçen kişiler tekrar eklenmez (vekâlet/çift koltukta döngü olurdu).
 *
 * amir-cozumle.ts yalnız 1. amiri çözüyor ve isim eşleşmesine düşebiliyor;
 * tutanakta isim eşleşmesi KULLANILMAZ — onay sahibi Personnel FK'sı olmalı.
 */

import { prisma } from '@/lib/prisma'
import { birincilKoltukBul } from '@/lib/is-analizi/birincil-koltuk'

const MAX_DERINLIK = 15
const KURUL_KOD_ONEKI = 'ORG-KR-'

export type YoneticiBasamagi = {
  /** 1 = en yakın yönetici, 2 = onun yöneticisi, … */
  kademe: number
  personnelId: string
  adSoyad: string
  sicilNo: string | null
  bolum: string | null
  gorev: string | null
  /** Zincirin EN ÜSTÜ mü (bilgilendirilecek son yönetici adayı). */
  sonYonetici: boolean
}

/** Saf: ham zincirden (sıralı personnelId listesi) basamakları kurar. */
export function basamaklariKur(
  zincir: { personnelId: string; adSoyad: string; sicilNo: string | null; bolum: string | null; gorev: string | null }[],
): YoneticiBasamagi[] {
  return zincir.map((k, i) => ({
    kademe: i + 1,
    personnelId: k.personnelId,
    adSoyad: k.adSoyad,
    sicilNo: k.sicilNo,
    bolum: k.bolum,
    gorev: k.gorev,
    sonYonetici: i === zincir.length - 1,
  }))
}

/**
 * Saf: seçilen yöneticiye göre bilgilendirilecek son yönetici.
 * Seçilen kişi ZİNCİRİN EN ÜSTÜYSE null döner — aynı kişiye hem onay hem
 * bilgilendirme gitmesin.
 */
export function sonYoneticiSec(
  basamaklar: YoneticiBasamagi[],
  secilenPersonnelId: string,
): YoneticiBasamagi | null {
  const son = basamaklar[basamaklar.length - 1]
  if (!son) return null
  if (son.personnelId === secilenPersonnelId) return null
  return son
}

/** Saf: seçilen yöneticinin kademesi (kayda yazılır). Zincirde yoksa null. */
export function kademeBul(basamaklar: YoneticiBasamagi[], personnelId: string): number | null {
  return basamaklar.find((b) => b.personnelId === personnelId)?.kademe ?? null
}

/** Formda radio olarak sunulacak basamaklar — YALNIZ 1. ve 2. (brifing kararı). */
export function secilebilirBasamaklar(basamaklar: YoneticiBasamagi[]): YoneticiBasamagi[] {
  return basamaklar.filter((b) => b.kademe <= 2)
}

async function kurulMu(orgUnitId: string): Promise<boolean> {
  let id: string | null = orgUnitId
  for (let i = 0; i < MAX_DERINLIK && id; i++) {
    const u: { code: string; parentId: string | null } | null = await prisma.orgUnit.findUnique({
      where: { id },
      select: { code: true, parentId: true },
    })
    if (!u) return false
    if (u.code.startsWith(KURUL_KOD_ONEKI)) return true
    id = u.parentId
  }
  return false
}

/**
 * Personelin yönetici zinciri (aşağıdan yukarı). Koltuğu yoksa boş liste döner —
 * o durumda tutanak açılamaz ve uç 400 verir (yönetici FK'sı zorunlu).
 */
export async function yoneticiZinciri(personnelId: string): Promise<YoneticiBasamagi[]> {
  const koltuk = await birincilKoltukBul(personnelId)
  if (!koltuk) return []

  const idler: string[] = []
  const gorulen = new Set<string>([personnelId])

  // 1) Doğrudan raporlama hattı — varsa zincirin ilk basamağı.
  let baslangicParentId = koltuk.secilen.orgUnitParentId
  if (koltuk.secilen.reportsToId) {
    const mgr = await prisma.orgEmployee.findUnique({
      where: { id: koltuk.secilen.reportsToId },
      select: { personnelId: true, orgUnitId: true, orgUnit: { select: { parentId: true } } },
    })
    if (mgr?.personnelId && !gorulen.has(mgr.personnelId) && !(await kurulMu(mgr.orgUnitId))) {
      idler.push(mgr.personnelId)
      gorulen.add(mgr.personnelId)
      baslangicParentId = mgr.orgUnit?.parentId ?? baslangicParentId
    }
  }

  // 2) Üst zincirdeki SAHİPLİ POSITION kutuları.
  let mevcut: string | null = baslangicParentId
  for (let i = 0; i < MAX_DERINLIK && mevcut; i++) {
    const u: {
      parentId: string | null
      code: string
      unitType: string
      employees: { personnelId: string | null }[]
    } | null = await prisma.orgUnit.findUnique({
      where: { id: mevcut },
      select: {
        parentId: true,
        code: true,
        unitType: true,
        employees: { where: { isActive: true, personnelId: { not: null } }, select: { personnelId: true } },
      },
    })
    if (!u) break
    if (u.unitType === 'POSITION' && !u.code.startsWith(KURUL_KOD_ONEKI)) {
      const sahip = u.employees.find((e) => e.personnelId && !gorulen.has(e.personnelId))
      if (sahip?.personnelId) {
        idler.push(sahip.personnelId)
        gorulen.add(sahip.personnelId)
      }
    }
    mevcut = u.parentId
  }

  if (idler.length === 0) return []

  const kisiler = await prisma.personnel.findMany({
    where: { id: { in: idler } },
    select: { id: true, adSoyad: true, sicilNo: true, bolum: true, gorev: true },
  })
  const harita = new Map(kisiler.map((k) => [k.id, k]))

  // Aktif olmayan/silinmiş personel zincirden düşer (onay sahibi olamaz).
  const zincir = idler
    .map((id) => harita.get(id))
    .filter((k): k is NonNullable<typeof k> => !!k)
    .map((k) => ({
      personnelId: k.id,
      adSoyad: k.adSoyad,
      sicilNo: k.sicilNo,
      bolum: k.bolum,
      gorev: k.gorev,
    }))

  return basamaklariKur(zincir)
}
