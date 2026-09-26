/**
 * PDKS kart numarası — TEK dönüştürme noktası.
 *
 * Ham biçim (BizManager "Kart No", 8 hane metin): ilk 3 hane TESİS KODU, son 5 hane KART NO.
 * ASManager "118-63577" = BizManager "11863577". Okuyucular Wiegand 26: tesis 8 bit (0-255),
 * kart 16 bit (0-65535) — bu sınırları aşan ham değer W26'da temsil edilemez, REDDEDİLİR.
 *
 * Hikvision'a giden cardNo biçimi henüz kanıtlanmadı (Faz 0 test kartı) → SystemSetting
 * `pdks_kart_no_bicimi`:
 *   BIRLESIK     → 8 haneli ham değer ("11863577")               [varsayılan]
 *   W26_ONDALIK  → tesis * 65536 + kart, ondalık ("7796825")
 * PdksKart.kartNoHam = 8 haneli ham, PdksKart.kartNo = seçili biçimdeki değer.
 * Biçim değişirse TÜM kartların kartNo'su yeniden hesaplanıp panele yeniden yüklenmelidir.
 */

export type KartNoBicimi = 'BIRLESIK' | 'W26_ONDALIK'
export const KART_NO_BICIMLERI: readonly KartNoBicimi[] = ['BIRLESIK', 'W26_ONDALIK']
export const KART_NO_BICIMI_ANAHTARI = 'pdks_kart_no_bicimi'
export const KART_NO_BICIMI_VARSAYILAN: KartNoBicimi = 'BIRLESIK'

export const W26_TESIS_UST = 255
export const W26_KART_UST = 65535

export class KartNoHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'KartNoHatasi'
  }
}

export interface KartHam {
  /** 8 haneli ham değer — "11863577" */
  ham: string
  tesis: number
  kart: number
}

/**
 * Kullanıcı / Excel girdisini çözer. Kabul: "11863577", "118-63577", "118 63577".
 * Tire/boşluklu girişte tesis 1-3, kart 1-5 hane olabilir (sıfırla doldurulur).
 */
export function kartHamCoz(girdi: unknown): KartHam {
  const s = String(girdi ?? '').trim()
  let tesisS: string
  let kartS: string
  const ayrik = /^(\d{1,3})[\s-]+(\d{1,5})$/.exec(s)
  if (ayrik) {
    tesisS = ayrik[1].padStart(3, '0')
    kartS = ayrik[2].padStart(5, '0')
  } else if (/^\d{8}$/.test(s)) {
    tesisS = s.slice(0, 3)
    kartS = s.slice(3)
  } else {
    throw new KartNoHatasi(`Kart no 8 hane ("11863577") veya "118-63577" biçiminde olmalı: "${s.slice(0, 20)}"`)
  }
  const tesis = Number(tesisS)
  const kart = Number(kartS)
  if (tesis > W26_TESIS_UST) throw new KartNoHatasi(`Tesis kodu ${tesis} Wiegand 26 sınırını (0-${W26_TESIS_UST}) aşıyor`)
  if (kart > W26_KART_UST) throw new KartNoHatasi(`Kart no ${kart} Wiegand 26 sınırını (0-${W26_KART_UST}) aşıyor`)
  return { ham: tesisS + kartS, tesis, kart }
}

/** Ekranda gösterim: "118-63577" */
export function kartNoGoster(ham: string | null | undefined): string {
  if (!ham || !/^\d{8}$/.test(ham)) return ham ?? '—'
  return `${ham.slice(0, 3)}-${ham.slice(3)}`
}

/** Ham → panele gidecek cardNo (seçili biçimde). */
export function kartNoDonustur(ham: string, bicim: KartNoBicimi): string {
  const k = kartHamCoz(ham)
  switch (bicim) {
    case 'BIRLESIK':
      return k.ham
    case 'W26_ONDALIK':
      return String(k.tesis * 65536 + k.kart)
    default: {
      const x: never = bicim
      throw new KartNoHatasi(`Bilinmeyen kart no biçimi: ${String(x)}`)
    }
  }
}

export function kartNoBicimiMi(v: unknown): v is KartNoBicimi {
  return typeof v === 'string' && (KART_NO_BICIMLERI as readonly string[]).includes(v)
}

type AyarOkuyucu = {
  systemSetting: { findUnique(a: { where: { key: string }; select: { value: true } }): Promise<{ value: string } | null> }
}

/**
 * SystemSetting'ten biçimi okur. Kayıt YOKSA varsayılan (BIRLESIK). Kayıt var ama tanınmıyorsa
 * FIRLATIR (fail-closed): yanlış biçimle panele kart yüklemek, kartların hiç açmaması demektir.
 */
export async function kartNoBicimiOku(db: AyarOkuyucu): Promise<KartNoBicimi> {
  const ayar = await db.systemSetting.findUnique({ where: { key: KART_NO_BICIMI_ANAHTARI }, select: { value: true } })
  if (!ayar) return KART_NO_BICIMI_VARSAYILAN
  const v = ayar.value.trim()
  if (!kartNoBicimiMi(v)) {
    throw new KartNoHatasi(`SystemSetting ${KART_NO_BICIMI_ANAHTARI}="${v.slice(0, 20)}" tanınmıyor (BIRLESIK | W26_ONDALIK)`)
  }
  return v
}
