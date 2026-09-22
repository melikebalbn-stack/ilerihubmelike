/**
 * Rapor çalıştırma — SUNUCU ortak katmanı. calistir (belge), veri (etkileşimli ham satır) ve
 * excel (etkileşimli XLSX) uçları aynı yetki + parametre + rapor_calistirma kaydı mantığını buradan alır.
 * Yetki: çağıran uç rapor.view'ı requirePermission ile geçmiş olmalı; burada şablon düzeyi kurallar
 * (ARSIV, TASLAK→rapor.tasarla, izinAnahtari) uygulanır.
 */
import { NextResponse } from 'next/server'
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
