import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import type { PdksYon } from '@/generated/prisma'
import {
  IsapiHata,
  cihazBilgisiAl,
  cihazSaatiAl,
  envOnekTuret,
  hostDogrula,
  kimlikTanimliMi,
  type CihazBilgisi,
  type CihazSaati,
} from './isapi-istemci'

/**
 * PDKS cihaz / kapı / okuyucu yönetimi (Faz 1). Tüm yazmalar pdks.manage (route'ta) +
 * denetim kaydı. Doğrulama elle (repo deseni, Zod yok); kullanıcı hataları 400.
 */

export const PDKS_MARKALAR = ['HIKVISION', 'GEOVISION'] as const
export type PdksMarka = (typeof PDKS_MARKALAR)[number]

/** Cihaz saat sapması bu değeri aşarsa sağlık kartı uyarı verir (plan §3.1). */
export const SAAT_SAPMA_ESIGI_SN = 60

// ── Hata ─────────────────────────────────────────────────────────────────────

export class PdksGirdiHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'PdksGirdiHatasi'
  }
}

/** Route'lar için ortak hata → yanıt. 500'de iç mesaj SIZDIRILMAZ (yalnız log). */
export function pdksHata(e: unknown, varsayilan = 'İşlem başarısız') {
  if (e instanceof PdksGirdiHatasi) return NextResponse.json({ ok: false, error: e.message }, { status: 400 })
  if (e instanceof SyntaxError) return NextResponse.json({ ok: false, error: 'Geçersiz istek gövdesi' }, { status: 400 })
  const kod = (e as { code?: string })?.code
  if (kod === 'P2002') {
    const alan = (e as { meta?: { target?: string[] | string } })?.meta?.target
    return NextResponse.json(
      { ok: false, error: `Bu değer zaten kayıtlı (${Array.isArray(alan) ? alan.join(', ') : alan ?? 'kayıt'})` },
      { status: 409 },
    )
  }
  if (kod === 'P2025') return NextResponse.json({ ok: false, error: 'Kayıt bulunamadı' }, { status: 404 })
  if (kod === 'P2003') {
    return NextResponse.json(
      { ok: false, error: 'Bağlı kayıtlar (kapı, okuyucu, geçiş veya kart) olduğu için silinemez — pasife alın' },
      { status: 409 },
    )
  }
  console.error('[pdks]', e)
  return NextResponse.json({ ok: false, error: varsayilan }, { status: 500 })
}

// ── Girdi yardımcıları ───────────────────────────────────────────────────────

function metin(v: unknown, ad: string, { zorunlu = true, max = 120 } = {}): string | undefined {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    if (zorunlu) throw new PdksGirdiHatasi(`${ad} zorunlu`)
    return undefined
  }
  if (typeof v !== 'string') throw new PdksGirdiHatasi(`${ad} metin olmalı`)
  const t = v.trim()
  if (t.length > max) throw new PdksGirdiHatasi(`${ad} en fazla ${max} karakter olabilir`)
  return t
}

function tamsayi(v: unknown, ad: string, min: number, max: number): number {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new PdksGirdiHatasi(`${ad} ${min}-${max} arasında tam sayı olmalı`)
  }
  return n
}

function yon(v: unknown): PdksYon {
  if (v === 'GIRIS' || v === 'CIKIS') return v
  throw new PdksGirdiHatasi('Yön GIRIS veya CIKIS olmalı')
}

const KOD_DESENI = /^[A-Z0-9][A-Z0-9-]{1,31}$/

// ── Okuma ────────────────────────────────────────────────────────────────────

export async function cihazListesi() {
  const cihazlar = await prisma.pdksCihaz.findMany({
    orderBy: [{ aktif: 'desc' }, { kod: 'asc' }],
    include: {
      kapilar: {
        orderBy: { kapiNo: 'asc' },
        include: { okuyucular: { orderBy: { okuyucuNo: 'asc' } } },
      },
      _count: { select: { gecisler: true } },
    },
  })
  // Kimlik bilgisinin DEĞERİ asla dönmez — yalnız tanımlı mı.
  return cihazlar.map((c) => ({ ...c, kimlikTanimli: kimlikTanimliMi(c.envOnek) }))
}

