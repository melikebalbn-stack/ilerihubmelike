'use client'

import { useCallback, useState } from 'react'
import type { BagimlilikGrubu } from '@/lib/servis-yonetimi/bagimlilik'
import { jsonIstek, servisIstek } from './servis-istek'

export type BagimlilikOnayBekleyen = {
  id: string
  mesaj: string
  bagimliliklar: BagimlilikGrubu[]
}

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
}: {
  yol: string
  yukle: () => unknown
  setHata: (mesaj: string | null) => void
}) {
  const [onayBekleyen, setOnayBekleyen] = useState<BagimlilikOnayBekleyen | null>(null)

  const pasiflestir = useCallback(
    async (id: string) => {
      setHata(null)
      const sonuc = await servisIstek(
        `/api/servis-yonetimi/${yol}/${id}/pasiflestir`,
        { method: 'POST' },
        'Pasifleştirilemedi.',
      )
      if (!sonuc.ok) {
        const govde = sonuc.json as { kod?: unknown; bagimliliklar?: unknown } | null
        if (sonuc.status === 409 && govde?.kod === 'BAGLI_KAYIT_VAR' && Array.isArray(govde.bagimliliklar)) {
          setOnayBekleyen({ id, mesaj: sonuc.mesaj, bagimliliklar: govde.bagimliliklar as BagimlilikGrubu[] })
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

  const geriAl = useCallback(
    async (id: string) => {
      setHata(null)
      const sonuc = await servisIstek(
        `/api/servis-yonetimi/${yol}/${id}/geri-al`,
        { method: 'POST' },
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

  return { pasiflestir, geriAl, bagimlilikOnay: { bekleyen: onayBekleyen, onayla, vazgec } }
}
