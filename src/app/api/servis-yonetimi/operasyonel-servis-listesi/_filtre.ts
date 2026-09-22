// MASTER Madde 29 — liste ve export uçları AYNI filtre ayrıştırma/doğrulama
// mantığını paylaşır (rule 6 — mantık ikinci kez yazılmasın). Next.js
// route-dosyası KURALLARINA tabi olmasın diye alt çizgiyle başlıyor (route
// olarak algılanmaz), yalnız bu klasördeki iki route'un iç kullanımı için.
import type { OperasyonelServisListesiFiltre } from '@/lib/servis-yonetimi/operasyonel-servis-listesi'

export type FiltreAyiklamaSonucu =
  | { ok: true; filtre: OperasyonelServisListesiFiltre }
  | { ok: false; mesaj: string }

export function operasyonelListeFiltreleriniAyikla(searchParams: URLSearchParams): FiltreAyiklamaSonucu {
  const filtre: OperasyonelServisListesiFiltre = {}

  const tarihParam = searchParams.get('tarih')
  if (tarihParam) {
    const tarih = new Date(tarihParam)
    if (Number.isNaN(tarih.getTime())) {
      return { ok: false, mesaj: 'Geçersiz tarih.' }
    }
    filtre.tarih = tarihParam
  }

  const guzergahId = searchParams.get('guzergahId')
  if (guzergahId) filtre.guzergahId = guzergahId

  const firmaId = searchParams.get('firmaId')
  if (firmaId) filtre.firmaId = firmaId

  const durakId = searchParams.get('durakId')
  if (durakId) filtre.durakId = durakId

  const bolum = searchParams.get('bolum')
  if (bolum) filtre.bolum = bolum

  const yerleskeId = searchParams.get('yerleskeId')
  if (yerleskeId) filtre.yerleskeId = yerleskeId

  return { ok: true, filtre }
}