// ── Cihaz ────────────────────────────────────────────────────────────────────

export async function cihazOlustur(b: Record<string, unknown>, aktorId: string) {
  const kod = metin(b.kod, 'Kod', { max: 32 })!.toUpperCase()
  if (!KOD_DESENI.test(kod)) throw new PdksGirdiHatasi('Kod yalnız A-Z, 0-9 ve tire içerebilir (ör. HIK-ANA-1)')
  const marka = metin(b.marka, 'Marka') as PdksMarka
  if (!PDKS_MARKALAR.includes(marka)) throw new PdksGirdiHatasi('Marka HIKVISION veya GEOVISION olmalı')
  const host = metin(b.host, 'Host', { max: 21 })!
  const hostHata = hostDogrula(host)
  if (hostHata) throw new PdksGirdiHatasi(hostHata)

  const cihaz = await prisma.pdksCihaz.create({
    data: {
      kod,
      ad: metin(b.ad, 'Ad')!,
      marka,
      model: metin(b.model, 'Model', { max: 40 })!,
      host,
      envOnek: envOnekTuret(kod),
      aktif: b.aktif === undefined ? true : Boolean(b.aktif),
    },
  })
  await logAuditEvent({
    action: 'PDKS_CIHAZ_CREATED',
    actorId: aktorId,
    targetType: 'PDKS_CIHAZ',
    targetId: cihaz.id,
    details: { kod, ad: cihaz.ad, marka, model: cihaz.model, host, envOnek: cihaz.envOnek },
  })
  return cihaz
}

/** Kod ve envOnek DEĞİŞMEZ (env anahtarı ve geçiş dedup anahtarı koda bağlı). */
export async function cihazGuncelle(id: string, b: Record<string, unknown>, aktorId: string) {
  const data: { ad?: string; model?: string; host?: string; aktif?: boolean } = {}
  if (b.ad !== undefined) data.ad = metin(b.ad, 'Ad')
  if (b.model !== undefined) data.model = metin(b.model, 'Model', { max: 40 })
  if (b.host !== undefined) {
    const host = metin(b.host, 'Host', { max: 21 })!
    const hostHata = hostDogrula(host)
    if (hostHata) throw new PdksGirdiHatasi(hostHata)
    data.host = host
  }
  if (b.aktif !== undefined) data.aktif = Boolean(b.aktif)
  if (Object.keys(data).length === 0) throw new PdksGirdiHatasi('Güncellenecek alan yok')

  const cihaz = await prisma.pdksCihaz.update({ where: { id }, data })
  await logAuditEvent({
    action: 'PDKS_CIHAZ_UPDATED',
    actorId: aktorId,
    targetType: 'PDKS_CIHAZ',
    targetId: id,
    details: { kod: cihaz.kod, degisen: data },
  })
  return cihaz
}

/** Kapısı, geçişi veya kart senkron kaydı olan cihaz silinemez (FK Restrict → 409). */
export async function cihazSil(id: string, aktorId: string) {
  const cihaz = await prisma.pdksCihaz.delete({ where: { id } })
  await logAuditEvent({
    action: 'PDKS_CIHAZ_DELETED',
    actorId: aktorId,
    targetType: 'PDKS_CIHAZ',
    targetId: id,
    details: { kod: cihaz.kod, ad: cihaz.ad },
  })
}

// ── Kapı ─────────────────────────────────────────────────────────────────────

