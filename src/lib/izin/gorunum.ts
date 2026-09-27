/**
 * EKİP / YÖNETİCİ görünümü — İZİN TÜRÜ ASLA GÖRÜNMEZ (Melih 27.09; KVKK: evlilik/ölüm/rapor kişiseldir).
 *
 * İV dışındaki her kitleye (yönetici onay ekranının "ekibin o haftası", ekip takvimi, talep formundaki
 * "ekipten izinli" noktası) giden izin günü bu fonksiyondan geçer. Çıktı KAPALI bir şekildir: yalnız
 * tarih, yarım gün ve onay durumu; etiket her türde (rapor dahil) "İzinli". Tür kodu/adı, açıklama,
 * gerekçe, belge, gün sayısı alanları ÜRETİLMEZ — girdi nesnesinde olsalar bile kopyalanmaz.
 *
 * Kural testle sabit: src/lib/izin/gorunum.test.ts (fonksiyon) + izin API rota taraması.
 */
export type EkipGunDurumu = 'IZINLI' | 'BEKLIYOR'

export interface EkipIzinGunu {
  personnelId: string
  tarih: string
  yarim: boolean
  durum: EkipGunDurumu
  etiket: 'İzinli'
}

export function ekipIzinGunu(g: {
  personnelId: string
  tarih: string | Date
  yarim?: string | null
  pay?: number | { toString(): string } | null
  talepDurumu: string
}): EkipIzinGunu | null {
  const bekliyor = g.talepDurumu === 'BEKLIYOR_YONETICI' || g.talepDurumu === 'BEKLIYOR_IV'
  if (!bekliyor && g.talepDurumu !== 'ONAYLANDI') return null
  if (g.pay !== undefined && g.pay !== null && Number(g.pay) === 0) return null // hafta sonu / tatil: izin günü değil
  return {
    personnelId: g.personnelId,
    tarih: typeof g.tarih === 'string' ? g.tarih.slice(0, 10) : g.tarih.toISOString().slice(0, 10),
    yarim: !!g.yarim,
    durum: bekliyor ? 'BEKLIYOR' : 'IZINLI',
    etiket: 'İzinli',
  }
}

/** Yanıt nesnesinde tür bilgisi sızıyor mu — rota testleri ve geliştirme kontrolü için. */
export const TUR_ALANLARI = ['tur', 'turId', 'turKod', 'turAd', 'kod', 'aciklama', 'gerekce', 'belge', 'belgeler', 'pdksEtiketi'] as const
export function turSiziyorMu(o: unknown): string | null {
  const bak = (x: unknown, yol: string): string | null => {
    if (Array.isArray(x)) {
      for (let i = 0; i < x.length; i++) {
        const r = bak(x[i], `${yol}[${i}]`)
        if (r) return r
      }
      return null
    }
    if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) {
        if ((TUR_ALANLARI as readonly string[]).includes(k)) return `${yol}.${k}`
        if (typeof v === 'string' && /rapor|evlilik|ölüm|olum|babalık|analık|ücretsiz|yıllık/i.test(v)) return `${yol}.${k}="${v}"`
        const r = bak(v, `${yol}.${k}`)
        if (r) return r
      }
    }
    return null
  }
  return bak(o, '$')
}
