/**
 * Rapor çalıştırma — SUNUCU ortak katmanı. calistir (belge), veri (etkileşimli ham satır) ve
 * excel (etkileşimli XLSX) uçları aynı yetki + parametre + rapor_calistirma kaydı mantığını buradan alır.
 * Yetki: çağıran uç rapor.view'ı requirePermission ile geçmiş olmalı; burada şablon düzeyi kurallar
 * (ARSIV, TASLAK→rapor.tasarla, izinAnahtari) uygulanır.
 */
import { NextResponse } from 'next/server'
import nodePath from 'path'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { parametreleriHazirla } from './sablon-parametre'
import type { SablonIcerikHer, VeriSetiTanim } from './tipler'
import type { RaporCiktiTipi } from '@/generated/prisma'

export interface RaporBaglami {
  sablon: { id: string; kod: string; ad: string; veriSetiId: string; surum: number }
  icerik: SablonIcerikHer
  tanim: VeriSetiTanim
  degerler: Record<string, unknown>
  /** rapor_calistirma için hazır kayıt gövdesi. */
  kayit: { sablonId: string; calistiranId: string; parametreler: unknown; cikti: RaporCiktiTipi }
  calistiranAd: string | undefined
}

export async function raporBaglami(id: string, userId: string, hamParametreler: Record<string, unknown>, cikti: RaporCiktiTipi): Promise<{ hata: NextResponse } | { hata?: undefined; baglam: RaporBaglami }> {
  const sablon = await prisma.raporSablon.findUnique({ where: { id }, include: { veriSeti: { select: { tanim: true } } } })
  if (!sablon) return { hata: NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 }) }

  const perms = await getUserPermissions(userId)
  if (sablon.durum === 'ARSIV') return { hata: NextResponse.json({ error: 'Bu rapor arşivlenmiş' }, { status: 410 }) }
  if (sablon.durum === 'TASLAK' && !perms.has(PERMISSION_KEYS.RAPOR_TASARLA)) {
    return { hata: NextResponse.json({ error: 'Taslak raporu yalnız tasarımcılar çalıştırabilir' }, { status: 403 }) }
  }
  if (sablon.izinAnahtari && !perms.has(sablon.izinAnahtari)) {
    return { hata: NextResponse.json({ error: 'Bu rapor için ek yetki gerekiyor', required: [sablon.izinAnahtari] }, { status: 403 }) }
  }

  const icerik = sablon.icerik as unknown as SablonIcerikHer
  const tanim = sablon.veriSeti.tanim as unknown as VeriSetiTanim
  const { degerler, hatalar } = parametreleriHazirla(icerik, hamParametreler)
  if (hatalar.length) return { hata: NextResponse.json({ error: `Eksik/geçersiz parametre: ${hatalar.join('; ')}` }, { status: 400 }) }

  const calistiranAd = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? undefined
  return {
    baglam: {
      sablon: { id: sablon.id, kod: sablon.kod, ad: sablon.ad, veriSetiId: sablon.veriSetiId, surum: sablon.surum },
      icerik, tanim, degerler,
      kayit: { sablonId: sablon.id, calistiranId: userId, parametreler: JSON.parse(JSON.stringify(degerler)), cikti },
      calistiranAd,
    },
  }
}

/** Başarılı çalıştırma kaydı. */
export async function calistirmaKaydet(kayit: RaporBaglami['kayit'], satirSayisi: number, sureMs: number): Promise<void> {
  await prisma.raporCalistirma.create({ data: { ...kayit, parametreler: kayit.parametreler as object, satirSayisi, sureMs } })
}

/** Hatalı çalıştırma kaydı (kayıt yazılamazsa sessizce geçer) + log. */
export async function calistirmaHatasiKaydet(kayit: RaporBaglami['kayit'], kod: string, sureMs: number, e: unknown): Promise<string> {
  const mesaj = e instanceof Error ? e.message : String(e)
  await prisma.raporCalistirma.create({ data: { ...kayit, parametreler: kayit.parametreler as object, sureMs, hata: mesaj.slice(0, 2000) } }).catch(() => {})
  console.error(`[rapor] ${kod} çalıştırma hatası:`, e)
  return mesaj
}

// ── Tuval görselleri ─────────────────────────────────────────────────────

/** Kurum logosu adayları (ilki bulunan kullanılır); RAPOR_LOGO ile ezilebilir. */
const LOGO_ADAYLARI = ['ilerigrouplogo.png', 'ilerihublogo.png']
const YUKLEME_DESENI = /^\/uploads\/rapor\/logolar\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }

async function dataUri(mutlakYol: string): Promise<string | undefined> {
  try {
    const { readFile } = await import('fs/promises')
    const tur = MIME[nodePath.extname(mutlakYol).toLowerCase()]
    if (!tur) return undefined
    const veri = await readFile(mutlakYol)
    if (veri.byteLength > 4 * 1024 * 1024) return undefined
    return `data:${tur};base64,${veri.toString('base64')}`
  } catch { return undefined }
}

/**
 * Tuvaldeki görselleri data URI'ye çevirir — yazdırmada/PDF'te dış URL çözülmeyebilir.
 * Yüklenen görseller yalnız public/uploads/rapor/logolar altından okunur (yol enjeksiyonu yok).
 */
export async function tuvalGorselleri(tuval: { ogeler?: { tip: string; kaynak?: string; url?: string }[] } | undefined): Promise<{ logoUrl?: string; gorseller: Record<string, string> }> {
  const gorseller: Record<string, string> = {}
  const gorselOgeler = (tuval?.ogeler ?? []).filter((e) => e.tip === 'gorsel')
  if (!gorselOgeler.length) return { gorseller }

  let logoUrl: string | undefined
  if (gorselOgeler.some((e) => (e.kaynak ?? 'logo') === 'logo')) {
    const adaylar = [process.env.RAPOR_LOGO, ...LOGO_ADAYLARI].filter(Boolean) as string[]
    for (const a of adaylar) {
      logoUrl = await dataUri(nodePath.join(process.cwd(), 'public', a))
      if (logoUrl) break
    }
  }
  for (const e of gorselOgeler) {
    if (e.kaynak !== 'yukleme' || !e.url || gorseller[e.url] || !YUKLEME_DESENI.test(e.url)) continue
    const veri = await dataUri(nodePath.join(process.cwd(), 'public', e.url.replace(/^\//, '')))
    if (veri) gorseller[e.url] = veri
  }
  return { logoUrl, gorseller }
}