export async function kapiOlustur(b: Record<string, unknown>, aktorId: string) {
  const cihazId = metin(b.cihazId, 'Cihaz')!
  if (!(await prisma.pdksCihaz.findUnique({ where: { id: cihazId }, select: { id: true } }))) {
    throw new PdksGirdiHatasi('Cihaz bulunamadı')
  }
  const kapi = await prisma.pdksKapi.create({
    data: {
      cihazId,
      kapiNo: tamsayi(b.kapiNo, 'Kapı no', 1, 64),
      ad: metin(b.ad, 'Ad')!,
      grup: metin(b.grup, 'Grup', { zorunlu: false, max: 40 }) ?? null,
      aktif: b.aktif === undefined ? true : Boolean(b.aktif),
    },
  })
  await logAuditEvent({
    action: 'PDKS_KAPI_CREATED',
    actorId: aktorId,
    targetType: 'PDKS_KAPI',
    targetId: kapi.id,
    details: { cihazId, kapiNo: kapi.kapiNo, ad: kapi.ad, grup: kapi.grup },
  })
  return kapi
}

export async function kapiGuncelle(id: string, b: Record<string, unknown>, aktorId: string) {
  const data: { kapiNo?: number; ad?: string; grup?: string | null; aktif?: boolean } = {}
  if (b.kapiNo !== undefined) data.kapiNo = tamsayi(b.kapiNo, 'Kapı no', 1, 64)
  if (b.ad !== undefined) data.ad = metin(b.ad, 'Ad')
  if (b.grup !== undefined) data.grup = metin(b.grup, 'Grup', { zorunlu: false, max: 40 }) ?? null
  if (b.aktif !== undefined) data.aktif = Boolean(b.aktif)
  if (Object.keys(data).length === 0) throw new PdksGirdiHatasi('Güncellenecek alan yok')
  const kapi = await prisma.pdksKapi.update({ where: { id }, data })
  await logAuditEvent({
    action: 'PDKS_KAPI_UPDATED',
    actorId: aktorId,
    targetType: 'PDKS_KAPI',
    targetId: id,
    details: { cihazId: kapi.cihazId, degisen: data },
  })
  return kapi
}

export async function kapiSil(id: string, aktorId: string) {
  const kapi = await prisma.pdksKapi.delete({ where: { id } })
  await logAuditEvent({
    action: 'PDKS_KAPI_DELETED',
    actorId: aktorId,
    targetType: 'PDKS_KAPI',
    targetId: id,
    details: { cihazId: kapi.cihazId, kapiNo: kapi.kapiNo, ad: kapi.ad },
  })
}

// ── Okuyucu ──────────────────────────────────────────────────────────────────

/**
 * Yön değişikliği geçmiş geçişleri ETKİLEMEZ (PdksGecis.yon alım anındaki snapshot'tır);
 * yalnız bundan sonra alınan olaylar yeni yönle yazılır.
 */
export async function okuyucuOlustur(b: Record<string, unknown>, aktorId: string) {
  const kapiId = metin(b.kapiId, 'Kapı')!
  if (!(await prisma.pdksKapi.findUnique({ where: { id: kapiId }, select: { id: true } }))) {
    throw new PdksGirdiHatasi('Kapı bulunamadı')
  }
  const okuyucu = await prisma.pdksOkuyucu.create({
    data: {
      kapiId,
      okuyucuNo: tamsayi(b.okuyucuNo, 'Okuyucu no', 1, 64),
      yon: yon(b.yon),
      puantajaDahil: b.puantajaDahil === undefined ? true : Boolean(b.puantajaDahil),
      aktif: b.aktif === undefined ? true : Boolean(b.aktif),
    },
  })
  await logAuditEvent({
    action: 'PDKS_OKUYUCU_CREATED',
    actorId: aktorId,
    targetType: 'PDKS_OKUYUCU',
    targetId: okuyucu.id,
    details: { kapiId, okuyucuNo: okuyucu.okuyucuNo, yon: okuyucu.yon, puantajaDahil: okuyucu.puantajaDahil },
  })
  return okuyucu
}

