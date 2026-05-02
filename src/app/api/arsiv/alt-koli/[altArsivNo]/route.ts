/**
 * PATCH /api/arsiv/alt-koli/[altArsivNo]
 *   Sadece metadata: aciklama, hazirlayan, evrakSayisi, gizlilikSeviyesi
 *   Sabit (değişmez): evrakTuruId, donemBaslangic, donemSonu, saklamaSuresiYil,
 *                     imhaTarihi, harf, altArsivNo, anaKoliId
 *   Sebep: bu alanlar imha hesabını ve ana koli imhaTarihi'ni etkiler.
 *   Düzeltme gerekirse sil + yeniden ekle.
 *
 * DELETE /api/arsiv/alt-koli/[altArsivNo]
 *   Hard delete (alt koli durum'u yok).
 *   - Ana koli durum 'ImhaEdildi' ise yasak.
 *   - Silme sonrası kalan alt'ların max imhaTarihi → yeni ana imhaTarihi.
 *   - Aktivite log: AltKoliCikar + (ana imhaTarihi değişti ise Duzenle)
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
import { calculateAnaKoliImhaTarihiFromAlt } from '@/lib/arsiv-tarih'
import { toJSONSafe } from '@/lib/arsiv-serialize'

export const dynamic = 'force-dynamic'

const ALT_ARSIV_NO_REGEX = /^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}-[A-Z]$/
const GIZLILIK_VALUES = ['KamuyaAcik', 'SirketIci', 'Gizli', 'CokGizli'] as const
type GizlilikSeviyesi = (typeof GIZLILIK_VALUES)[number]

type PatchAltKoliBody = {
  aciklama?: string | null
  hazirlayan?: string | null
  evrakSayisi?: number | null
  gizlilikSeviyesi?: GizlilikSeviyesi
}

function validatePatchAltKoli(raw: unknown): PatchAltKoliBody {
  if (!raw || typeof raw !== 'object') throw new Error('body obje olmalı')
  const b = raw as Record<string, unknown>
  const out: PatchAltKoliBody = {}
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

  if ('hazirlayan' in b) {
    hasAny = true
    if (b.hazirlayan === null) {
      out.hazirlayan = null
    } else if (typeof b.hazirlayan === 'string') {
      if ((b.hazirlayan as string).length > 150) throw new Error('hazirlayan 150 karakter sınırı')
      out.hazirlayan = b.hazirlayan as string
    } else {
      throw new Error('hazirlayan string veya null olmalı')
    }
  }

  if ('evrakSayisi' in b) {
    hasAny = true
    if (b.evrakSayisi === null) {
      out.evrakSayisi = null
    } else if (Number.isInteger(b.evrakSayisi) && (b.evrakSayisi as number) >= 0) {
      out.evrakSayisi = b.evrakSayisi as number
    } else {
      throw new Error('evrakSayisi non-negative integer veya null olmalı')
    }
  }

  if ('gizlilikSeviyesi' in b) {
    hasAny = true
    if (
      typeof b.gizlilikSeviyesi !== 'string' ||
      !GIZLILIK_VALUES.includes(b.gizlilikSeviyesi as GizlilikSeviyesi)
    ) {
      throw new Error(`gizlilikSeviyesi geçersiz: ${String(b.gizlilikSeviyesi)}`)
    }
    out.gizlilikSeviyesi = b.gizlilikSeviyesi as GizlilikSeviyesi
  }

  if (!hasAny) throw new Error('En az bir field güncellenmelidir')
  return out
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ altArsivNo: string }> }
) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { altArsivNo } = await params
  if (!ALT_ARSIV_NO_REGEX.test(altArsivNo)) {
    return badRequest(`Geçersiz alt arşiv numarası formatı: ${altArsivNo}`)
  }

  let patch: PatchAltKoliBody
  try {
    patch = validatePatchAltKoli(await req.json())
  } catch (e) {
    return badRequest((e as Error).message)
  }

  const mevcut = await prisma.arsivAltKoli.findUnique({
    where: { altArsivNo },
    select: {
      id: true,
      anaKoliId: true,
      aciklama: true,
      hazirlayan: true,
      evrakSayisi: true,
      gizlilikSeviyesi: true,
      anaKoli: { select: { bolumId: true, arsivNo: true } },
    },
  })
  if (!mevcut) return notFound('Alt koli')

  if (!ctx.isSuperAdmin && mevcut.anaKoli.bolumId !== ctx.arsivBolumId) {
    return forbidden('Bu alt koliyi düzenleme yetkiniz yok')
  }

  const changes: Record<string, { eski: unknown; yeni: unknown }> = {}
  if (patch.aciklama !== undefined && patch.aciklama !== mevcut.aciklama) {
    changes.aciklama = { eski: mevcut.aciklama, yeni: patch.aciklama }
  }
  if (patch.hazirlayan !== undefined && patch.hazirlayan !== mevcut.hazirlayan) {
    changes.hazirlayan = { eski: mevcut.hazirlayan, yeni: patch.hazirlayan }
  }
  if (patch.evrakSayisi !== undefined && patch.evrakSayisi !== mevcut.evrakSayisi) {
    changes.evrakSayisi = { eski: mevcut.evrakSayisi, yeni: patch.evrakSayisi }
  }
  if (
    patch.gizlilikSeviyesi !== undefined &&
    patch.gizlilikSeviyesi !== mevcut.gizlilikSeviyesi
  ) {
    changes.gizlilikSeviyesi = {
      eski: mevcut.gizlilikSeviyesi,
      yeni: patch.gizlilikSeviyesi,
    }
  }

  if (Object.keys(changes).length === 0) {
    const altKoli = await prisma.arsivAltKoli.findUnique({ where: { altArsivNo } })
    return NextResponse.json(toJSONSafe(altKoli))
  }

  const ipAdresi = getClientIp(req)
  const kullaniciAjan = getUserAgent(req)

  const updateData: Record<string, unknown> = {
    guncelleyenKullaniciId: ctx.userId,
  }
  if ('aciklama' in changes) updateData.aciklama = patch.aciklama
  if ('hazirlayan' in changes) updateData.hazirlayan = patch.hazirlayan
  if ('evrakSayisi' in changes) updateData.evrakSayisi = patch.evrakSayisi
  if ('gizlilikSeviyesi' in changes) updateData.gizlilikSeviyesi = patch.gizlilikSeviyesi

  const updated = await prisma.$transaction(async (tx) => {
    const altKoli = await tx.arsivAltKoli.update({
      where: { id: mevcut.id },
      data: updateData,
    })

    await logArsivAktivite(tx, {
      userId: ctx.userId,
      islemTuru: 'Duzenle',
      koliId: mevcut.id,
      koliTipi: 'Alt',
      detay: {
        altArsivNo,
        anaKoliId: mevcut.anaKoliId.toString(),
        anaArsivNo: mevcut.anaKoli.arsivNo,
        changes,
      },
      ipAdresi,
      kullaniciAjan,
    })

    return altKoli
  })

  return NextResponse.json(toJSONSafe(updated))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ altArsivNo: string }> }
) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { altArsivNo } = await params
  if (!ALT_ARSIV_NO_REGEX.test(altArsivNo)) {
    return badRequest(`Geçersiz alt arşiv numarası formatı: ${altArsivNo}`)
  }

  const mevcut = await prisma.arsivAltKoli.findUnique({
    where: { altArsivNo },
    select: {
      id: true,
      anaKoliId: true,
      imhaTarihi: true,
      anaKoli: {
        select: {
          id: true,
          bolumId: true,
          durum: true,
          imhaTarihi: true,
          arsivNo: true,
        },
      },
    },
  })
  if (!mevcut) return notFound('Alt koli')

  if (!ctx.isSuperAdmin && mevcut.anaKoli.bolumId !== ctx.arsivBolumId) {
    return forbidden('Bu alt koliyi silme yetkiniz yok')
  }

  if (mevcut.anaKoli.durum === 'ImhaEdildi') {
    return NextResponse.json(
      { error: "İmha edilmiş ana koli'den alt silinemez" },
      { status: 409 }
    )
  }

  const ipAdresi = getClientIp(req)
  const kullaniciAjan = getUserAgent(req)

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.arsivAltKoli.delete({ where: { id: mevcut.id } })

      const kalan = await tx.arsivAltKoli.findMany({
        where: { anaKoliId: mevcut.anaKoliId },
        select: { imhaTarihi: true },
      })
      const yeniMaxAltImha = calculateAnaKoliImhaTarihiFromAlt(
        kalan.map((k) => k.imhaTarihi)
      )

      let anaGuncellendi = false
      let yeniAnaImha = mevcut.anaKoli.imhaTarihi
      if (
        yeniMaxAltImha !== null &&
        yeniMaxAltImha.getTime() !== mevcut.anaKoli.imhaTarihi.getTime()
      ) {
        anaGuncellendi = true
        yeniAnaImha = yeniMaxAltImha
        await tx.arsivKoli.update({
          where: { id: mevcut.anaKoliId },
          data: {
            imhaTarihi: yeniAnaImha,
            guncelleyenKullaniciId: ctx.userId,
          },
        })

        await logArsivAktivite(tx, {
          userId: ctx.userId,
          islemTuru: 'Duzenle',
          koliId: mevcut.anaKoliId,
          koliTipi: 'Ana',
          detay: {
            arsivNo: mevcut.anaKoli.arsivNo,
            sebep: 'Alt koli silinmesi sonrası imhaTarihi yeniden hesaplandı',
            changes: {
              imhaTarihi: {
                eski: mevcut.anaKoli.imhaTarihi.toISOString(),
                yeni: yeniAnaImha.toISOString(),
              },
            },
          },
          ipAdresi,
          kullaniciAjan,
        })
      }

      await logArsivAktivite(tx, {
        userId: ctx.userId,
        islemTuru: 'AltKoliCikar',
        koliId: mevcut.id,
        koliTipi: 'Alt',
        detay: {
          altArsivNo,
          anaKoliId: mevcut.anaKoliId.toString(),
          anaArsivNo: mevcut.anaKoli.arsivNo,
          silinenAltImhaTarihi: mevcut.imhaTarihi.toISOString(),
          kalanAltSayisi: kalan.length,
          anaKoliImhaTarihiGuncellendi: anaGuncellendi,
        },
        ipAdresi,
        kullaniciAjan,
      })

      return {
        silinen: { altArsivNo },
        anaKoliImhaTarihi: yeniAnaImha,
        anaKoliGuncellendi: anaGuncellendi,
        kalanAltSayisi: kalan.length,
      }
    })

    return NextResponse.json(toJSONSafe(result))
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'P2025') return notFound('Alt koli')
    throw e
  }
}
