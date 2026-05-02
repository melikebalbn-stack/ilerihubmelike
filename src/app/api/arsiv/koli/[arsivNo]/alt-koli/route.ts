/**
 * POST /api/arsiv/koli/[arsivNo]/alt-koli
 *   Mevcut ana koliye yeni alt koli ekle.
 *   - Yetki: koli'nin bolum'u kullanıcının bolum'u; SUPER_ADMIN tümü
 *   - Ana koli durum: SADECE Aktif veya Arsivde
 *   - Mevcut harf sayısı 26'ya ulaşmışsa 409
 *   - Harf: generateNextAltKoliHarf(anaKoliId)
 *   - Alt koli imhaTarihi = donemSonu + saklamaSuresiYil
 *   - Eğer alt imhaTarihi > ana imhaTarihi → ana güncellenir (extend)
 *   - Aktivite log: AltKoliEkle (alt) + Duzenle (ana, eğer imhaTarihi değişti)
 *   - evrakTuruId XOR pendingEvrakTuru: pendingEvrakTuru verilirse transaction
 *     içinde yeni evrak türü yaratılır (UI-2a-Ek2 paterni). EvrakTuruEkle log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
} from '@/lib/arsiv-auth'
import {
  logArsivAktivite,
  getClientIp,
  getUserAgent,
} from '@/lib/arsiv-aktivite'
import { calculateAltKoliImhaTarihi } from '@/lib/arsiv-tarih'
import { generateNextAltKoliHarf } from '@/lib/arsiv-numara'
import { toJSONSafe } from '@/lib/arsiv-serialize'

export const dynamic = 'force-dynamic'

const ARSIV_NO_REGEX = /^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}$/
const QR_BASE = 'https://arsiv.ilerigroup.com'
const GIZLILIK_VALUES = ['KamuyaAcik', 'SirketIci', 'Gizli', 'CokGizli'] as const
type GizlilikSeviyesi = (typeof GIZLILIK_VALUES)[number]

type PendingEvrakTuruInput = {
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak?: string | null
}

type AltKoliInput = {
  evrakTuruId?: number
  pendingEvrakTuru?: PendingEvrakTuruInput
  donemBaslangic: string
  donemSonu: string
  evrakSayisi?: number | null
  gizlilikSeviyesi?: GizlilikSeviyesi
  saklamaSuresiYil: number
  hazirlayan?: string | null
  aciklama?: string | null
}

function parseDate(s: unknown, field: string): Date {
  if (typeof s !== 'string') throw new Error(`${field} string olmalı`)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) throw new Error(`${field} geçersiz tarih: ${s}`)
  return d
}

function validatePendingEvrakTuru(raw: unknown): PendingEvrakTuruInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error('pendingEvrakTuru obje olmalı')
  }
  const p = raw as Record<string, unknown>
  if (typeof p.ad !== 'string') throw new Error('pendingEvrakTuru.ad string olmalı')
  const ad = (p.ad as string).trim()
  if (ad.length < 3 || ad.length > 150) {
    throw new Error('pendingEvrakTuru.ad 3-150 karakter olmalı')
  }
  if (
    !Number.isInteger(p.varsayilanSaklamaYili) ||
    (p.varsayilanSaklamaYili as number) < 1 ||
    (p.varsayilanSaklamaYili as number) > 100
  ) {
    throw new Error('pendingEvrakTuru.varsayilanSaklamaYili 1-100 olmalı')
  }
  let yasalDayanak: string | null = null
  if (p.yasalDayanak !== undefined && p.yasalDayanak !== null) {
    if (typeof p.yasalDayanak !== 'string') {
      throw new Error('pendingEvrakTuru.yasalDayanak string olmalı')
    }
    if ((p.yasalDayanak as string).length > 250) {
      throw new Error('pendingEvrakTuru.yasalDayanak 250 karakteri geçemez')
    }
    yasalDayanak = (p.yasalDayanak as string).trim() || null
  }
  return {
    ad,
    varsayilanSaklamaYili: p.varsayilanSaklamaYili as number,
    yasalDayanak,
  }
}

function validateAltKoli(raw: unknown): AltKoliInput {
  if (!raw || typeof raw !== 'object') throw new Error('body obje olmalı')
  const a = raw as Record<string, unknown>

  const hasEvrakTuruId = a.evrakTuruId !== undefined && a.evrakTuruId !== null
  const hasPending = a.pendingEvrakTuru !== undefined && a.pendingEvrakTuru !== null
  if (hasEvrakTuruId === hasPending) {
    throw new Error('evrakTuruId veya pendingEvrakTuru — birinden tam biri zorunlu')
  }
  if (hasEvrakTuruId) {
    if (!Number.isInteger(a.evrakTuruId) || (a.evrakTuruId as number) < 1) {
      throw new Error('evrakTuruId geçersiz')
    }
  }
  let pendingEvrakTuru: PendingEvrakTuruInput | undefined
  if (hasPending) {
    pendingEvrakTuru = validatePendingEvrakTuru(a.pendingEvrakTuru)
  }

  parseDate(a.donemBaslangic, 'donemBaslangic')
  parseDate(a.donemSonu, 'donemSonu')
  if (
    !Number.isInteger(a.saklamaSuresiYil) ||
    (a.saklamaSuresiYil as number) < 1 ||
    (a.saklamaSuresiYil as number) > 100
  ) {
    throw new Error('saklamaSuresiYil 1-100 olmalı')
  }
  if (a.evrakSayisi !== undefined && a.evrakSayisi !== null) {
    if (!Number.isInteger(a.evrakSayisi) || (a.evrakSayisi as number) < 0) {
      throw new Error('evrakSayisi negatif olamaz')
    }
  }
  if (a.gizlilikSeviyesi !== undefined) {
    if (!GIZLILIK_VALUES.includes(a.gizlilikSeviyesi as GizlilikSeviyesi)) {
      throw new Error(`gizlilikSeviyesi geçersiz: ${String(a.gizlilikSeviyesi)}`)
    }
  }
  if (a.hazirlayan !== undefined && a.hazirlayan !== null) {
    if (typeof a.hazirlayan !== 'string' || (a.hazirlayan as string).length > 150) {
      throw new Error('hazirlayan geçersiz (max 150 karakter)')
    }
  }
  if (a.aciklama !== undefined && a.aciklama !== null) {
    if (typeof a.aciklama !== 'string' || (a.aciklama as string).length > 500) {
      throw new Error('aciklama geçersiz (max 500 karakter)')
    }
  }

  return {
    evrakTuruId: hasEvrakTuruId ? (a.evrakTuruId as number) : undefined,
    pendingEvrakTuru,
    donemBaslangic: a.donemBaslangic as string,
    donemSonu: a.donemSonu as string,
    evrakSayisi:
      a.evrakSayisi !== undefined && a.evrakSayisi !== null
        ? (a.evrakSayisi as number)
        : null,
    gizlilikSeviyesi: a.gizlilikSeviyesi as GizlilikSeviyesi | undefined,
    saklamaSuresiYil: a.saklamaSuresiYil as number,
    hazirlayan:
      a.hazirlayan !== undefined && a.hazirlayan !== null
        ? (a.hazirlayan as string)
        : null,
    aciklama:
      a.aciklama !== undefined && a.aciklama !== null
        ? (a.aciklama as string)
        : null,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ arsivNo: string }> }
) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { arsivNo } = await params
  if (!ARSIV_NO_REGEX.test(arsivNo)) {
    return badRequest(`Geçersiz arşiv numarası formatı: ${arsivNo}`)
  }

  let body: AltKoliInput
  try {
    body = validateAltKoli(await req.json())
  } catch (e) {
    return badRequest((e as Error).message)
  }

  const anaKoli = await prisma.arsivKoli.findUnique({
    where: { arsivNo },
    select: {
      id: true,
      bolumId: true,
      durum: true,
      imhaTarihi: true,
      tarihAraligiBaslangic: true,
      tarihAraligiSonu: true,
      _count: { select: { altKoliler: true } },
    },
  })
  if (!anaKoli) return notFound('Koli')

  if (!ctx.isSuperAdmin && anaKoli.bolumId !== ctx.arsivBolumId) {
    return forbidden('Bu koliye alt koli ekleme yetkiniz yok')
  }

  if (anaKoli.durum !== 'Aktif' && anaKoli.durum !== 'Arsivde') {
    return NextResponse.json(
      {
        error: `Bu koliye alt eklenemez: durum '${anaKoli.durum}'. Sadece 'Aktif' veya 'Arsivde' durumdaki kolilere alt eklenebilir.`,
      },
      { status: 409 }
    )
  }

  if (anaKoli._count.altKoliler >= 26) {
    return NextResponse.json(
      { error: "Bu koli'de alt koli sayısı 26'ya (A-Z) ulaştı" },
      { status: 409 }
    )
  }

  const aBas = new Date(body.donemBaslangic)
  const aSon = new Date(body.donemSonu)
  if (aBas > aSon) return badRequest('donemBaslangic > donemSonu olamaz')
  if (aBas < anaKoli.tarihAraligiBaslangic || aSon > anaKoli.tarihAraligiSonu) {
    return badRequest('Alt koli dönemi ana koli aralığının dışında')
  }

  // Mevcut evrakTuruId verildiyse erkenden valide et — pending ise transaction içinde yaratılacak.
  if (body.evrakTuruId !== undefined) {
    const evrakTuru = await prisma.arsivEvrakTuru.findUnique({
      where: { id: body.evrakTuruId },
      select: { id: true, bolumId: true, aktifMi: true },
    })
    if (!evrakTuru) return badRequest('evrakTuruId bulunamadı')
    if (evrakTuru.bolumId !== anaKoli.bolumId) {
      return badRequest("evrakTuruId bu koli'nin bolum'una ait değil")
    }
    if (!evrakTuru.aktifMi) return badRequest('evrakTuruId deaktif evrak türü')
  }

  const altImhaTarihi = calculateAltKoliImhaTarihi(aSon, body.saklamaSuresiYil)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (altImhaTarihi <= today) {
    return badRequest('Hesaplanan alt koli imhaTarihi bugünden ileri olmalı')
  }

  const anaImhaDegisti = altImhaTarihi.getTime() > anaKoli.imhaTarihi.getTime()
  const yeniAnaImha = anaImhaDegisti ? altImhaTarihi : anaKoli.imhaTarihi

  const ipAdresi = getClientIp(req)
  const kullaniciAjan = getUserAgent(req)

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Pending evrak türü yarat (varsa) — UI-2a-Ek2 paterni
      let resolvedEvrakTuruId: number
      let yeniEvrakTuru: { id: number; ad: string } | null = null

      if (body.pendingEvrakTuru) {
        try {
          const created = await tx.arsivEvrakTuru.create({
            data: {
              bolumId: anaKoli.bolumId,
              ad: body.pendingEvrakTuru.ad,
              varsayilanSaklamaYili: body.pendingEvrakTuru.varsayilanSaklamaYili,
              yasalDayanak: body.pendingEvrakTuru.yasalDayanak ?? null,
              aktifMi: true,
            },
          })
          resolvedEvrakTuruId = created.id
          yeniEvrakTuru = { id: created.id, ad: created.ad }

          await logArsivAktivite(tx, {
            userId: ctx.userId,
            islemTuru: 'EvrakTuruEkle',
            koliTipi: 'Ana',
            koliId: anaKoli.id,
            detay: {
              evrakTuruId: created.id,
              ad: created.ad,
              varsayilanSaklamaYili: created.varsayilanSaklamaYili,
              bolumId: anaKoli.bolumId,
              baglamArsivNo: arsivNo,
              baglamSebep: 'AltKoliEkle',
            },
            ipAdresi,
            kullaniciAjan,
          })
        } catch (e: unknown) {
          if ((e as { code?: string }).code === 'P2002') {
            throw new Error(
              `DUPLICATE_EVRAK_TURU:${body.pendingEvrakTuru.ad}`
            )
          }
          throw e
        }
      } else {
        resolvedEvrakTuruId = body.evrakTuruId!
      }

      // 2) Alt koli yarat
      const harf = await generateNextAltKoliHarf(anaKoli.id)
      const altArsivNo = `${arsivNo}-${harf}`
      const altQrKod = `${QR_BASE}/${altArsivNo}`

      const altKoli = await tx.arsivAltKoli.create({
        data: {
          altArsivNo,
          anaKoliId: anaKoli.id,
          harf,
          evrakTuruId: resolvedEvrakTuruId,
          donemBaslangic: aBas,
          donemSonu: aSon,
          evrakSayisi: body.evrakSayisi ?? null,
          gizlilikSeviyesi: (body.gizlilikSeviyesi ?? 'SirketIci') as GizlilikSeviyesi,
          saklamaSuresiYil: body.saklamaSuresiYil,
          imhaTarihi: altImhaTarihi,
          hazirlayan: body.hazirlayan ?? null,
          qrKod: altQrKod,
          aciklama: body.aciklama ?? null,
          olusturanKullaniciId: ctx.userId,
        },
      })

      // 3) Ana koli imhaTarihi extend (varsa) + log
      if (anaImhaDegisti) {
        await tx.arsivKoli.update({
          where: { id: anaKoli.id },
          data: {
            imhaTarihi: yeniAnaImha,
            guncelleyenKullaniciId: ctx.userId,
          },
        })

        await logArsivAktivite(tx, {
          userId: ctx.userId,
          islemTuru: 'Duzenle',
          koliId: anaKoli.id,
          koliTipi: 'Ana',
          detay: {
            arsivNo,
            sebep: 'Yeni alt koli ile imhaTarihi uzatıldı',
            changes: {
              imhaTarihi: {
                eski: anaKoli.imhaTarihi.toISOString(),
                yeni: yeniAnaImha.toISOString(),
              },
            },
          },
          ipAdresi,
          kullaniciAjan,
        })
      }

      // 4) AltKoliEkle log
      await logArsivAktivite(tx, {
        userId: ctx.userId,
        islemTuru: 'AltKoliEkle',
        koliId: altKoli.id,
        koliTipi: 'Alt',
        detay: {
          anaKoliId: anaKoli.id.toString(),
          anaArsivNo: arsivNo,
          altArsivNo,
          harf,
          evrakTuruId: resolvedEvrakTuruId,
          ...(yeniEvrakTuru && {
            yeniEvrakTuruEklendi: { id: yeniEvrakTuru.id, ad: yeniEvrakTuru.ad },
          }),
        },
        ipAdresi,
        kullaniciAjan,
      })

      return {
        altKoli,
        anaKoliImhaTarihi: yeniAnaImha,
        anaKoliGuncellendi: anaImhaDegisti,
        yeniEvrakTuru,
      }
    })

    return NextResponse.json(toJSONSafe(result), { status: 201 })
  } catch (e: unknown) {
    const msg = (e as Error).message ?? ''
    if (msg.startsWith('DUPLICATE_EVRAK_TURU:')) {
      const ad = msg.slice('DUPLICATE_EVRAK_TURU:'.length)
      return NextResponse.json(
        { error: `'${ad}' adlı evrak türü bu bölümde zaten mevcut` },
        { status: 400 }
      )
    }
    const code = (e as { code?: string }).code
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'Alt koli harf çakışması (yeniden dene)' },
        { status: 409 }
      )
    }
    if (code === 'P2003') {
      return NextResponse.json(
        { error: 'FK ihlali — evrakTuruId' },
        { status: 400 }
      )
    }
    throw e
  }
}
