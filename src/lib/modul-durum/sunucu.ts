import 'server-only'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { normalizeTr } from '@/lib/normalize-tr'
import { requireUser } from '@/lib/auth/require-user'
import {
  MODUL_KAYDI,
  durumAnahtari,
  durumCoz,
  pilotAnahtari,
  pilotBolumleriCoz,
  type ModulDurum,
} from './kayit'

/**
 * Modül yayın durumu — SUNUCU tarafı. Tek karar noktası burasıdır.
 *
 * Üç kapı da buradan beslenir:
 *   1) Menü      → /api/modul-durum (Sidebar tek istekle hepsini alır)
 *   2) Rota      → modulGuard(anahtar) — modülün layout.tsx'inde, GİZLİ/PİLOT dışı 404
 *   3) Cron/mail → modulAcikMi(anahtar) — iş kütüphanesinde erken return
 *
 * Kaydı olmayan modül ACIK sayılır: mevcut modüllerin davranışı değişmez.
 */

export interface ModulYayin {
  durum: ModulDurum
  pilotBolumler: string[]
}

type Kisi = { role?: string | null; department?: string | null }

const ADMIN_ROLU = 'SUPER_ADMIN'

/** Kayıttaki TÜM modüllerin durumu (tek sorgu). Eksik kayıt varsayılana düşer. */
export async function modulYayinlari(): Promise<Map<string, ModulYayin>> {
  const anahtarlar = MODUL_KAYDI.flatMap((m) => [durumAnahtari(m.anahtar), pilotAnahtari(m.anahtar)])
  const satirlar = anahtarlar.length
    ? await prisma.systemSetting.findMany({
        where: { key: { in: anahtarlar } },
        select: { key: true, value: true },
      })
    : []

  const ham = new Map(satirlar.map((s) => [s.key, s.value]))
  const sonuc = new Map<string, ModulYayin>()
  for (const m of MODUL_KAYDI) {
    sonuc.set(m.anahtar, {
      durum: durumCoz(ham.get(durumAnahtari(m.anahtar))),
      pilotBolumler: pilotBolumleriCoz(ham.get(pilotAnahtari(m.anahtar))),
    })
  }
  return sonuc
}

/** Tek modülün durumu. Kayıtta olmayan anahtar → varsayılan (ACIK). */
export async function modulYayini(anahtar: string): Promise<ModulYayin> {
  const [durumSatiri, pilotSatiri] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: durumAnahtari(anahtar) }, select: { value: true } }),
    prisma.systemSetting.findUnique({ where: { key: pilotAnahtari(anahtar) }, select: { value: true } }),
  ])
  return {
    durum: durumCoz(durumSatiri?.value),
    pilotBolumler: pilotBolumleriCoz(pilotSatiri?.value),
  }
}

/**
 * Kişi bu modülü görebilir mi?
 *   ACIK  → herkes (asıl yetki kontrolü modülün kendi guard'ında, bu kapı ondan ÖNCE)
 *   PILOT → SUPER_ADMIN + pilot bölümlerinden biri (normalizeTr ile karşılaştırılır)
 *   GIZLI → yalnız SUPER_ADMIN
 */
export function yayinGorunurMu(yayin: ModulYayin, kisi: Kisi): boolean {
  if (yayin.durum === 'ACIK') return true
  if (kisi.role === ADMIN_ROLU) return true
  if (yayin.durum !== 'PILOT') return false

  const bolum = normalizeTr(kisi.department ?? '')
  if (!bolum) return false
  return yayin.pilotBolumler.some((b) => normalizeTr(b) === bolum)
}

export async function modulGorunurMu(anahtar: string, kisi: Kisi): Promise<boolean> {
  return yayinGorunurMu(await modulYayini(anahtar), kisi)
}

/**
 * Cron / toplu bildirim kapısı. YALNIZ ACIK iken true.
 * PILOT'ta da false döner: modül yarı açıkken gerçek kişilere mail/push gitmemeli.
 *
 * Kullanım (iş kütüphanesinde, uçta değil — cron 200 dönmeye devam etsin):
 *   if (!(await modulAcikMi('proje-takip'))) {
 *     console.log('[proje-takip] modül ACIK değil — bildirim gönderilmedi')
 *     return { gonderilen: 0, atlandi: 'MODUL_KAPALI' as const }
 *   }
 */
export async function modulAcikMi(anahtar: string): Promise<boolean> {
  return (await modulYayini(anahtar)).durum === 'ACIK'
}

/**
 * Rota kapısı — modülün layout.tsx'inde ilk satır.
 * Görünmüyorsa notFound(): "yetkiniz yok" demek modülün varlığını sızdırır.
 * Oturum yoksa da 404 — middleware zaten /login'e yolluyor, burada sessiz kal.
 */
export async function modulGuard(anahtar: string): Promise<void> {
  const yayin = await modulYayini(anahtar)
  if (yayin.durum === 'ACIK') return
  const oturum = await requireUser()
  if (oturum.error || !oturum.user) notFound()
  if (!yayinGorunurMu(yayin, oturum.user)) notFound()
}
