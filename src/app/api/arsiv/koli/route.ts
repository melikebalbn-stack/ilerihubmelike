/**
 * POST /api/arsiv/koli
 *   Atomik ana koli + alt koliler oluşturma.
 *   - Yetki: kullanıcı kendi bolumId'sine; SUPER_ADMIN her bolum'a
 *   - Lokasyon kapasitesi kontrol edilir, doluluk artırılır (race-safe)
 *   - Alt koli sayısı 0..26
 *   - Alt koli imha tarihi = donemSonu + saklamaSuresiYil yıl (auto-calc)
 *   - Ana koli imha tarihi = max(alt koli imha) | body.imhaTarihi (alt koli yoksa)
 *   - Aktivite log: Olustur (ana) + AltKoliEkle (her alt için)
 *
 * GET /api/arsiv/koli
 *   Liste + filtre + sayfalama.
 *   - Default: kendi bolum'u; SUPER_ADMIN: tüm bolum'lar
 *   - Filtreler: bolumId, durum, lokasyonId, yil (arsivlemeTarihi yılı)
 *   - Sıralama: olusturmaTarihi DESC
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  unauthorized,
  forbidden,
  badRequest,
  canAccessBolum,
} from '@/lib/arsiv-auth'
import {
  logArsivAktivite,
  getClientIp,
  getUserAgent,
} from '@/lib/arsiv-aktivite'
import {
  calculateAltKoliImhaTarihi,
  calculateAnaKoliImhaTarihiFromAlt,
} from '@/lib/arsiv-tarih'
import { generateNextArsivNo } from '@/lib/arsiv-numara'
import { toJSONSafe } from '@/lib/arsiv-serialize'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────
// Manual validation (zod yüklü değil, projede mevcut convention)
// ─────────────────────────────────────────────────────────────────

const GIZLILIK_VALUES = ['KamuyaAcik', 'SirketIci', 'Gizli', 'CokGizli'] as const
type GizlilikSeviyesi = (typeof GIZLILIK_VALUES)[number]

const DURUM_VALUES = ['Aktif', 'ImhaYaklasti', 'ImhaEdildi', 'Arsivde'] as const
type DurumValue = (typeof DURUM_VALUES)[number]

type AltKoliInput = {
  evrakTuruId: number | null
  pendingEvrakTuruTempId: string | null
  donemBaslangic: string
  donemSonu: string
  evrakSayisi?: number | null
  gizlilikSeviyesi?: GizlilikSeviyesi
  saklamaSuresiYil: number
  hazirlayan?: string | null
  aciklama?: string | null
}

type PendingEvrakTuruInput = {
  tempId: string
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak?: string | null
}

type CreateKoliBody = {
  bolumId: number
  lokasyonId?: number | null
  tarihAraligiBaslangic: string
  tarihAraligiSonu: string
  imhaTarihi?: string
  sorumluKullaniciId: string
  aciklama?: string | null
  pendingEvrakTurleri?: PendingEvrakTuruInput[]
  altKoliler?: AltKoliInput[]
}

function parseDate(s: unknown, field: string): Date {
  if (typeof s !== 'string') throw new Error(`${field} string olmalı`)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) throw new Error(`${field} geçersiz tarih: ${s}`)
  return d
}

function validateCreateBody(raw: unknown): CreateKoliBody {
  if (!raw || typeof raw !== 'object') throw new Error('body obje olmalı')
  const b = raw as Record<string, unknown>

  if (!Number.isInteger(b.bolumId) || (b.bolumId as number) < 1) {
    throw new Error('bolumId geçersiz')
  }
  if (b.lokasyonId !== undefined && b.lokasyonId !== null) {
    if (!Number.isInteger(b.lokasyonId) || (b.lokasyonId as number) < 1) {
      throw new Error('lokasyonId geçersiz')
    }
  }
  if (typeof b.sorumluKullaniciId !== 'string' || b.sorumluKullaniciId.length < 1) {
    throw new Error('sorumluKullaniciId geçersiz')
  }
  parseDate(b.tarihAraligiBaslangic, 'tarihAraligiBaslangic')
  parseDate(b.tarihAraligiSonu, 'tarihAraligiSonu')
  if (b.imhaTarihi !== undefined) parseDate(b.imhaTarihi, 'imhaTarihi')
  if (b.aciklama !== undefined && b.aciklama !== null) {
    if (typeof b.aciklama !== 'string') throw new Error('aciklama string olmalı')
    if ((b.aciklama as string).length > 500) throw new Error('aciklama 500 karakter sınırı')
  }

  const altRaw = b.altKoliler
  if (altRaw !== undefined) {
    if (!Array.isArray(altRaw)) throw new Error('altKoliler dizi olmalı')
    if (altRaw.length > 26) throw new Error("Alt koli sayısı 26'yı geçemez (A-Z)")
    for (let i = 0; i < altRaw.length; i++) validateAltKoli(altRaw[i], i)
  }

  const pendingRaw = b.pendingEvrakTurleri
  if (pendingRaw !== undefined) {
    if (!Array.isArray(pendingRaw))
      throw new Error('pendingEvrakTurleri dizi olmalı')
    if (pendingRaw.length > 26)
      throw new Error("pendingEvrakTurleri en fazla 26 olabilir")
    const seenTempIds = new Set<string>()
    for (let i = 0; i < pendingRaw.length; i++) {
      validatePendingEvrakTuru(pendingRaw[i], i)
      const p = pendingRaw[i] as { tempId: string }
      if (seenTempIds.has(p.tempId)) {
        throw new Error(`pendingEvrakTurleri[${i}].tempId tekrar ediyor`)
      }
      seenTempIds.add(p.tempId)
    }
  }

  return b as unknown as CreateKoliBody
}

function validatePendingEvrakTuru(raw: unknown, idx: number): void {
  if (!raw || typeof raw !== 'object')
    throw new Error(`pendingEvrakTurleri[${idx}] obje olmalı`)
  const p = raw as Record<string, unknown>
  if (typeof p.tempId !== 'string' || p.tempId.length < 1) {
    throw new Error(`pendingEvrakTurleri[${idx}].tempId zorunlu`)
  }
  if (typeof p.ad !== 'string' || p.ad.trim().length < 3 || p.ad.length > 150) {
    throw new Error(`pendingEvrakTurleri[${idx}].ad 3-150 karakter olmalı`)
  }
  if (
    !Number.isInteger(p.varsayilanSaklamaYili) ||
    (p.varsayilanSaklamaYili as number) < 1 ||
    (p.varsayilanSaklamaYili as number) > 100
  ) {
    throw new Error(
      `pendingEvrakTurleri[${idx}].varsayilanSaklamaYili 1-100 olmalı`
    )
  }
  if (p.yasalDayanak !== undefined && p.yasalDayanak !== null) {
    if (typeof p.yasalDayanak !== 'string' || p.yasalDayanak.length > 250) {
      throw new Error(
        `pendingEvrakTurleri[${idx}].yasalDayanak en fazla 250 karakter`
      )
    }
  }
}

function validateAltKoli(raw: unknown, idx: number): void {
  if (!raw || typeof raw !== 'object') throw new Error(`altKoliler[${idx}] obje olmalı`)
  const a = raw as Record<string, unknown>

  // evrakTuruId XOR pendingEvrakTuruTempId — biri zorunlu, ikisi birlikte değil
  const hasId =
    a.evrakTuruId !== null &&
    a.evrakTuruId !== undefined &&
    Number.isInteger(a.evrakTuruId) &&
    (a.evrakTuruId as number) >= 1
  const hasPending =
    a.pendingEvrakTuruTempId !== null &&
    a.pendingEvrakTuruTempId !== undefined &&
    typeof a.pendingEvrakTuruTempId === 'string' &&
    (a.pendingEvrakTuruTempId as string).length > 0
  if (hasId && hasPending) {
    throw new Error(
      `altKoliler[${idx}]: evrakTuruId ve pendingEvrakTuruTempId aynı anda verilemez`
    )
  }
  if (!hasId && !hasPending) {
    throw new Error(
      `altKoliler[${idx}]: evrakTuruId veya pendingEvrakTuruTempId zorunlu`
    )
  }
  parseDate(a.donemBaslangic, `altKoliler[${idx}].donemBaslangic`)
  parseDate(a.donemSonu, `altKoliler[${idx}].donemSonu`)
  if (
    !Number.isInteger(a.saklamaSuresiYil) ||
    (a.saklamaSuresiYil as number) < 1 ||
    (a.saklamaSuresiYil as number) > 100
  ) {
    throw new Error(`altKoliler[${idx}].saklamaSuresiYil 1-100 olmalı`)
  }
  if (a.evrakSayisi !== undefined && a.evrakSayisi !== null) {
    if (!Number.isInteger(a.evrakSayisi) || (a.evrakSayisi as number) < 0) {
      throw new Error(`altKoliler[${idx}].evrakSayisi negatif olamaz`)
    }
  }
  if (a.gizlilikSeviyesi !== undefined) {
    if (!GIZLILIK_VALUES.includes(a.gizlilikSeviyesi as GizlilikSeviyesi)) {
      throw new Error(
        `altKoliler[${idx}].gizlilikSeviyesi geçersiz: ${String(a.gizlilikSeviyesi)}`
      )
    }
  }
  if (a.hazirlayan !== undefined && a.hazirlayan !== null) {
    if (typeof a.hazirlayan !== 'string' || (a.hazirlayan as string).length > 150) {
      throw new Error(`altKoliler[${idx}].hazirlayan geçersiz`)
    }
  }
  if (a.aciklama !== undefined && a.aciklama !== null) {
    if (typeof a.aciklama !== 'string' || (a.aciklama as string).length > 500) {
      throw new Error(`altKoliler[${idx}].aciklama geçersiz`)
    }
  }
}

const QR_BASE = 'https://arsiv.ilerigroup.com'

// ─────────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  let body: CreateKoliBody
  try {
    body = validateCreateBody(await req.json())
  } catch (e) {
    return badRequest((e as Error).message)
  }

  // 1. Bolum yetki kontrolü
  if (!canAccessBolum(ctx, body.bolumId)) {
    return forbidden("Bu bolum'a koli ekleyemezsiniz")
  }

  // 2. Tarih iş kuralı kontrolleri (DB CHECK'leri var ama net hata için ön-kontrol)
  const tBas = new Date(body.tarihAraligiBaslangic)
  const tSon = new Date(body.tarihAraligiSonu)
  if (tBas > tSon) {
    return badRequest('tarihAraligiBaslangic > tarihAraligiSonu olamaz')
  }

  // 3. Alt koli dönem aralığı ana koli aralığında mı?
  if (body.altKoliler && body.altKoliler.length > 0) {
    for (let i = 0; i < body.altKoliler.length; i++) {
      const a = body.altKoliler[i]
      const aBas = new Date(a.donemBaslangic)
      const aSon = new Date(a.donemSonu)
      if (aBas > aSon) {
        return badRequest(`altKoliler[${i}]: donemBaslangic > donemSonu`)
      }
      if (aBas < tBas || aSon > tSon) {
        return badRequest(
          `altKoliler[${i}] dönemi ana koli aralığının dışında`
        )
      }
    }
  }

  // 4. Sorumlu kullanıcı validasyonu (kullanıcı var, aktif)
  const sorumlu = await prisma.user.findUnique({
    where: { id: body.sorumluKullaniciId },
    select: { id: true, isActive: true },
  })
  if (!sorumlu || !sorumlu.isActive) {
    return badRequest('sorumluKullaniciId geçersiz veya pasif kullanıcı')
  }

  // 5. Lokasyon ön-kontrolü (race aşağıdaki transaction'da koruyor; bu sadece erken hata)
  if (body.lokasyonId !== undefined && body.lokasyonId !== null) {
    const lok = await prisma.arsivLokasyon.findUnique({
      where: { id: body.lokasyonId },
      select: { id: true, aktifMi: true, kapasite: true, mevcutDoluluk: true },
    })
    if (!lok) return badRequest('lokasyonId bulunamadı')
    if (!lok.aktifMi) return badRequest('Lokasyon deaktif')
    if (lok.mevcutDoluluk >= lok.kapasite) {
      return NextResponse.json(
        { error: 'Lokasyon dolu', lokasyonId: body.lokasyonId },
        { status: 409 }
      )
    }
  }

  // 6. Evrak türü doğrulama
  // 6a. Mevcut id'li alt kolilerin evrakTuruId'leri body.bolumId'ye ait + aktif
  if (body.altKoliler && body.altKoliler.length > 0) {
    const existingIds = body.altKoliler
      .map((a) => a.evrakTuruId)
      .filter((id): id is number => typeof id === 'number')
    if (existingIds.length > 0) {
      const evrakTurleri = await prisma.arsivEvrakTuru.findMany({
        where: { id: { in: [...new Set(existingIds)] } },
        select: { id: true, bolumId: true, aktifMi: true },
      })
      const idMap = new Map(evrakTurleri.map((e) => [e.id, e]))
      for (let i = 0; i < body.altKoliler.length; i++) {
        const id = body.altKoliler[i].evrakTuruId
        if (id === null) continue // pending, sonraki adımda
        const e = idMap.get(id)
        if (!e) return badRequest(`altKoliler[${i}].evrakTuruId bulunamadı`)
        if (e.bolumId !== body.bolumId) {
          return badRequest(
            `altKoliler[${i}].evrakTuruId bu bolum'a ait değil`
          )
        }
        if (!e.aktifMi) {
          return badRequest(`altKoliler[${i}].evrakTuruId deaktif evrak türü`)
        }
      }
    }
  }

  // 6b. Pending tempId'lerinin payload'da tanımlı olduğundan emin ol
  const pendingMap = new Map<string, PendingEvrakTuruInput>()
  for (const p of body.pendingEvrakTurleri ?? []) {
    pendingMap.set(p.tempId, p)
  }
  if (body.altKoliler && body.altKoliler.length > 0) {
    for (let i = 0; i < body.altKoliler.length; i++) {
      const tempId = body.altKoliler[i].pendingEvrakTuruTempId
      if (tempId !== null && tempId !== undefined && !pendingMap.has(tempId)) {
        return badRequest(
          `altKoliler[${i}].pendingEvrakTuruTempId payload'da tanımlı değil`
        )
      }
    }
  }

  // 7. Alt koli imha tarihlerini hesapla
  const altImhaTarihleri: Date[] = (body.altKoliler ?? []).map((a) =>
    calculateAltKoliImhaTarihi(new Date(a.donemSonu), a.saklamaSuresiYil)
  )

  // 8. Ana koli imha tarihi: alt varsa max, yoksa body
  let anaImhaTarihi: Date
  if (altImhaTarihleri.length > 0) {
    anaImhaTarihi = calculateAnaKoliImhaTarihiFromAlt(altImhaTarihleri)!
  } else {
    if (!body.imhaTarihi) {
      return badRequest(
        'Alt koli olmadığında ana koli imhaTarihi zorunlu'
      )
    }
    anaImhaTarihi = new Date(body.imhaTarihi)
  }
  // CHECK: imhaTarihi > arsivlemeTarihi (today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (anaImhaTarihi <= today) {
    return badRequest('imhaTarihi bugünden ileri olmalı')
  }

  // 9. arsivNo üret (transaction dışı: generateNextArsivNo kendi atomik UPSERT'ini yapar)
  const yil = today.getFullYear()
  let arsivNo: string
  try {
    arsivNo = await generateNextArsivNo(body.bolumId, yil)
  } catch (e) {
    // 999 sınırı veya başka hata
    return NextResponse.json(
      { error: (e as Error).message || 'Arşiv numarası üretilemedi' },
      { status: 409 }
    )
  }

  const qrKod = `${QR_BASE}/${arsivNo}`
  const ipAdresi = getClientIp(req)
  const kullaniciAjan = getUserAgent(req)

  // 10. Atomic transaction
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 10a. Lokasyon doluluk artırma — race-safe (mevcutDoluluk < kapasite koşulu ile)
        if (body.lokasyonId !== undefined && body.lokasyonId !== null) {
          const updated = await tx.$executeRaw`
            UPDATE arsiv_lokasyon
               SET mevcut_doluluk = mevcut_doluluk + 1
             WHERE id = ${body.lokasyonId}
               AND mevcut_doluluk < kapasite
               AND aktif_mi = TRUE
          `
          if (updated === 0) {
            throw new Error('LOKASYON_DOLU_VEYA_DEAKTIF')
          }
        }

        // 10b. Pending evrak türlerini yarat — tempId → real id map
        const tempIdToRealId = new Map<string, number>()
        const yeniEvrakTurleri: Array<{
          tempId: string
          id: number
          ad: string
        }> = []
        for (const p of body.pendingEvrakTurleri ?? []) {
          try {
            const created = await tx.arsivEvrakTuru.create({
              data: {
                bolumId: body.bolumId,
                ad: p.ad.trim(),
                varsayilanSaklamaYili: p.varsayilanSaklamaYili,
                yasalDayanak: p.yasalDayanak ?? null,
                aktifMi: true,
              },
            })
            tempIdToRealId.set(p.tempId, created.id)
            yeniEvrakTurleri.push({
              tempId: p.tempId,
              id: created.id,
              ad: created.ad,
            })
          } catch (e: unknown) {
            const code = (e as { code?: string }).code
            if (code === 'P2002') {
              throw new Error(
                `EVRAK_TURU_DUPLICATE:${p.ad}`
              )
            }
            throw e
          }
        }

        // 10c. Ana koli oluştur
        const anaKoli = await tx.arsivKoli.create({
          data: {
            arsivNo,
            bolumId: body.bolumId,
            lokasyonId: body.lokasyonId ?? null,
            tarihAraligiBaslangic: new Date(body.tarihAraligiBaslangic),
            tarihAraligiSonu: new Date(body.tarihAraligiSonu),
            imhaTarihi: anaImhaTarihi,
            qrKod,
            aciklama: body.aciklama ?? null,
            sorumluKullaniciId: body.sorumluKullaniciId,
            olusturanKullaniciId: ctx.userId,
          },
        })

        // 10d. Alt koliler — pending tempId varsa real id'ye resolve et
        const altKoliler = []
        for (let i = 0; i < (body.altKoliler ?? []).length; i++) {
          const a = body.altKoliler![i]
          const harf = String.fromCharCode(65 + i)
          const altArsivNo = `${arsivNo}-${harf}`
          const altQrKod = `${QR_BASE}/${altArsivNo}`
          const altImha = altImhaTarihleri[i]

          let resolvedEvrakTuruId: number
          if (a.pendingEvrakTuruTempId !== null && a.pendingEvrakTuruTempId !== undefined) {
            const real = tempIdToRealId.get(a.pendingEvrakTuruTempId)
            if (real === undefined) {
              throw new Error(
                `Pending evrak türü tempId resolve edilemedi: ${a.pendingEvrakTuruTempId}`
              )
            }
            resolvedEvrakTuruId = real
          } else if (a.evrakTuruId !== null && a.evrakTuruId !== undefined) {
            resolvedEvrakTuruId = a.evrakTuruId
          } else {
            throw new Error(
              `altKoliler[${i}]: evrakTuruId resolve edilemedi`
            )
          }

          const created = await tx.arsivAltKoli.create({
            data: {
              altArsivNo,
              anaKoliId: anaKoli.id,
              harf,
              evrakTuruId: resolvedEvrakTuruId,
              donemBaslangic: new Date(a.donemBaslangic),
              donemSonu: new Date(a.donemSonu),
              evrakSayisi: a.evrakSayisi ?? null,
              gizlilikSeviyesi: (a.gizlilikSeviyesi ??
                'SirketIci') as GizlilikSeviyesi,
              saklamaSuresiYil: a.saklamaSuresiYil,
              imhaTarihi: altImha,
              hazirlayan: a.hazirlayan ?? null,
              qrKod: altQrKod,
              aciklama: a.aciklama ?? null,
              olusturanKullaniciId: ctx.userId,
            },
          })
          altKoliler.push(created)
        }

        // 10e. Aktivite log: EvrakTuruEkle (her yeni evrak türü için)
        for (const ye of yeniEvrakTurleri) {
          await logArsivAktivite(tx, {
            userId: ctx.userId,
            islemTuru: 'EvrakTuruEkle',
            koliId: anaKoli.id,
            koliTipi: 'Ana',
            detay: {
              evrakTuruId: ye.id,
              ad: ye.ad,
              bolumId: body.bolumId,
              baglamArsivNo: arsivNo,
            },
            ipAdresi,
            kullaniciAjan,
          })
        }

        // 10f. Aktivite log: Olustur (ana)
        await logArsivAktivite(tx, {
          userId: ctx.userId,
          islemTuru: 'Olustur',
          koliId: anaKoli.id,
          koliTipi: 'Ana',
          detay: {
            arsivNo,
            bolumId: body.bolumId,
            altKoliSayisi: altKoliler.length,
            yeniEvrakTuruSayisi: yeniEvrakTurleri.length,
          },
          ipAdresi,
          kullaniciAjan,
        })

        // 10g. Aktivite log: AltKoliEkle (her alt için)
        for (const alt of altKoliler) {
          await logArsivAktivite(tx, {
            userId: ctx.userId,
            islemTuru: 'AltKoliEkle',
            koliId: alt.id,
            koliTipi: 'Alt',
            detay: {
              anaKoliId: anaKoli.id.toString(),
              anaArsivNo: arsivNo,
              altArsivNo: alt.altArsivNo,
              evrakTuruId: alt.evrakTuruId,
            },
            ipAdresi,
            kullaniciAjan,
          })
        }

        return { anaKoli, altKoliler, yeniEvrakTurleri }
      },
      {
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      }
    )

    return NextResponse.json(toJSONSafe(result), { status: 201 })
  } catch (e: unknown) {
    if ((e as Error).message === 'LOKASYON_DOLU_VEYA_DEAKTIF') {
      return NextResponse.json(
        { error: 'Lokasyon dolu veya deaktif (yarış koşulu)' },
        { status: 409 }
      )
    }
    const errMsg = (e as Error).message ?? ''
    if (errMsg.startsWith('EVRAK_TURU_DUPLICATE:')) {
      const ad = errMsg.slice('EVRAK_TURU_DUPLICATE:'.length)
      return NextResponse.json(
        {
          error: `'${ad}' adlı evrak türü bu bölümde zaten mevcut. Listeden seçin.`,
        },
        { status: 400 }
      )
    }
    const code = (e as { code?: string }).code
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'Arşiv numarası çakışması' },
        { status: 409 }
      )
    }
    if (code === 'P2003') {
      return NextResponse.json(
        { error: 'FK ihlali — bolumId/lokasyonId/evrakTuruId/sorumluKullaniciId' },
        { status: 400 }
      )
    }
    throw e
  }
}

// ─────────────────────────────────────────────────────────────────
// GET (liste)
// ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { searchParams } = new URL(req.url)

  const parseIntParam = (
    raw: string | null,
    defaultValue: number,
    min: number,
    max: number
  ): number => {
    if (raw === null || raw === '') return defaultValue
    const n = Number(raw)
    if (!Number.isInteger(n) || n < min) return defaultValue
    return Math.min(max, n)
  }
  const page = parseIntParam(searchParams.get('page'), 1, 1, 1_000_000)
  const limit = parseIntParam(searchParams.get('limit'), 20, 1, 100)
  const skip = (page - 1) * limit

  // bolumId filter
  const bolumIdParam = searchParams.get('bolumId')
  let bolumIdFilter: number | undefined
  if (bolumIdParam) {
    const parsed = Number(bolumIdParam)
    if (!Number.isInteger(parsed) || parsed < 1) return badRequest('bolumId geçersiz')
    if (!ctx.isSuperAdmin && parsed !== ctx.arsivBolumId) {
      return forbidden("Başka bolum'un kolilerini göremezsiniz")
    }
    bolumIdFilter = parsed
  } else if (!ctx.isSuperAdmin) {
    if (ctx.arsivBolumId === null) {
      return NextResponse.json({
        items: [],
        total: 0,
        page,
        limit,
        uyari: "Bolum'unuz arşiv sistemine tanımlı değil",
      })
    }
    bolumIdFilter = ctx.arsivBolumId
  }

  // durum filter
  const durumParam = searchParams.get('durum')
  if (durumParam && !DURUM_VALUES.includes(durumParam as DurumValue)) {
    return badRequest(`durum geçersiz: ${durumParam}`)
  }

  // lokasyonId filter
  const lokasyonIdParam = searchParams.get('lokasyonId')
  let lokasyonIdFilter: number | null | undefined
  if (lokasyonIdParam === 'null') {
    lokasyonIdFilter = null
  } else if (lokasyonIdParam) {
    const parsed = Number(lokasyonIdParam)
    if (!Number.isInteger(parsed) || parsed < 1) return badRequest('lokasyonId geçersiz')
    lokasyonIdFilter = parsed
  }

  // yil filter (arsivlemeTarihi yılına göre)
  const yilParam = searchParams.get('yil')
  let yilRange: { gte: Date; lt: Date } | undefined
  if (yilParam) {
    const yil = Number(yilParam)
    if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) {
      return badRequest('yil geçersiz')
    }
    yilRange = {
      gte: new Date(yil, 0, 1),
      lt: new Date(yil + 1, 0, 1),
    }
  }

  const where = {
    ...(bolumIdFilter !== undefined ? { bolumId: bolumIdFilter } : {}),
    ...(durumParam ? { durum: durumParam as DurumValue } : {}),
    ...(lokasyonIdFilter !== undefined ? { lokasyonId: lokasyonIdFilter } : {}),
    ...(yilRange ? { arsivlemeTarihi: yilRange } : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.arsivKoli.findMany({
      where,
      include: {
        bolum: { select: { id: true, ad: true, kod: true, renkHex: true } },
        lokasyon: { select: { id: true, depoNo: true, rafKodu: true, siraNo: true } },
        sorumlu: { select: { id: true, name: true, email: true } },
        _count: { select: { altKoliler: true } },
      },
      orderBy: { olusturmaTarihi: 'desc' },
      skip,
      take: limit,
    }),
    prisma.arsivKoli.count({ where }),
  ])

  return NextResponse.json(toJSONSafe({ items, total, page, limit }))
}
