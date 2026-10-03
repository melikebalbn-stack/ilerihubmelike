import { normalizeTr } from '@/lib/normalize-tr'
import type { KapasiteGuzergahSatiri } from '@/lib/servis-yonetimi/kapasite'

// Servis Paneli tablosunda arama ve sıralama (SADECE sunum). Sayılar kapasite motorundan
// gelir; burada hesap yok. Türkçe: arama normalizeTr (İ/ı/Ş/Ğ/Ü/Ö/Ç, büyük/küçük harf
// duyarsız), sıralama tr-TR collator (Ç, Ğ, İ, Ö, Ş, Ü doğru yerde).

export type PanelSiralamaAlani = 'guzergah' | 'koltuk' | 'personel' | 'bos' | 'doluluk' | 'durum'
export type PanelSiralama = { alan: PanelSiralamaAlani; yon: 'asc' | 'desc' }

const trCollator = new Intl.Collator('tr-TR', { sensitivity: 'base', numeric: true })

const DURUM_ONEMI: Record<string, number> = { ASIM: 0, ARAC_YOK: 1, DOLMAK_UZERE: 2, UYGUN: 3 }

/** Arama: güzergâh kodu, adı ve plaka. Boş arama = hepsi. */
export function panelAramaEslesir(satir: KapasiteGuzergahSatiri, arama: string): boolean {
  const q = normalizeTr(arama.trim())
  if (!q) return true
  return [satir.kod, satir.ad, ...satir.araclar].some((m) => normalizeTr(m).includes(q))
}

/** Sayısal sıralamada "—" (değeri olmayan) satırlar yönden bağımsız SONA gider. */
function karsilastir(a: KapasiteGuzergahSatiri, b: KapasiteGuzergahSatiri, alan: PanelSiralamaAlani): number {
  const sayisal = (x: number | null, y: number | null) => {
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    return x - y
  }
  const aracsiz = (s: KapasiteGuzergahSatiri) => s.ozet.durum === 'ARAC_YOK'
  switch (alan) {
    case 'guzergah':
      return trCollator.compare(`${a.kod} ${a.ad}`, `${b.kod} ${b.ad}`)
    case 'koltuk':
      return sayisal(aracsiz(a) ? null : a.ozet.kapasite, aracsiz(b) ? null : b.ozet.kapasite)
    case 'personel':
      return a.ozet.atananPersonelSayisi - b.ozet.atananPersonelSayisi
    case 'bos':
      return sayisal(aracsiz(a) ? null : a.ozet.bosKoltuk, aracsiz(b) ? null : b.ozet.bosKoltuk)
    case 'doluluk':
      return sayisal(a.ozet.dolulukOrani, b.ozet.dolulukOrani)
    case 'durum':
      return DURUM_ONEMI[a.ozet.durum] - DURUM_ONEMI[b.ozet.durum]
  }
}

export function panelSatirlariFiltreleSirala(
  satirlar: KapasiteGuzergahSatiri[],
  arama: string,
  siralama: PanelSiralama | null,
): KapasiteGuzergahSatiri[] {
  const liste = satirlar.filter((s) => panelAramaEslesir(s, arama))
  if (!siralama) return liste
  const yon = siralama.yon === 'asc' ? 1 : -1
  const sayisalAlan = siralama.alan === 'koltuk' || siralama.alan === 'bos' || siralama.alan === 'doluluk'
  return [...liste].sort((a, b) => {
    if (sayisalAlan) {
      // değeri olmayanlar (araç yok / paydasız) her yönde sona
      const aBos = siralama.alan === 'doluluk' ? a.ozet.dolulukOrani === null : a.ozet.durum === 'ARAC_YOK'
      const bBos = siralama.alan === 'doluluk' ? b.ozet.dolulukOrani === null : b.ozet.durum === 'ARAC_YOK'
      if (aBos !== bBos) return aBos ? 1 : -1
    }
    return karsilastir(a, b, siralama.alan) * yon
  })
}
