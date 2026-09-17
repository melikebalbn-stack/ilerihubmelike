import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Avans dönem kilidi — TEK DOĞRULUK KAYNAĞI.
 *
 * "Bu (yil, ay) dönemi kapatılmış mı?" sorusunun cevabı yalnızca
 * AvansDonemKapanis tablosunda bir satır olup olmamasıdır. Talebin ait olduğu
 * dönem (AvansTalebi.donemYil / donemAy) üzerinden bakılır — kaydın oluşturulma
 * tarihi (createdAt) DEĞİL. Böylece "Ocak'ta girilen Aralık avansı" gibi
 * durumlarda doğru dönem kilitlenir.
 *
 * Kilit UI'da değil, ENDPOINT'te uygulanır: kapalı bir döneme yazma/silme
 * denemesi 409 döner. Her uç bu dosyadaki `donemKilidiKontrol`'den geçsin,
 * uç içinde ayrı kontrol YAZILMASIN — kural tek yerde dursun.
 */

export async function donemKapaliMi(yil: number, ay: number): Promise<boolean> {
  const kayit = await prisma.avansDonemKapanis.findUnique({
    where: { yil_ay: { yil, ay } },
    select: { id: true },
  })
  return kayit !== null
}

export function donemKapaliMesaji(yil: number, ay: number): string {
  return `${yil}/${ay} dönemi kapatılmış, değişiklik yapılamaz.`
}

export type DonemOtomatikDurum = 'ACIK' | 'OTOMATIK_KILITLI' | 'KALICI_KAPALI'

/**
 * PROTOTİP — otomatik dönem durumu, manuel kapanıştan (AvansDonemKapanis)
 * BAĞIMSIZ, saf fonksiyon. `bugun` enjekte edilebilir (test için); vermezsen
 * gerçek sistem saati kullanılır.
 *
 * Kural (donemYil/donemAy'ın kendi ayı baz alınarak, `bugun`ün ayı ile
 * karşılaştırılır):
 * - Dönem bugünün ayından ÖNCEyse (yıl/ay sırası küçükse)  → KALICI_KAPALI
 * - Dönem bugünün ayından SONRAysa (yıl/ay sırası büyükse) → ACIK
 * - Dönem TAM bugünün ayıysa, günün kaçı olduğuna bakılır:
 *     1-15  → ACIK
 *     16-21 → OTOMATIK_KILITLI (geçici — düzenleme/geri çekme yok)
 *     22+   → KALICI_KAPALI
 */
export function donemOtomatikDurum(
  donemYil: number,
  donemAy: number,
  bugun: Date = new Date()
): DonemOtomatikDurum {
  const donemSirasi = donemYil * 12 + donemAy
  const cariSirasi = bugun.getFullYear() * 12 + (bugun.getMonth() + 1)

  if (donemSirasi < cariSirasi) return 'KALICI_KAPALI'
  if (donemSirasi > cariSirasi) return 'ACIK'

  const gun = bugun.getDate()
  if (gun <= 15) return 'ACIK'
  if (gun <= 21) return 'OTOMATIK_KILITLI'
  return 'KALICI_KAPALI'
}

export type DonemKilitSebebi = 'MANUEL' | DonemOtomatikDurum

/**
 * Birleşik kilit durumu: manuel kapanış (AvansDonemKapanis) VEYA otomatik
 * durum (OTOMATIK_KILITLI/KALICI_KAPALI) — ikisinden biri kilitliyse kilitli.
 * Manuel kapanış her zaman önce kontrol edilir (sebep önceliği: MANUEL).
 */
export async function donemKilitliMi(
  yil: number,
  ay: number,
  bugun?: Date
): Promise<{ kilitli: boolean; sebep: DonemKilitSebebi | null }> {
  if (await donemKapaliMi(yil, ay)) {
    return { kilitli: true, sebep: 'MANUEL' }
  }
  const otomatik = donemOtomatikDurum(yil, ay, bugun)
  if (otomatik === 'ACIK') return { kilitli: false, sebep: null }
  return { kilitli: true, sebep: otomatik }
}

export async function donemAcikMi(yil: number, ay: number, bugun?: Date): Promise<boolean> {
  return !(await donemKilitliMi(yil, ay, bugun)).kilitli
}

export function donemKilitliMesaji(yil: number, ay: number, sebep: DonemKilitSebebi): string {
  if (sebep === 'MANUEL') return donemKapaliMesaji(yil, ay)
  if (sebep === 'OTOMATIK_KILITLI') {
    return `${yil}/${ay} dönemi otomatik olarak kilitlenmiştir (ayın 16-21'i arası) — düzenleme/geri çekme yapılamaz.`
  }
  return `${yil}/${ay} dönemi kalıcı olarak kapanmıştır, değişiklik yapılamaz.`
}

/**
 * Dönem kilitliyse (manuel VEYA otomatik) hazır 409 yanıtı, açıksa null döner.
 * Kullanım:
 *   const kilit = await donemKilidiKontrol(yil, ay)
 *   if (kilit) return kilit
 * `bugun` opsiyoneldir, test için enjekte edilebilir — verilmezse gerçek
 * sistem saati kullanılır (mevcut çağıranların davranışı DEĞİŞMEZ).
 */
export async function donemKilidiKontrol(
  yil: number,
  ay: number,
  bugun?: Date
): Promise<NextResponse | null> {
  const durum = await donemKilitliMi(yil, ay, bugun)
  if (durum.kilitli && durum.sebep) {
    return NextResponse.json({ error: donemKilitliMesaji(yil, ay, durum.sebep) }, { status: 409 })
  }
  return null
}
