import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Avans dönem kilidi — TEK DOĞRULUK KAYNAĞI.
 *
 * Öncelik sırası: MANUEL DURUM > OTOMATİK VARSAYILAN.
 * - Manuel durum, İK'nın donem-kapat/route.ts üzerinden yaptığı en son
 *   KAPAT/AÇ işlemidir — bkz. `donemManuelDurum`. İK ne derse o olur,
 *   otomatik kural sadece manuel müdahale YOKSA devreye girer.
 * - Otomatik varsayılan (bkz. `donemOtomatikDurum`) sadece bir öneridir;
 *   İK'nın yetkisini hiçbir koşulda ezmez (Melih Bey'in tasarım düzeltmesi).
 *
 * Kilit UI'da değil, ENDPOINT'te uygulanır: kilitli bir döneme yazma/silme
 * denemesi 409 döner. Her uç bu dosyadaki `donemKilidiKontrol`'den geçsin,
 * uç içinde ayrı kontrol YAZILMASIN — kural tek yerde dursun.
 *
 * SİMETRİK: yeni talep girme/düzenleme VE Geri Çek AYNI kontrolü
 * (`donemKilidiKontrol`) kullanır — Geri Çek için ayrı, sadece manuel
 * duruma bakan bir kural YOKTUR (Melih Bey'in geri aldığı önceki karar).
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

export type DonemOtomatikDurum = 'ACIK' | 'KILITLI'

/**
 * Otomatik dönem durumu — sadece bir VARSAYILAN/ÖNERİ, manuel durumdan
 * BAĞIMSIZ hesaplanan saf fonksiyon. `bugun` enjekte edilebilir (test
 * için); vermezsen gerçek sistem saati kullanılır.
 *
 * Kural (donemYil/donemAy'ın kendi ayı baz alınarak, `bugun`ün ayı ile
 * karşılaştırılır):
 * - Dönem bugünün ayından ÖNCEyse (yıl/ay sırası küçükse)  → KILITLI
 * - Dönem bugünün ayından SONRAysa (yıl/ay sırası büyükse) → ACIK
 * - Dönem TAM bugünün ayıysa: günü 1-15 → ACIK, günü 16+ → KILITLI
 */
export function donemOtomatikDurum(
  donemYil: number,
  donemAy: number,
  bugun: Date = new Date()
): DonemOtomatikDurum {
  const donemSirasi = donemYil * 12 + donemAy
  const cariSirasi = bugun.getFullYear() * 12 + (bugun.getMonth() + 1)

  if (donemSirasi < cariSirasi) return 'KILITLI'
  if (donemSirasi > cariSirasi) return 'ACIK'

  return bugun.getDate() <= 15 ? 'ACIK' : 'KILITLI'
}

export type DonemManuelDurum = 'ACIK' | 'KAPALI' | null

/**
 * İK'nın bu dönem için en son yaptığı manuel işlem. `null` = hiç manuel
 * müdahale yok, otomatik varsayılan uygulanır.
 * - AvansDonemKapanis'ta satır varsa → 'KAPALI' (tek doğruluk kaynağı).
 * - Satır yoksa ama AvansDonemKapanisLog'daki en son kayıt 'AC' ise →
 *   'ACIK' (İK otomatik kilidi ezerek açmış, kalıcı override).
 * - Hiç log da yoksa → null.
 */
export async function donemManuelDurum(yil: number, ay: number): Promise<DonemManuelDurum> {
  const kapaliKayit = await prisma.avansDonemKapanis.findUnique({
    where: { yil_ay: { yil, ay } },
    select: { id: true },
  })
  if (kapaliKayit) return 'KAPALI'

  const sonLog = await prisma.avansDonemKapanisLog.findFirst({
    where: { yil, ay },
    orderBy: { tarih: 'desc' },
    select: { islem: true },
  })
  return sonLog?.islem === 'AC' ? 'ACIK' : null
}

export type DonemKilitSebebi = 'MANUEL' | 'OTOMATIK'

/**
 * Birleşik kilit durumu — YENİ TALEP GİRME/DÜZENLEME kontrolleri için.
 * Öncelik: manuel durum varsa o kazanır (ACIK→açık, KAPALI→kilitli).
 * Manuel müdahale YOKSA otomatik varsayılan uygulanır.
 */
export async function donemKilitliMi(
  yil: number,
  ay: number,
  bugun?: Date
): Promise<{ kilitli: boolean; sebep: DonemKilitSebebi | null }> {
  const manuel = await donemManuelDurum(yil, ay)
  if (manuel === 'KAPALI') return { kilitli: true, sebep: 'MANUEL' }
  if (manuel === 'ACIK') return { kilitli: false, sebep: null }

  // manuel === null: manuel müdahale yok, otomatik varsayılan uygulanır.
  if (donemOtomatikDurum(yil, ay, bugun) === 'ACIK') return { kilitli: false, sebep: null }
  return { kilitli: true, sebep: 'OTOMATIK' }
}

export async function donemAcikMi(yil: number, ay: number, bugun?: Date): Promise<boolean> {
  return !(await donemKilitliMi(yil, ay, bugun)).kilitli
}

export function donemKilitliMesaji(yil: number, ay: number, sebep: DonemKilitSebebi): string {
  if (sebep === 'MANUEL') return donemKapaliMesaji(yil, ay)
  return `${yil}/${ay} dönemi otomatik olarak kilitlenmiştir (ayın 16'sından itibaren) — düzenleme/geri çekme yapılamaz. İK gerekirse elle açabilir.`
}

/**
 * Dönem kilitliyse (manuel VEYA — manuel müdahale yoksa — otomatik
 * varsayılan) hazır 409 yanıtı, açıksa null döner. YENİ TALEP GİRME /
 * DÜZENLEME uçlarında kullanılır.
 * Kullanım:
 *   const kilit = await donemKilidiKontrol(yil, ay)
 *   if (kilit) return kilit
 * `bugun` opsiyoneldir, test için enjekte edilebilir.
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
