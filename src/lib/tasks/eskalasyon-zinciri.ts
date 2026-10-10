/**
 * Görev eskalasyonunda yönetici zinciri.
 *
 * NEDEN: 10.10.2026'ya kadar eskalasyon iki basamaklıydı — 1. gün sorumlu kişinin
 * yöneticisi, 5. gün DOĞRUDAN üst yönetim (TaskExecutiveEmail listesi). Araya
 * hiçbir basamak girmediği için bir müdür yardımcısının ya da bölüm çalışanının
 * gecikmiş görevi 5. günde Halit/Hilmi İleri'ye düşüyordu; aradaki müdür hiç
 * görmüyordu. Bu dosya AD (LDAP) `manager` alanını yukarı doğru yürüyüp zinciri
 * çıkarır: eskalasyon basamak basamak yukarı çıkar, üst yönetim yalnız zincir
 * tükendiğinde devreye girer.
 *
 * Yalnız okur; LDAP sorgusu yapmaz — çağıran taraf `getAllLDAPUsers()` sonucunu verir.
 */

import type { LDAPUser } from '@/lib/ldap'

/** Zincirdeki bir basamak — e-postası olan, hesabı açık bir yönetici. */
export type ZincirBasamak = {
  email: string
  displayName: string
  title: string | null
  distinguishedName: string
}

/** Varsayılan üst sınır: AD'de döngü ya da uzun zincir olursa sonsuza gitmesin. */
const EN_FAZLA_BASAMAK = 6

function basamak(u: LDAPUser): ZincirBasamak | null {
  if (!u.email || u.disabled) return null
  return {
    email: u.email,
    displayName: u.displayName,
    title: u.title,
    distinguishedName: u.distinguishedName,
  }
}

/**
 * `email` sahibinden başlayarak yöneticisini, yöneticisinin yöneticisini … sırayla döner.
 * İlk eleman doğrudan yönetici. E-postası olmayan / devre dışı hesaplar ATLANIR
 * (zincir orada kesilmez, bir üst basamağa geçilir) — aksi hâlde boş bir ara kayıt
 * tüm eskalasyonu durduruyordu.
 *
 * Kişi LDAP'ta bulunamazsa ya da `manager` alanı boşsa boş dizi döner.
 */
export function yoneticiZinciri(
  ldapUsers: LDAPUser[],
  email: string | null | undefined,
  enFazla: number = EN_FAZLA_BASAMAK
): ZincirBasamak[] {
  if (!email) return []

  const dnIle = new Map<string, LDAPUser>()
  const epostaIle = new Map<string, LDAPUser>()
  for (const u of ldapUsers) {
    if (u.distinguishedName) dnIle.set(u.distinguishedName.toLowerCase(), u)
    if (u.email) epostaIle.set(u.email.toLowerCase(), u)
  }

  const baslangic = epostaIle.get(email.toLowerCase())
  if (!baslangic) return []

  const zincir: ZincirBasamak[] = []
  const gorulen = new Set<string>([baslangic.distinguishedName.toLowerCase()])
  let suan: LDAPUser | undefined = baslangic

  while (suan?.managerDN && zincir.length < enFazla) {
    const anahtar = suan.managerDN.toLowerCase()
    if (gorulen.has(anahtar)) break // AD'de döngü (kişi kendi yöneticisi / karşılıklı)
    gorulen.add(anahtar)

    const yonetici: LDAPUser | undefined = dnIle.get(anahtar)
    if (!yonetici) break // zincir AD'de kopmuş

    const b = basamak(yonetici)
    if (b) zincir.push(b)
    suan = yonetici
  }

  return zincir
}

/**
 * Zincirdeki bir basamak üst yönetim listesinde mi? Öyleyse "bir üst yönetici"
 * basamağı ile "üst yönetim" basamağı aynı kişiye çıkıyor demektir; iki ayrı
 * mail atmak yerine doğrudan üst yönetim basamağına geçilir.
 */
export function ustYonetimdeMi(b: ZincirBasamak, ustYonetimEpostalari: string[]): boolean {
  const kume = new Set(ustYonetimEpostalari.map((e) => e.toLowerCase()))
  return kume.has(b.email.toLowerCase())
}
