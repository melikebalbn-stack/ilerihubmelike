// MASTER Madde 46 — Şikâyet oluşturma ve listeleme sorguları.
//
// Durum GEÇİŞİ uygulaması ve ServisIslemGecmisi yazımı BU DOSYADA DEĞİL
// (Adım 3). Burada yalnız oluşturma + listeleme var.
//
// 🔴 KVKK — İKİ AYRI ÇIKTI ŞEKLİ, tek fonksiyonun bayrağı DEĞİL:
//   sikayetListesiGetir()      → iç görünüm, şikâyetçi kimliği DAHİL (İK/İdari İşler)
//   sikayetFirmaListesiGetir() → firma görünümü, şikâyetçi alanları prisma
//                                select'ine HİÇ GİRMEZ (maskeleme değil, hiç çekmeme)
// Elif'in kararı: şikâyetçi kimliği İK'da kalır, firmaya ASLA gitmez. Maskeleme
// yerine "hiç seçmeme" tercih edildi — maskelenen veri yine de sunucudan geçer,
// bir log/hata ayıklama çıktısına düşebilir.
//
// durak: her iki görünümde de YALNIZ { id, kod, ad } seçilir. il/ilce/mahalle
// ve koordinat BİLEREK YOK — şikâyeti çözmek için gerekmiyor, kapsamı
// gereksiz genişletirdi (madde 23).
import { prisma } from '@/lib/prisma'
import type { Prisma, ServisSikayetDurumu, ServisSikayetKategori, ServisSikayetKaynagi } from '@/generated/prisma'
import { durumAlanlariniDogrula } from './sikayet-durum'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Çağıranın düzeltebileceği iş hatası (geçersiz girdi) — 500 değil 400. */
export class SikayetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SikayetError'
  }
}

// ----------------------------------------------------------------------------
// Sıra numarası
// ----------------------------------------------------------------------------

/**
 * Kesintisiz `no` serisi — rma-no.ts / uygunsuzluk-no.ts / fif-no.ts /
 * offboarding-form-no.ts ile AYNI desen (rule 6, yenisi icat edilmedi).
 *
 * 🔴 Race-safe: `pg_advisory_xact_lock` eşzamanlı çağrıları MAX okunmadan
 * ÖNCE sıraya sokar; ikinci işlem birincinin COMMIT'ini bekler ve MAX zaten
 * yeni değeri görür. Bu yüzden unique ihlali OLUŞMAZ ve retry döngüsü
 * GEREKMEZ — emsal modüllerin hiçbirinde P2002 yakalaması yok.
 *
 * 🔴 KIRILMA NOKTASI: kilit `xact` kapsamlıdır, yani transaction bitince
 * serbest kalır. Bu yüzden numara üretimi ile INSERT **AYNI** `$transaction`
 * içinde olmak ZORUNDA. Ayrı transaction'da çağrılırsa kilit erken bırakılır
 * ve yarış geri gelir. `sikayetOlustur()` bu yüzden tx client'ı doğrudan
 * geçirir; testte de aynı client olduğu assert ediliyor.
 *
 * Yıl bazlı DEĞİL: `no` tek başına unique, tek kesintisiz seri.
 */
