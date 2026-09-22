// ============================================================================
// MASTER Madde 29 — Operasyonel Servis Listeleri
// ============================================================================
//
// Ayda bir servis firmalarına verilen güncel personel listesinin servis/query
// katmanı. Madde 30'un (REV.0/REV.1 versiyonlu/snapshot listeler) KONUSU
// DEĞİL — burada yalnız CANLI sorgu var, versiyonlama/snapshot yok (bilinçli
// sınır, madde 30 ayrı ve ertelenmiş bir iş).
//
// "Servis" ve "Güzergâh" MASTER metninde ayrı filtre gibi yazılmış ama
// şemada TEK varlık — ServisGuzergah. Tek filtre (guzergahId) olarak
// uygulandı.
//
// POINT-IN-TIME — yarım destek, bilinçli kabul edilmiş sınır:
// - Personel ROSTER'ı seçilen tarih itibarıyla doğru: ServisPersonelAtama
//   immutable-atama + tarih aralığı deseni kullanılır, aktif bayrağına HİÇ
//   bakılmaz (geçmiş bir tarihte aktif olan, bugün artık pasifleşmiş bir
//   atama satırı da doğru şekilde yakalanmalı — madde 31/2 dersi).
// - Saat (Sabah Saati) ve durak/güzergah AÇIKLAMALARI ise GÜNCEL tanımları
//   gösterir — ServisGuzergahDurakSaat'e (bilinçli olarak) tarih aralığı
//   eklenmedi, bu madde 30'un konusu. `gecmisTarihSecildi` bayrağı, geçmiş
//   bir tarih seçildiğinde bu farkın kullanıcıya/ekrana bildirilmesi için.
//
// VARDİYA filtresi UYGULANMAZ — veri kaynağı yok, üç bağımsız araştırmada
// doğrulandı (madde 43/8 keşif raporu, vardiya-uyumsuzluğu raporu, Vardiya
// Formu keşfi). Personnel'de ya da başka hiçbir modelde personelin sürekli
// vardiyasını tutan bir alan yok. TODO: veri kaynağı oluşursa (örn.
// Personnel.vardiyaId → IproVardiya FK) buraya eklenecek.
//
// ŞİRKET filtresi ŞİMDİLİK UYGULANMAZ — Personnel'de "şirket" karşılığı bir
// alan yok, Elif'e soruldu, cevap bekleniyor. TODO: cevap gelince (yeni alan
// mı, mevcut bir alanın yeniden yorumlanması mı) buraya eklenecek.

import { prisma } from '@/lib/prisma'

export interface OperasyonelServisListesiFiltre {
  /** ISO tarih ("YYYY-MM-DD") veya Date. Verilmezse bugün kullanılır. */
  tarih?: string | Date
  guzergahId?: string
  firmaId?: string
  durakId?: string
  bolum?: string
  /** ServisYerleske.id — MASTER'daki "lokasyon" filtresinin karşılığı. */
  yerleskeId?: string
  /**
   * ServisSeferDilimi.id — atamanın O DİLİMİ kapsayıp kapsamadığı
   * (ServisPersonelAtamaDilim junction'ı). OPSİYONEL ve additive: madde 29
   * ekranı bunu GÖNDERMEZ, verilmediğinde davranış birebir eskisi gibidir
   * (tüm dilimler). Madde 49 (Acil Durum Servis Listesi) yolcu listesini
   * dilim bazında almak için kullanır — sorgu ikinci kez yazılmasın diye.
   */
  dilimId?: string
}

export interface OperasyonelServisListesiSatiri {
  personnelId: string
  sicilNo: string | null
  adSoyad: string
  bolum: string | null
  guzergahKod: string
  guzergahAd: string
  durakKod: string | null
  durakAd: string | null
  sabahSaati: string | null
  telefon: string | null
}

export interface OperasyonelServisListesiSonucu {
  tarih: string
  /** Seçilen tarih bugünden önceyse true — UI/export bu bayrakla "saat ve
   * durak bilgileri güncel tanımlara göre gösteriliyor" uyarısı gösterecek. */
  gecmisTarihSecildi: boolean
  satirlar: OperasyonelServisListesiSatiri[]
}

function gunBaslangici(deger: Date): Date {
  const d = new Date(deger)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// Firma filtresi dolaylı: personelin atandığı güzergahta, o firmaya ait
// SEÇİLEN TARİH itibarıyla ANA araç ya da şoför varsayılanı var mı. Personel
// ROSTER'ıyla AYNI point-in-time mantığı — aktif bayrağına BAKILMAZ, yalnız
// tarih aralığı kontrol edilir (madde 31/2 dersi: geçmiş tarihli liste
// "geçmişin personeli + bugünün firması" gibi tutarsız üretmemeli).
async function firmaGuzergahIdleriGetir(firmaId: string, tarih: Date): Promise<Set<string>> {
  const tarihKosulu = {
    baslangicTarihi: { lte: tarih },
    OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: tarih } }],
  }
  const [aracVarsayilanlari, soforVarsayilanlari] = await Promise.all([
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: { rol: 'ANA', ...tarihKosulu, arac: { firmaId } },
      select: { guzergahId: true },
    }),
    prisma.servisGuzergahSoforVarsayilan.findMany({
      where: { rol: 'ANA', ...tarihKosulu, sofor: { firmaId } },
      select: { guzergahId: true },
    }),
  ])
  return new Set([...aracVarsayilanlari.map(a => a.guzergahId), ...soforVarsayilanlari.map(s => s.guzergahId)])
}

