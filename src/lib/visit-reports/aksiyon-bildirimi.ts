import { prisma } from '@/lib/prisma'

/**
 * Ziyaret raporu aksiyon bildirimi.
 *
 * Aksiyon sorumlusu eskiden serbest metindi ve kimseye haber gitmiyordu; kişi
 * kendisine iş atandığını ancak raporu açarsa görüyordu. Personel seçicisinden
 * gelen `responsibleSicilNo` ile sicil → Personnel → User zinciri kurulabildiği
 * için artık in-app bildirim gönderilebiliyor.
 *
 * Sicil yoksa (harici sorumlu, serbest metin) SESSİZCE atlanır — bu bir hata
 * değil, beklenen durum. Zincirin herhangi bir halkası boşsa da atlanır.
 */

export interface AksiyonBildirimGirdisi {
  description: string
  responsibleSicilNo?: string | null
  dueDate?: Date | string | null
}

export interface AksiyonBildirimSonucu {
  gonderildi: number
  siciliYok: number
  cozulemedi: number
}

function terminMetni(d: Date | string | null | undefined): string {
  if (!d) return 'termin yok'
  const t = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(t.getTime())) return 'termin yok'
  return `termin: ${t.toLocaleDateString('tr-TR')}`
}

export async function aksiyonBildirimiGonder(
  rapor: { id: string; reportNumber: string; companyName: string },
  aksiyonlar: AksiyonBildirimGirdisi[],
): Promise<AksiyonBildirimSonucu> {
  const sonuc: AksiyonBildirimSonucu = { gonderildi: 0, siciliYok: 0, cozulemedi: 0 }

  const siciller = [
    ...new Set(
      aksiyonlar
        .map((a) => (a.responsibleSicilNo ?? '').trim())
        .filter((s) => s !== ''),
    ),
  ]
  sonuc.siciliYok = aksiyonlar.length - aksiyonlar.filter((a) => (a.responsibleSicilNo ?? '').trim()).length
  if (siciller.length === 0) return sonuc

  try {
    const kisiler = await prisma.personnel.findMany({
      where: { sicilNo: { in: siciller }, aktif: true },
      select: { sicilNo: true, user: { select: { id: true } } },
    })
    const sicilToUser = new Map<string, string>()
    for (const k of kisiler) {
      if (k.sicilNo && k.user?.id) sicilToUser.set(k.sicilNo, k.user.id)
    }

    const link = `/forms/visit-reports/${rapor.id}`
    for (const a of aksiyonlar) {
      const sicil = (a.responsibleSicilNo ?? '').trim()
      if (!sicil) continue
      const userId = sicilToUser.get(sicil)
      if (!userId) {
        sonuc.cozulemedi += 1
        continue
      }
      await prisma.notification.create({
        data: {
          userId,
          title: `Ziyaret raporunda size aksiyon atandı`,
          message:
            `Ziyaret raporunda size aksiyon atandı: ${a.description} ` +
            `(${terminMetni(a.dueDate)}) — ${rapor.reportNumber} / ${rapor.companyName}`,
          type: 'INFO' as const,
          link,
        },
      })
      sonuc.gonderildi += 1
    }
  } catch (err) {
    console.error('[ziyaret-aksiyon] bildirim gönderilemedi:', err)
  }
  return sonuc
}

/**
 * Güncellemede YALNIZ yeni eklenen ya da sorumlusu değişen aksiyonlar bildirilir
 * — aksi halde her kayıt düzenlemesinde aynı kişiye tekrar bildirim giderdi.
 * Eşleştirme açıklama+sicil çifti üzerinden yapılır (aksiyonların stabil id'si
 * güncellemede korunmuyor: mevcut PUT tümünü silip yeniden yazıyor).
 */
export function yeniVeyaDegisenAksiyonlar(
  onceki: AksiyonBildirimGirdisi[],
  yeni: AksiyonBildirimGirdisi[],
): AksiyonBildirimGirdisi[] {
  const oncekiCiftler = new Set(
    onceki.map((a) => `${a.description.trim()}|${(a.responsibleSicilNo ?? '').trim()}`),
  )
  return yeni.filter(
    (a) => !oncekiCiftler.has(`${a.description.trim()}|${(a.responsibleSicilNo ?? '').trim()}`),
  )
}