export async function sonrakiSikayetNo(tx?: TxClient): Promise<number> {
  const run = async (client: TxClient | typeof prisma): Promise<number> => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('servis_sikayet_no'))`

    const rows = await client.$queryRaw<{ next: bigint }[]>`
      SELECT COALESCE(MAX("no"), 0) + 1 AS next FROM "servis_sikayet"
    `
    return Number(rows[0].next)
  }

  if (tx) return run(tx)
  return prisma.$transaction(t => run(t))
}

// ----------------------------------------------------------------------------
// Oluşturma
// ----------------------------------------------------------------------------

export interface SikayetOlusturGirdisi {
  /** Olayın yaşandığı gün. */
  tarih: Date
  /** Şikâyetin açıldığı gün — süre hesapları BUNA dayanır. */
  bildirimTarihi: Date
  kategori: ServisSikayetKategori
  aciklama: string
  /** ZORUNLU — şikâyet her zaman bir hatta aittir. */
  guzergahId: string
  /** ZORUNLU — default YOK, kimin açtığı baştan belli olmalı. */
  kaynak: ServisSikayetKaynagi

  dilimId?: string | null
  firmaId?: string | null
  aracId?: string | null
  soforId?: string | null
  /** Şikâyetin ilgili olduğu durak — opsiyonel, çalışan bildirdiğinde
   *  bilinmeyebilir. planlananSaat'i TÜRETMEZ (aşağıya bakın). */
  durakId?: string | null

  sikayetciPersonnelId?: string | null
  sorumluId?: string | null
  termin?: Date | null

  /**
   * Anlık kopya — ÇAĞIRANDAN gelir, türetilmez. ServisGuzergahDurakSaat
   * durak BAŞINA saat tutuyor. 🔴 durakId GELSE BİLE otomatik doldurma
   * YAPILMAZ (Melih kararı: "İV elle girsin") — saat dilime göre değişir,
   * olay anındaki tarifeyi kaydın kendisi taşımalı, sorgu anında yeniden
   * türetilmemeli. Uydurmak yerine İV'nin girdiği değer saklanır.
   */
  planlananSaat?: string | null

  createdById?: string | null
}

/** Anlık kopya alanları (delil) — olay anındaki değerler. */
interface AnlikKopya {
  plaka: string | null
  soforAdSoyad: string | null
  firmaAd: string | null
  sorumluAdSoyad: string | null
}

/**
 * Anlık kopyayı VERİLEN id'lerden okur.
 *
 * 🔴 ÇIKARIM YOK: firmaId verilmediyse `firmaAd` boş kalır — araç üzerinden
 * firmaya gitmek, kullanıcının kurmadığı bir ilişkiyi varsaymak olurdu.
 *
 * 🔴 sorumluAdSoyad OLAY TARİHİNE göre seçilir (`tarih`), bugüne göre DEĞİL
 * ve `aktif` bayrağına göre HİÇ DEĞİL (Ders 73): bayrak "şu an geçerli mi"
 * sorusunu yanıtlar, biz "o gün kim sorumluydu"yu soruyoruz. Tarih kesişimi
 * POZİTİF AND-of-OR formunda (Ders 59) — NOT/negatif form NULL bitişi
 * sessizce eler.
 */
async function anlikKopyaOku(
  client: TxClient | typeof prisma,
  girdi: SikayetOlusturGirdisi,
): Promise<AnlikKopya> {
  const [arac, sofor, firma, sorumlu] = await Promise.all([
    girdi.aracId
      ? client.servisArac.findUnique({ where: { id: girdi.aracId }, select: { plaka: true } })
      : null,
    girdi.soforId
      ? client.servisSofor.findUnique({ where: { id: girdi.soforId }, select: { adSoyad: true } })
      : null,
    girdi.firmaId
      ? client.servisFirma.findUnique({ where: { id: girdi.firmaId }, select: { ad: true } })
      : null,
    client.servisSorumlusu.findFirst({
      where: {
        guzergahId: girdi.guzergahId,
        rol: 'ANA',
        // Olay tarihi [baslangicTarihi, bitisTarihi] aralığında mı — pozitif form.
        baslangicTarihi: { lte: girdi.tarih },
        OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: girdi.tarih } }],
      },
      select: { personnel: { select: { adSoyad: true } } },
      orderBy: { baslangicTarihi: 'desc' },
    }),
  ])

  return {
    plaka: arac?.plaka ?? null,
    soforAdSoyad: sofor?.adSoyad ?? null,
    firmaAd: firma?.ad ?? null,
    sorumluAdSoyad: sorumlu?.personnel.adSoyad ?? null,
  }
}

/**
 * Yeni şikâyet kaydı. Durum HER ZAMAN `ACIK` başlar — geçişler Adım 3'te.
 *
 * Numara üretimi ve insert AYNI transaction içinde (advisory lock'un geçerli
 * kalması için şart, bkz. sonrakiSikayetNo yorumu).
 */
export async function sikayetOlustur(girdi: SikayetOlusturGirdisi) {
  if (!girdi.guzergahId?.trim()) {
    throw new SikayetError('Şikâyetin hangi güzergâha ait olduğunu seçin.')
  }
  if (!girdi.aciklama?.trim()) {
    throw new SikayetError('Şikâyetin ne olduğunu "Açıklama" alanına yazın.')
  }
  if (!girdi.kaynak) {
    throw new SikayetError('Şikâyeti kimin bildirdiğini (kaynak) seçin.')
  }

  // Adım 1'deki doğrulayıcı — ikinci bir doğrulama YAZILMADI.
  const dogrulama = durumAlanlariniDogrula({ durum: 'ACIK' })
  if (!dogrulama.gecerli) throw new SikayetError(dogrulama.hatalar.join(' '))

  return prisma.$transaction(async tx => {
    const no = await sonrakiSikayetNo(tx)
    const kopya = await anlikKopyaOku(tx, girdi)

    return tx.servisSikayet.create({
      data: {
        no,
        tarih: girdi.tarih,
        bildirimTarihi: girdi.bildirimTarihi,
        kategori: girdi.kategori,
        aciklama: girdi.aciklama.trim(),
        guzergahId: girdi.guzergahId,
        kaynak: girdi.kaynak,
        dilimId: girdi.dilimId ?? null,
        firmaId: girdi.firmaId ?? null,
        aracId: girdi.aracId ?? null,
        soforId: girdi.soforId ?? null,
        durakId: girdi.durakId ?? null,
        sikayetciPersonnelId: girdi.sikayetciPersonnelId ?? null,
        sorumluId: girdi.sorumluId ?? null,
        termin: girdi.termin ?? null,
        planlananSaat: girdi.planlananSaat ?? null,
        ...kopya,
        durum: 'ACIK',
        createdById: girdi.createdById ?? null,
      },
    })
  })
}

// ----------------------------------------------------------------------------
// Listeleme
// ----------------------------------------------------------------------------

export interface SikayetFiltresi {
  guzergahId?: string
  firmaId?: string
  durakId?: string
  durum?: ServisSikayetDurumu
  kategori?: ServisSikayetKategori
  kaynak?: ServisSikayetKaynagi
  /** 🔴 bildirimTarihi üzerinden — `tarih` OLAY günüdür, karıştırma. */
  bildirimBaslangic?: Date
  bildirimBitis?: Date
}

/** Filtreyi prisma where'e çevirir — iki görünüm de AYNI where'i kullanır. */
export function sikayetWhereOlustur(filtre: SikayetFiltresi): Prisma.ServisSikayetWhereInput {
  const where: Prisma.ServisSikayetWhereInput = {}

  if (filtre.guzergahId) where.guzergahId = filtre.guzergahId
  if (filtre.firmaId) where.firmaId = filtre.firmaId
  if (filtre.durakId) where.durakId = filtre.durakId
  if (filtre.durum) where.durum = filtre.durum
  if (filtre.kategori) where.kategori = filtre.kategori
  if (filtre.kaynak) where.kaynak = filtre.kaynak

  if (filtre.bildirimBaslangic || filtre.bildirimBitis) {
    where.bildirimTarihi = {
      ...(filtre.bildirimBaslangic ? { gte: filtre.bildirimBaslangic } : {}),
      ...(filtre.bildirimBitis ? { lte: filtre.bildirimBitis } : {}),
    }
  }

  return where
}

/** Her iki görünümde de dönen ortak alanlar. */
const ORTAK_SELECT = {
  id: true,
  no: true,
  tarih: true,
  bildirimTarihi: true,
  kategori: true,
  aciklama: true,
  durum: true,
  kaynak: true,
  termin: true,
  aksiyon: true,
  aksiyonTarihi: true,
  kapanisTarihi: true,
  kapanisNotu: true,
  guzergahId: true,
  dilimId: true,
  firmaId: true,
  aracId: true,
  soforId: true,
  durakId: true,
  // Konum bilgisi, kişisel veri değil — firma da "hangi durakta ne oldu"yu
  // görmeli. il/ilce/mahalle/koordinat BİLEREK yok (madde 23).
  durak: { select: { id: true, kod: true, ad: true } },
  plaka: true,
  soforAdSoyad: true,
  firmaAd: true,
  sorumluAdSoyad: true,
  planlananSaat: true,
  createdAt: true,
} as const

/**
 * İÇ GÖRÜNÜM — İK / İdari İşler. Şikâyetçi kimliği DAHİL.
 * Personnel'den yalnız id/sicilNo/adSoyad/bolum; telefon, adres, e-posta YOK
 * (servis modülünün KVKK sınırı).
 */
export async function sikayetListesiGetir(filtre: SikayetFiltresi = {}) {
  return prisma.servisSikayet.findMany({
    where: sikayetWhereOlustur(filtre),
    select: {
      ...ORTAK_SELECT,
      sikayetciPersonnelId: true,
      sikayetci: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true } },
      sorumluId: true,
      sorumlu: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true } },
    },
    orderBy: [{ bildirimTarihi: 'desc' }, { no: 'desc' }],
  })
}

/**
 * FİRMA GÖRÜNÜMÜ — taşeron firmaya gidecek çıktıların kaynağı.
 *
 * 🔴 Şikâyetçiye ait HİÇBİR alan select'te YOK: `sikayetciPersonnelId` de,
 * `sikayetci` ilişkisi de seçilmez. Bu bilinçli olarak maskeleme DEĞİL —
 * veri sunucuya hiç gelmez, dolayısıyla yanlışlıkla bir yanıta, loga veya
 * dosyaya sızması mümkün olmaz.
 *
 * `sorumlu` (İV tarafındaki güzergâh sorumlusu) firmaya gidebilir; şikâyetçi
 * ile karıştırılmamalı — biri şikâyet eden çalışan, diğeri işi takip eden İV
 * personeli.
 */
export async function sikayetFirmaListesiGetir(filtre: SikayetFiltresi = {}) {
  return prisma.servisSikayet.findMany({
    where: sikayetWhereOlustur(filtre),
    select: { ...ORTAK_SELECT },
    orderBy: [{ bildirimTarihi: 'desc' }, { no: 'desc' }],
  })
}

/**
 * Firma görünümünün select'i — testin ve çağıranın denetleyebilmesi için
 * dışa açık. Şikâyetçi alanı buraya EKLENMEMELİ.
 */
export const FIRMA_GORUNUMU_SELECT = ORTAK_SELECT