// Sabah Saati — ServisGuzergahDurakSaat.saat, dilim.yon='GIDIS'. Aynı
// güzergah+durakta birden fazla GIDIS dilimi (örn. iki farklı sabah seferi)
// teorik olarak mümkün; bu liste tek sütun istediği için İLK aktif GIDIS
// saati alınır (basitleştirme — dev veri setinde tek GIDIS dilimi var).
async function sabahSaatleriGetir(
  ciftler: { guzergahId: string; durakId: string }[],
): Promise<Map<string, string>> {
  const sonuc = new Map<string, string>()
  if (ciftler.length === 0) return sonuc

  const guzergahIdler = [...new Set(ciftler.map(c => c.guzergahId))]
  const durakIdler = [...new Set(ciftler.map(c => c.durakId))]

  const guzergahDuraklar = await prisma.servisGuzergahDurak.findMany({
    where: { guzergahId: { in: guzergahIdler }, durakId: { in: durakIdler }, aktif: true },
    select: {
      guzergahId: true,
      durakId: true,
      saatler: {
        where: { aktif: true, dilim: { yon: 'GIDIS' } },
        select: { saat: true },
        take: 1,
      },
    },
  })

  for (const gd of guzergahDuraklar) {
    const saat = gd.saatler[0]?.saat
    if (saat) sonuc.set(`${gd.guzergahId}::${gd.durakId}`, saat)
  }
  return sonuc
}

export async function operasyonelServisListesiGetir(
  filtre: OperasyonelServisListesiFiltre = {},
): Promise<OperasyonelServisListesiSonucu> {
  const tarih = gunBaslangici(filtre.tarih ? new Date(filtre.tarih) : new Date())
  const bugun = gunBaslangici(new Date())
  const gecmisTarihSecildi = tarih.getTime() < bugun.getTime()

  const izinliGuzergahIdler = filtre.firmaId ? await firmaGuzergahIdleriGetir(filtre.firmaId, tarih) : null

  const atamalar = await prisma.servisPersonelAtama.findMany({
    where: {
      baslangicTarihi: { lte: tarih },
      OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: tarih } }],
      ...(filtre.guzergahId ? { guzergahId: filtre.guzergahId } : {}),
      ...(filtre.durakId ? { durakId: filtre.durakId } : {}),
      ...(filtre.bolum ? { personnel: { bolum: filtre.bolum } } : {}),
      ...(filtre.yerleskeId ? { guzergah: { yerleskeId: filtre.yerleskeId } } : {}),
      // Dilim filtresi: atamanın O dilimi kapsayan bir ServisPersonelAtamaDilim
      // satırı olmalı. Verilmezse anahtar hiç eklenmez → eski davranış.
      ...(filtre.dilimId ? { dilimler: { some: { dilimId: filtre.dilimId } } } : {}),
      ...(izinliGuzergahIdler ? { guzergahId: { in: [...izinliGuzergahIdler] } } : {}),
    },
    select: {
      guzergahId: true,
      durakId: true,
      personnel: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true, telefon: true } },
      guzergah: { select: { kod: true, ad: true } },
      durak: { select: { kod: true, ad: true } },
    },
    orderBy: { personnel: { adSoyad: 'asc' } },
  })

  const sabahSaatCiftleri = atamalar
    .filter((a): a is typeof a & { durakId: string } => a.durakId !== null)
    .map(a => ({ guzergahId: a.guzergahId, durakId: a.durakId }))
  const sabahSaatleri = await sabahSaatleriGetir(sabahSaatCiftleri)

  const satirlar: OperasyonelServisListesiSatiri[] = atamalar.map(a => ({
    personnelId: a.personnel.id,
    sicilNo: a.personnel.sicilNo,
    adSoyad: a.personnel.adSoyad,
    bolum: a.personnel.bolum,
    guzergahKod: a.guzergah.kod,
    guzergahAd: a.guzergah.ad,
    durakKod: a.durak?.kod ?? null,
    durakAd: a.durak?.ad ?? null,
    sabahSaati: a.durakId ? (sabahSaatleri.get(`${a.guzergahId}::${a.durakId}`) ?? null) : null,
    telefon: a.personnel.telefon,
  }))

  return {
    tarih: tarih.toISOString().slice(0, 10),
    gecmisTarihSecildi,
    satirlar,
  }
}
