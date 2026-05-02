/**
 * GET /api/arsiv/koli/[arsivNo]
 *   Detay + alt koliler dahil.
 *   - Yetki: koli'nin bolum'u kullanıcının bolum'u olmalı; SUPER_ADMIN her bolum
 *   - URL'de arsivNo (string), BigInt id değil
 *   - 404: bulunamadı; 403: başka bolum
 *   - Aktivite log: Goruntule
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
import { toJSONSafe } from '@/lib/arsiv-serialize'

export const dynamic = 'force-dynamic'

const ARSIV_NO_REGEX = /^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}$/

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ arsivNo: string }> }
) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { arsivNo } = await params
  if (!ARSIV_NO_REGEX.test(arsivNo)) {
    return badRequest(`Geçersiz arşiv numarası formatı: ${arsivNo}`)
  }

  const koli = await prisma.arsivKoli.findUnique({
    where: { arsivNo },
    include: {
      bolum: { select: { id: true, ad: true, kod: true, renkHex: true } },
      lokasyon: true,
      sorumlu: { select: { id: true, name: true, email: true } },
      olusturan: { select: { id: true, name: true, email: true } },
      guncelleyen: { select: { id: true, name: true, email: true } },
      altKoliler: {
        include: {
          evrakTuru: {
            select: { id: true, ad: true, varsayilanSaklamaYili: true },
          },
        },
        orderBy: { harf: 'asc' },
      },
    },
  })

  if (!koli) return notFound('Koli')

  if (ctx.isSuperAdmin || koli.bolumId === ctx.arsivBolumId) {
    await logArsivAktivite(prisma, {
      userId: ctx.userId,
      islemTuru: 'Goruntule',
      koliId: koli.id,
      koliTipi: 'Ana',
      detay: { arsivNo },
      ipAdresi: getClientIp(req),
      kullaniciAjan: getUserAgent(req),
    })
    return NextResponse.json(toJSONSafe(koli))
  }

  return forbidden('Bu koliye erişim yetkiniz yok')
}

// ─────────────────────────────────────────────────────────────────
// PATCH /api/arsiv/koli/[arsivNo]
//   - Sadece aciklama, lokasyonId, durum güncellenebilir.
//   - sorumluKullaniciId, tarihAraligi, imhaTarihi, bolumId DEĞİŞMEZ.
//   - Lokasyon değişikliği: eski lokasyon −1, yeni +1 (atomik).
//   - Aktivite log: 'Duzenle', detay = { changes: { eski → yeni } }
// ─────────────────────────────────────────────────────────────────

const DURUM_VALID = ['Aktif', 'ImhaYaklasti', 'ImhaEdildi', 'Arsivde'] as const
type ArsivKoliDurum = (typeof DURUM_VALID)[number]

type PatchKoliBody = {
  aciklama?: string | null
  lokasyonId?: number | null
  durum?: ArsivKoliDurum
}

function validatePatchKoliBody(raw: unknown): PatchKoliBody {
  if (!raw || typeof raw !== 'object') throw new Error('body obje olmalı')
  const b = raw as Record<string, unknown>

  const out: PatchKoliBody = {}
  let hasAny = false

  if ('aciklama' in b) {
    hasAny = true
    if (b.aciklama === null) {
      out.aciklama = null
    } else if (typeof b.aciklama === 'string') {
      if ((b.aciklama as string).length > 500) throw new Error('aciklama 500 karakter sınırı')
      out.aciklama = b.aciklama as string
    } else {
      throw new Error('aciklama string veya null olmalı')
    }
  }

  if ('lokasyonId' in b) {
    hasAny = true
    if (b.lokasyonId === null) {
      out.lokasyonId = null
    } else if (Number.isInteger(b.lokasyonId) && (b.lokasyonId as number) >= 1) {
      out.lokasyonId = b.lokasyonId as number
    } else {
      throw new Error('lokasyonId pozitif integer veya null olmalı')
    }
  }

  if ('durum' in b) {
    hasAny = true
    if (typeof b.durum !== 'string' || !DURUM_VALID.includes(b.durum as ArsivKoliDurum)) {
      throw new Error(`durum geçersiz: ${String(b.durum)}`)
    }
    out.durum = b.durum as ArsivKoliDurum
  }

  if (!hasAny) throw new Error('En az bir field güncellenmelidir')
  return out
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ arsivNo: string }> }
) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { arsivNo } = await params
  if (!ARSIV_NO_REGEX.test(arsivNo)) {
    return badRequest(`Geçersiz arşiv numarası formatı: ${arsivNo}`)
  }

  let patch: PatchKoliBody
  try {
    patch = validatePatchKoliBody(await req.json())
  } catch (e) {
    return badRequest((e as Error).message)
  }

  const mevcut = await prisma.arsivKoli.findUnique({
    where: { arsivNo },
    select: {
      id: true,
      bolumId: true,
      lokasyonId: true,
      aciklama: true,
      durum: true,
    },
  })
  if (!mevcut) return notFound('Koli')

  if (!ctx.isSuperAdmin && mevcut.bolumId !== ctx.arsivBolumId) {
    return forbidden('Bu koliyi düzenleme yetkiniz yok')
  }

  if (patch.lokasyonId !== undefined && patch.lokasyonId !== null) {
    const lok = await prisma.arsivLokasyon.findUnique({
      where: { id: patch.lokasyonId },
      select: { id: true, aktifMi: true, kapasite: true, mevcutDoluluk: true },
    })
    if (!lok) return badRequest('lokasyonId bulunamadı')
    if (!lok.aktifMi) return badRequest('Lokasyon deaktif')
    if (
      patch.lokasyonId !== mevcut.lokasyonId &&
      lok.mevcutDoluluk >= lok.kapasite
    ) {
      return NextResponse.json(
        { error: 'Lokasyon dolu', lokasyonId: patch.lokasyonId },
        { status: 409 }
      )
    }
  }

  const changes: Record<string, { eski: unknown; yeni: unknown }> = {}
  if (patch.aciklama !== undefined && patch.aciklama !== mevcut.aciklama) {
    changes.aciklama = { eski: mevcut.aciklama, yeni: patch.aciklama }
  }
  if (patch.lokasyonId !== undefined && patch.lokasyonId !== mevcut.lokasyonId) {
    changes.lokasyonId = { eski: mevcut.lokasyonId, yeni: patch.lokasyonId }
  }
  if (patch.durum !== undefined && patch.durum !== mevcut.durum) {
    changes.durum = { eski: mevcut.durum, yeni: patch.durum }
  }

  if (Object.keys(changes).length === 0) {
    const koli = await prisma.arsivKoli.findUnique({
      where: { arsivNo },
      include: {
        bolum: { select: { id: true, ad: true, kod: true, renkHex: true } },
        lokasyon: { select: { id: true, depoNo: true, rafKodu: true, siraNo: true } },
      },
    })
    return NextResponse.json(toJSONSafe(koli))
  }

  const ipAdresi = getClientIp(req)
  const kullaniciAjan = getUserAgent(req)

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const lokasyonDegisti =
        patch.lokasyonId !== undefined && patch.lokasyonId !== mevcut.lokasyonId

      if (lokasyonDegisti) {
        if (mevcut.lokasyonId !== null) {
          const dec = await tx.$executeRaw`
            UPDATE arsiv_lokasyon
               SET mevcut_doluluk = mevcut_doluluk - 1
             WHERE id = ${mevcut.lokasyonId}
               AND mevcut_doluluk > 0
          `
          if (dec === 0) {
            console.warn(
              `[PATCH koli ${arsivNo}] Eski lokasyon ${mevcut.lokasyonId} doluluk azaltılamadı (zaten 0)`
            )
          }
        }

        if (patch.lokasyonId !== null) {
          const inc = await tx.$executeRaw`
            UPDATE arsiv_lokasyon
               SET mevcut_doluluk = mevcut_doluluk + 1
             WHERE id = ${patch.lokasyonId}
               AND mevcut_doluluk < kapasite
               AND aktif_mi = TRUE
          `
          if (inc === 0) {
            throw new Error('LOKASYON_DOLU_VEYA_DEAKTIF')
          }
        }
      }

      const updateData: Record<string, unknown> = {
        guncelleyenKullaniciId: ctx.userId,
      }
      if ('aciklama' in changes) updateData.aciklama = patch.aciklama
      if ('lokasyonId' in changes) updateData.lokasyonId = patch.lokasyonId
      if ('durum' in changes) updateData.durum = patch.durum

      const koli = await tx.arsivKoli.update({
        where: { id: mevcut.id },
        data: updateData,
        include: {
          bolum: { select: { id: true, ad: true, kod: true, renkHex: true } },
          lokasyon: { select: { id: true, depoNo: true, rafKodu: true, siraNo: true } },
        },
      })

      await logArsivAktivite(tx, {
        userId: ctx.userId,
        islemTuru: 'Duzenle',
        koliId: mevcut.id,
        koliTipi: 'Ana',
        detay: { arsivNo, changes },
        ipAdresi,
        kullaniciAjan,
      })

      return koli
    })

    return NextResponse.json(toJSONSafe(updated))
  } catch (e: unknown) {
    if ((e as Error).message === 'LOKASYON_DOLU_VEYA_DEAKTIF') {
      return NextResponse.json(
        { error: 'Yeni lokasyon dolu veya deaktif' },
        { status: 409 }
      )
    }
    const code = (e as { code?: string }).code
    if (code === 'P2025') return notFound('Koli')
    if (code === 'P2003') {
      return NextResponse.json(
        { error: 'FK ihlali — lokasyonId' },
        { status: 400 }
      )
    }
    throw e
  }
}
