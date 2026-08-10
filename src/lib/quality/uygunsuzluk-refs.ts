/**
 * Uygunsuzluk referans kısıtı (KAL-KYT-15 Bölüm 2) — TEK KAYNAK.
 *
 * Neden Zod'da değil: kısıt DB'ye bakmayı gerektiriyor (`HataKodu.tip`), Zod
 * senkron/şekil doğrulaması yapıyor. Neden tek dosya: POST ve PATCH aynı kuralı
 * uygulasın, ıraksamasın (rma-query.ts'teki "iki uç ıraksamasın" gerekçesinin aynısı).
 *
 * Kural:
 *   tespitEdenBolumId, olusanBolumId  → HataKodu.tip = 'BOLUM'
 *   hataKoduId                        → HataKodu.tip = 'KOD'
 *
 * ⚠ Şema bunu ZORLAMIYOR — üç FK de yalnız HataKodu'ya bakıyor, tip ayrımı yok.
 *   Tek koruma bu fonksiyon.
 *
 * Tek sorgu: tüm id'ler toplanır, `findMany` ile bir kerede çekilir (satır sayısı
 * kadar sorgu atılmaz).
 */
import { prisma } from '@/lib/prisma'
import type { UygunsuzlukInput } from './uygunsuzluk-validators'

/** Doğrulama hatası: hangi alan, hangi satır. */
export type ReferansHatasi = { alan: string; mesaj: string }

export async function referanslariDogrula(d: UygunsuzlukInput): Promise<ReferansHatasi[]> {
  // { id -> beklenen tip } — aynı id birden çok alanda geçebilir, hepsi ayrı kontrol edilir.
  const beklenen: { id: string; tip: 'BOLUM' | 'KOD'; alan: string }[] = []

  if (d.tespitEdenBolumId) {
    beklenen.push({ id: d.tespitEdenBolumId, tip: 'BOLUM', alan: 'tespitEdenBolumId' })
  }
  d.satirlar.forEach((s, i) => {
    if (s.olusanBolumId) {
      beklenen.push({ id: s.olusanBolumId, tip: 'BOLUM', alan: `satirlar[${i}].olusanBolumId` })
    }
    if (s.hataKoduId) {
      beklenen.push({ id: s.hataKoduId, tip: 'KOD', alan: `satirlar[${i}].hataKoduId` })
    }
  })

  if (beklenen.length === 0) return []

  const kayitlar = await prisma.hataKodu.findMany({
    where: { id: { in: [...new Set(beklenen.map((b) => b.id))] } },
    select: { id: true, kod: true, tip: true },
  })
  const byId = new Map(kayitlar.map((k) => [k.id, k]))

  const hatalar: ReferansHatasi[] = []
  for (const b of beklenen) {
    const k = byId.get(b.id)
    if (!k) {
      hatalar.push({ alan: b.alan, mesaj: `${b.alan}: hata kodu bulunamadı` })
      continue
    }
    if (k.tip !== b.tip) {
      const bekleniyor = b.tip === 'BOLUM' ? 'bir bölüm' : 'bir hata kodu'
      const gelen = k.tip === 'BOLUM' ? 'bölüm' : 'hata kodu'
      hatalar.push({
        alan: b.alan,
        mesaj: `${b.alan}: ${bekleniyor} olmalı, ${k.kod} bir ${gelen}`,
      })
    }
  }
  return hatalar
}
