import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'

/**
 * IFS Cloud'a PUANTAJ (DEVAM) yazımı — YALNIZ gün/saat alanları.
 * İK kararı: MAAŞ/ÜCRET bilgisi Hub'da tutulmaz ve IFS'e Hub'dan YAZILMAZ.
 * Bu modül ücret, ek ödeme (TEk..), kesinti (TKes..), net/brüt alanlarına ASLA dokunmaz;
 * sadece devam alanlarını (çalışma saati, fazla mesai, gece, gün sayıları) doldurur.
 *
 * DİKKAT — SUNUCUDA DOĞRULANACAK: Bulut oturumu IFS'e erişemez. Aşağıdaki projection/entity
 * ve alan adları (TrbrdIsyeriTahakkukHandling / TrbrdPuantaj) IFS metadata'sıyla teyit edilmeli.
 * Teyit edilene kadar gönderim KAPALIDIR: IFS_PUANTAJ_AKTARIM_AKTIF=1 verilmeden yazım yapılmaz
 * (yanlış alan adıyla canlı bordroya kayıt düşmesini önler). Teyit sonrası bu dosyadaki eşleme
 * düzeltilip env açılır.
 */

export interface IfsPuantajGirdi {
  empNo: string // = Hub sicil (IFS EmpNo)
  donem: string // "YYYY-MM"
  calismaSaat: number
  fazlaMesaiSaat: number
  geceSaat: number
  normalGun: number
  haftaTatiliGun: number
  resmiTatilGun: number
  izinGun: number
  raporGun: number
  eksikGun: number
}

/**
 * Hub alanı → IFS TrbrdPuantaj kolon adı eşlemesi. Para alanı YOK.
 * Değerler sunucuda IFS metadata'sından teyit edilecek (ör. ekrandaki "Saat" giriş tipi kolonları).
 */
export const IFS_ALAN_ESLEME: Record<keyof Omit<IfsPuantajGirdi, 'empNo' | 'donem'>, string> = {
  calismaSaat: 'NormalSaat',
  fazlaMesaiSaat: 'FazlaMesaiSaat',
  geceSaat: 'GeceVardiyaSaati',
  normalGun: 'NormalGun',
  haftaTatiliGun: 'HaftaTatiliGun',
  resmiTatilGun: 'ResmiTatilGun',
  izinGun: 'IzinGun',
  raporGun: 'RaporGun',
  eksikGun: 'EksikGun',
}

/** Gönderim env ile açık mı? Alan eşlemesi sunucuda doğrulanınca 1 yapılır. */
export function aktarimAktif(): boolean {
  return process.env.IFS_PUANTAJ_AKTARIM_AKTIF === '1'
}

/** IFS'e gidecek gövde — sadece devam alanları. Para alanı eklenmez. */
export function ifsPuantajPayload(g: IfsPuantajGirdi): Record<string, unknown> {
  const cfg = getIfsConfig()
  const [yil, ay] = g.donem.split('-')
  const body: Record<string, unknown> = {
    Company: cfg.company,
    EmpNo: g.empNo,
    PayYear: Number(yil),
    PayPeriod: Number(ay),
  }
  for (const [hubAlan, ifsKolon] of Object.entries(IFS_ALAN_ESLEME)) {
    body[ifsKolon] = g[hubAlan as keyof IfsPuantajGirdi]
  }
  return body
}

/** Projection kökü (.../projection/v1) — baseUrl'deki sondaki *.svc atılarak türetilir. */
function projectionRoot(): string {
  return getIfsConfig().baseUrl.replace(/\/[^/]+\.svc$/, '')
}

/**
 * Tek kişinin bir dönem puantajını IFS'e yazar (devam alanları). Hata fırlatır → çağıran yakalar.
 * SUNUCUDA doğrulanacak: entity set adı ve create/upsert davranışı.
 */
export async function ifsPuantajYaz(g: IfsPuantajGirdi): Promise<void> {
  if (!aktarimAktif()) {
    throw new Error(
      'IFS puantaj aktarımı kapalı — alan eşlemesi sunucuda doğrulanınca IFS_PUANTAJ_AKTARIM_AKTIF=1 ile açılır.',
    )
  }
  const token = await getIfsAccessToken()
  const body = ifsPuantajPayload(g)
  const res = await fetch(`${projectionRoot()}/TrbrdIsyeriTahakkukHandling.svc/TrbrdPuantajSet`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`IFS HTTP ${res.status}: ${text.slice(0, 800)}`)
  }
}
