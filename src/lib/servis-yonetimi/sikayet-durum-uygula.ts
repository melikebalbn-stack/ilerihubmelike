// MASTER Madde 46 — Şikâyet durum geçişinin UYGULANMASI (Adım 3).
//
// Adım 1 (sikayet-durum.ts) kuralı taşır, bu dosya onu veritabanına uygular.
// Kural burada TEKRAR EDİLMEZ: geçiş izni ve alan tutarlılığı gecisiUygula()
// üzerinden sorulur (rule 6).
//
// Tarihçe yazımı için modülün mevcut yazıcısı kullanılır —
// `kaydetIslemGecmisi` (audit.ts), 13 tanım modelinin de kullandığı aynı
// fonksiyon. İkinci bir yazıcı kurulmadı.
//
// 🔴 FAIL-CLOSED: update ile tarihçe AYNI $transaction içinde ve tarihçe
// yazımı HATA YUTMAZ. Tarihçe yazılamazsa geçiş de geri alınır. Bu, emsalin
// (service.ts) zaten uyguladığı desendir — orada audit çağrısı da
// $transaction içinde ve dosyada tek bir try/catch yok. Madde 49'daki
// fail-open audit (hata yutan, uç yine 200 dönen) desenine BİLEREK
// uyulmuyor: orada iz sessizce hiç yazılmamıştı ve bunu ancak pozitif bir
// test yakalamıştı (Ders 76). Madde 20 tarihçeyi sonradan eklenen bir
// özellik saymıyor.
import { prisma } from '@/lib/prisma'
import type { Prisma, ServisSikayetDurumu } from '@/generated/prisma'
import { kaydetIslemGecmisi, degisenAlanlar } from './audit'
import { gecisiUygula, type SikayetDurumAlanlari } from './sikayet-durum'
import { SikayetError } from './sikayet'

/**
 * Tarihçeye yazılacak alanlar. Yalnız duruma bağlı olanlar — tam satır
 * DEĞİL (KVKK/madde 23, audit.ts'teki degisenAlanlar sözleşmesi).
 *
 * 🔴 `kapanisNotu` bu listede OLMAK ZORUNDA: Adım 1'de yeniden açılışta bu
 * alanı temizleme kararı "tarihsel iz ServisIslemGecmisi'nde kalır"
 * gerekçesine dayandırılmıştı. Listeden çıkarılırsa o gerekçe çöker ve
 * ret gerekçesi geri alınamaz biçimde kaybolur.
 */
const TARIHCE_ALANLARI = [
  'durum',
  'aksiyon',
  'aksiyonTarihi',
  'kapanisTarihi',
  'kapanisNotu',
] as const

// `termin` BİLEREK YOK: durum makinesinin alanı değil, geçişle birlikte
// değişmiyor. Termin düzenlemesi genel "şikâyeti güncelle" işlemine ait
// (Adım 4) ve kendi tarihçe kaydını oralı yazacak — buraya karıştırılırsa
// durum geçişi tarihçesi, geçişle ilgisi olmayan alanları da taşır.

export interface SikayetDurumDegistirGirdisi {
  sikayetId: string
  yeniDurum: ServisSikayetDurumu
  /** Geçişle birlikte set edilecek alanlar (aksiyon, kapanış tarihi vb.). */
  alanlar?: Partial<Omit<SikayetDurumAlanlari, 'durum'>>
  /** İşlemi yapan kullanıcı — tarihçeye ve updatedById'ye yazılır. */
  userId?: string | null
  /** Tarihçeye düşecek serbest not (opsiyonel). */
  aciklama?: string | null
}

/**
 * Şikâyetin durumunu değiştirir.
 *
 * Reddedilen geçişte HİÇBİR yazma olmaz — ne update ne tarihçe. Doğrulama
 * transaction AÇILMADAN önce yapılır.
 */
export async function sikayetDurumDegistir(girdi: SikayetDurumDegistirGirdisi) {
  const mevcut = await prisma.servisSikayet.findUnique({
    where: { id: girdi.sikayetId },
    select: {
      id: true,
      durum: true,
      aksiyon: true,
      aksiyonTarihi: true,
      kapanisTarihi: true,
      kapanisNotu: true,
    },
  })
  if (!mevcut) throw new SikayetError('Şikâyet kaydı bulunamadı.')

  // Adım 1'in kuralı — izin kontrolü, yeniden açma yaması ve alan
  // tutarlılığı tek çağrıda. İkinci bir doğrulama YAZILMADI.
  const { gecerli, hatalar, sonuc } = gecisiUygula(
    mevcut as SikayetDurumAlanlari,
    girdi.yeniDurum,
    girdi.alanlar ?? {},
  )
  if (!gecerli) throw new SikayetError(hatalar.join(' '))

  const yeniVeri: Record<string, unknown> = {
    durum: sonuc.durum,
    aksiyon: sonuc.aksiyon ?? null,
    aksiyonTarihi: sonuc.aksiyonTarihi ?? null,
    kapanisTarihi: sonuc.kapanisTarihi ?? null,
    kapanisNotu: sonuc.kapanisNotu ?? null,
  }

  const fark = degisenAlanlar(
    mevcut as unknown as Record<string, unknown>,
    yeniVeri,
    [...TARIHCE_ALANLARI],
  )

  return prisma.$transaction(async tx => {
    const guncel = await tx.servisSikayet.update({
      where: { id: girdi.sikayetId },
      // Unchecked biçim: updatedById skaler FK olarak yazılıyor (checked
      // biçim ilişki nesnesi ister ve ikisi karıştırılamaz).
      data: { ...yeniVeri, updatedById: girdi.userId ?? null } as Prisma.ServisSikayetUncheckedUpdateInput,
    })

    // `durum` her geçişte değiştiği için fark burada hiçbir zaman null
    // olmaz; yine de sözleşmeye sadık kalınıyor (boş audit satırı yazılmaz).
    if (fark) {
      await kaydetIslemGecmisi({
        tx,
        hedefTipi: 'SIKAYET',
        hedefId: girdi.sikayetId,
        islem: 'GUNCELLEME',
        yapanId: girdi.userId,
        aciklama: girdi.aciklama ?? null,
        ...fark,
      })
    }

    return guncel
  })
}