export async function okuyucuGuncelle(id: string, b: Record<string, unknown>, aktorId: string) {
  const data: { okuyucuNo?: number; yon?: PdksYon; puantajaDahil?: boolean; aktif?: boolean } = {}
  if (b.okuyucuNo !== undefined) data.okuyucuNo = tamsayi(b.okuyucuNo, 'Okuyucu no', 1, 64)
  if (b.yon !== undefined) data.yon = yon(b.yon)
  if (b.puantajaDahil !== undefined) data.puantajaDahil = Boolean(b.puantajaDahil)
  if (b.aktif !== undefined) data.aktif = Boolean(b.aktif)
  if (Object.keys(data).length === 0) throw new PdksGirdiHatasi('Güncellenecek alan yok')
  const okuyucu = await prisma.pdksOkuyucu.update({ where: { id }, data })
  await logAuditEvent({
    action: 'PDKS_OKUYUCU_UPDATED',
    actorId: aktorId,
    targetType: 'PDKS_OKUYUCU',
    targetId: id,
    details: { kapiId: okuyucu.kapiId, degisen: data },
  })
  return okuyucu
}

export async function okuyucuSil(id: string, aktorId: string) {
  const okuyucu = await prisma.pdksOkuyucu.delete({ where: { id } })
  await logAuditEvent({
    action: 'PDKS_OKUYUCU_DELETED',
    actorId: aktorId,
    targetType: 'PDKS_OKUYUCU',
    targetId: id,
    details: { kapiId: okuyucu.kapiId, okuyucuNo: okuyucu.okuyucuNo, yon: okuyucu.yon },
  })
}

// ── Sağlık kontrolü ──────────────────────────────────────────────────────────

export interface SaglikSonucu {
  ok: boolean
  kontrolAt: string
  sureMs: number
  bilgi?: CihazBilgisi
  saat?: CihazSaati & { esikSn: number; uyari: boolean }
  hata?: { kod: string; mesaj: string }
}

/**
 * Bağlantı testi: deviceInfo + System/time. Cihaz yokken de ÇÖKMEZ — ağ hatası
 * (zaman aşımı / ECONNREFUSED / ulaşılamıyor) SaglikSonucu.hata olarak döner.
 * Başarılıysa sonGorulmeAt + seriNo/firmware (cihazın bildirdiği) güncellenir.
 */
export async function saglikKontrolu(id: string): Promise<SaglikSonucu> {
  const cihaz = await prisma.pdksCihaz.findUniqueOrThrow({ where: { id } })
  const baslangic = Date.now()
  const sonuc = (s: Omit<SaglikSonucu, 'kontrolAt' | 'sureMs'>): SaglikSonucu => ({
    ...s,
    kontrolAt: new Date().toISOString(),
    sureMs: Date.now() - baslangic,
  })

  if (cihaz.marka !== 'HIKVISION') {
    return sonuc({ ok: false, hata: { kod: 'DESTEKLENMIYOR', mesaj: `${cihaz.marka} cihazı arşiv kaydıdır — bağlantı testi yok` } })
  }

  try {
    const bilgi = await cihazBilgisiAl(cihaz)
    const saat = await cihazSaatiAl(cihaz)
    await prisma.pdksCihaz.update({
      where: { id },
      data: {
        sonGorulmeAt: new Date(),
        ...(bilgi.seriNo ? { seriNo: bilgi.seriNo } : {}),
        ...(bilgi.firmware ? { firmware: [bilgi.firmware, bilgi.firmwareTarihi].filter(Boolean).join(' ') } : {}),
      },
    })
    return sonuc({
      ok: true,
      bilgi,
      saat: { ...saat, esikSn: SAAT_SAPMA_ESIGI_SN, uyari: Math.abs(saat.sapmaSn) > SAAT_SAPMA_ESIGI_SN },
    })
  } catch (e) {
    if (e instanceof IsapiHata) return sonuc({ ok: false, hata: { kod: e.kod, mesaj: e.message } })
    console.error('[pdks] sağlık kontrolü', cihaz.kod, e)
    return sonuc({ ok: false, hata: { kod: 'BILINMEYEN', mesaj: 'Beklenmeyen hata — sunucu log\'una bakın' } })
  }
}
