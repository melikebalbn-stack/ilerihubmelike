'use client'

import { useCallback, useState } from 'react'
import type { BagimlilikGrubu } from '@/lib/servis-yonetimi/bagimlilik'
import { jsonIstek, servisIstek } from './servis-istek'

export type BagimlilikOnayBekleyen = {
  id: string
  mesaj: string
  bagimliliklar: BagimlilikGrubu[]
  /** true (yalnız firma, A5): onaylanırsa bağlı kayıtlar BİRLİKTE pasifleşir/kapanır. */
  zincirleme: boolean
  notlar: string[]
}

/** Firma geri alma önizlemesi (GET .../geri-al-onizleme). */
export type ZincirGeriAlOnizleme = {
  zincirIslemId: string | null
  geriAlinabilirArac: number
  geriAlinabilirSofor: number
  kapananAtama: number
}

export type ZincirGeriAlSecim = { id: string; onizleme: ZincirGeriAlOnizleme }

// Pasifleştir / Geri Al çağrısının TEK yeri. Yanıt okunur; hata olursa
// kullanıcıya Türkçe mesaj gösterilir (403 → "Bu işlem için yetkiniz yok.")
// ve liste yeniden YÜKLENMEZ (başarısız işlemi başarılıymış gibi göstermez).
//
// A4: sunucu "bağlı aktif kayıt var" derse (409 + BAGLI_KAYIT_VAR) pasifleştirme
// HEMEN uygulanmaz; bağlı kayıtlar kullanıcıya gösterilir (BagimlilikOnayDialog)
// ve yalnız açık onayla (`{ onay: true }`) yeniden istenir.
//
// `yol`: /api/servis-yonetimi/<yol>/<id>/pasiflestir|geri-al (örn. 'firma',
// 'guzergah-durak').
export function usePasifGeriAl({
  yol,
  yukle,
  setHata,
  zincirGeriAl = false,
}: {
  yol: string
  yukle: () => unknown
  setHata: (mesaj: string | null) => void
  /**
   * A5 (yalnız firma): geri alınırken önce önizleme istenir; firmayla BİRLİKTE
   * pasifleşen kayıt varsa kullanıcıya "birlikte geri alınsın mı?" sorulur.
   */
  zincirGeriAl?: boolean
}) {
  const [onayBekleyen, setOnayBekleyen] = useState<BagimlilikOnayBekleyen | null>(null)
  const [geriAlSecim, setGeriAlSecim] = useState<ZincirGeriAlSecim | null>(null)

  const pasiflestir = useCallback(
    async (id: string) => {
      setHata(null)
      const sonuc = await servisIstek(
        `/api/servis-yonetimi/${yol}/${id}/pasiflestir`,
        { method: 'POST' },
        'Pasifleştirilemedi.',
      )
      if (!sonuc.ok) {
        const govde = sonuc.json as
          | { kod?: unknown; bagimliliklar?: unknown; zincirleme?: unknown; notlar?: unknown }
          | null
        if (sonuc.status === 409 && govde?.kod === 'BAGLI_KAYIT_VAR' && Array.isArray(govde.bagimliliklar)) {
          setOnayBekleyen({
            id,
            mesaj: sonuc.mesaj,
            bagimliliklar: govde.bagimliliklar as BagimlilikGrubu[],
            zincirleme: govde.zincirleme === true,
            notlar: Array.isArray(govde.notlar) ? (govde.notlar as string[]) : [],
          })
          return
        }
        setHata(sonuc.mesaj)
        return
      }
      await yukle()
    },
    [yol, yukle, setHata],
  )

  const onayla = useCallback(async () => {
    if (!onayBekleyen) return
    const { id } = onayBekleyen
    setOnayBekleyen(null)
    setHata(null)
    const sonuc = await servisIstek(
      `/api/servis-yonetimi/${yol}/${id}/pasiflestir`,
      jsonIstek('POST', { onay: true }),
      'Pasifleştirilemedi.',
    )
    if (!sonuc.ok) {
      setHata(sonuc.mesaj)
      return
    }
    await yukle()
  }, [onayBekleyen, yol, yukle, setHata])

  const vazgec = useCallback(() => setOnayBekleyen(null), [])

  const geriAlGonder = useCallback(
    async (id: string, birlikte: boolean) => {
      setHata(null)
      const sonuc = await servisIstek(
        `/api/servis-yonetimi/${yol}/${id}/geri-al`,
        birlikte ? jsonIstek('POST', { zincirGeriAl: true }) : { method: 'POST' },
        'Geri alınamadı.',
      )
      if (!sonuc.ok) {
        setHata(sonuc.mesaj)
        return
      }
      await yukle()
    },
    [yol, yukle, setHata],
  )

  const geriAl = useCallback(
    async (id: string) => {
      if (zincirGeriAl) {
        setHata(null)
        const onizleme = await servisIstek(
          `/api/servis-yonetimi/${yol}/${id}/geri-al-onizleme`,
          undefined,
          'Geri alma önizlemesi alınamadı.',
        )
        if (!onizleme.ok) {
          setHata(onizleme.mesaj)
          return
        }
        const veri = (onizleme.json as { data?: ZincirGeriAlOnizleme } | null)?.data
        if (veri && veri.geriAlinabilirArac + veri.geriAlinabilirSofor > 0) {
          setGeriAlSecim({ id, onizleme: veri })
          return
        }
      }
      await geriAlGonder(id, false)
    },
    [zincirGeriAl, yol, geriAlGonder, setHata],
  )

  const zincirGeriAlSecimi = {
    secim: geriAlSecim,
    birlikte: async () => {
      if (!geriAlSecim) return
      const { id } = geriAlSecim
      setGeriAlSecim(null)
      await geriAlGonder(id, true)
    },
    yalnizFirma: async () => {
      if (!geriAlSecim) return
      const { id } = geriAlSecim
      setGeriAlSecim(null)
      await geriAlGonder(id, false)
    },
    vazgec: () => setGeriAlSecim(null),
  }

  return { pasiflestir, geriAl, bagimlilikOnay: { bekleyen: onayBekleyen, onayla, vazgec }, zincirGeriAlSecimi }
}
