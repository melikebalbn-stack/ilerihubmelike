/**
 * Rapor parametreleri — OData $filter yer tutucu çözümü ve Postgres parametre dizisi.
 */
import type { RaporParametreler } from './tipler'

export class RaporParametreHatasi extends Error {
  constructor(public readonly parametre: string, mesaj?: string) {
    super(mesaj ?? `Rapor parametresi tanımsız: '${parametre}'`)
    this.name = 'RaporParametreHatasi'
  }
}

const YER_TUTUCU = /\{p\.([A-Za-z_][A-Za-z0-9_]*)\}/g

/** Tek değeri OData literal'ine çevirir. Tek tırnak ikilenir (enjeksiyon), Date → ISO (tırnaksız). */
export function odataLiteral(ad: string, deger: unknown): string {
  if (deger === null || deger === undefined) throw new RaporParametreHatasi(ad)
  if (deger instanceof Date) {
    if (Number.isNaN(deger.getTime())) throw new RaporParametreHatasi(ad, `Rapor parametresi geçersiz tarih: '${ad}'`)
    return deger.toISOString()
  }
  if (typeof deger === 'number') {
    if (!Number.isFinite(deger)) throw new RaporParametreHatasi(ad, `Rapor parametresi sonlu sayı değil: '${ad}'`)
    return String(deger)
  }
  if (typeof deger === 'boolean') return deger ? 'true' : 'false'
  if (typeof deger === 'string') return `'${deger.replace(/'/g, "''")}'`
  throw new RaporParametreHatasi(ad, `Rapor parametresi desteklenmeyen tipte (${typeof deger}): '${ad}'`)
}

/** `{p.ad}` yer tutucularını parametre değerleriyle değiştirir. Tanımsız parametre → hata. */
export function filtreCoz(filtre: string, parametreler: RaporParametreler): string {
  return filtre.replace(YER_TUTUCU, (_, ad: string) => odataLiteral(ad, parametreler[ad]))
}

/** Postgres $1,$2… için değer dizisi — sıra tanımdaki `parametreler` listesidir. Tanımsız → hata. */
export function postgresParametreleri(adlar: string[] | undefined, parametreler: RaporParametreler): unknown[] {
  return (adlar ?? []).map((ad) => {
    if (!(ad in parametreler) || parametreler[ad] === undefined) throw new RaporParametreHatasi(ad)
    return parametreler[ad]
  })
}
