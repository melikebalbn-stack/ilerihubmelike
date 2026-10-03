'use client'

import { useCallback } from 'react'
import { servisIstek } from './servis-istek'

// Pasifleştir / Geri Al çağrısının TEK yeri. Yanıt okunur; hata olursa
// kullanıcıya Türkçe mesaj gösterilir (403 → "Bu işlem için yetkiniz yok.")
// ve liste yeniden YÜKLENMEZ (başarısız işlemi başarılıymış gibi göstermez).
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
  const pasiflestir = useCallback(
    async (id: string) => {
      setHata(null)
      const sonuc = await servisIstek(
        `/api/servis-yonetimi/${yol}/${id}/pasiflestir`,
        { method: 'POST' },
        'Pasifleştirilemedi.',
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

  return { pasiflestir, geriAl }
}
