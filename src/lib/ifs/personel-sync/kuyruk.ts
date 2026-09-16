/**
 * Senkron kuyruğu (ifs_personel_sync_kayit). İki uygulama:
 *  - PrismaKuyruk: cron/hook için gerçek tablo.
 *  - BellekKuyruk: pilot betiği ve testler için (tablo migration'ı uygulanmadan koşabilsin).
 * Kuyruk kaydı "bu Hub kaydına yeniden bak" işaretidir; farkı planlayıcı hesaplar.
 */
import type { prisma as PrismaTip } from '@/lib/prisma'
import type { Islem, VarlikTipi } from './plan'

export type KuyrukDurumu = 'BEKLIYOR' | 'ISLENDI' | 'HATA' | 'ATLANDI'

export interface KuyrukKaydi {
  varlikTipi: VarlikTipi
  hubId: string
  ifsAnahtar?: string | null
  durum: KuyrukDurumu
  islem?: Islem | null
  hata?: string | null
  denemeSayisi: number
  tetik?: string | null
}

export interface KuyrukDeposu {
  /** Bekleyenleri getir (varlık sırasına göre, en fazla `batch`). */
  bekleyenler(batch: number): Promise<KuyrukKaydi[]>
  /** Kuyruğa yaz (varsa BEKLIYOR'a çek, denemeyi sıfırlama). */
  ekle(kayitlar: Array<Pick<KuyrukKaydi, 'varlikTipi' | 'hubId' | 'tetik'>>): Promise<number>
  /** Sonucu yaz. */
  sonuc(k: Pick<KuyrukKaydi, 'varlikTipi' | 'hubId'>, s: { durum: KuyrukDurumu; islem?: Islem; ifsAnahtar?: string; hata?: string | null }): Promise<void>
}

const SIRA: VarlikTipi[] = ['ORG', 'POZISYON', 'LABOR_CLASS', 'EMPLOYEE', 'SF_EMPLOYEE', 'SF_SITE']

export class PrismaKuyruk implements KuyrukDeposu {
  constructor(private readonly db: typeof PrismaTip) {}
  async bekleyenler(batch: number) {
    const rows = await this.db.ifsPersonelSyncKayit.findMany({ where: { durum: { in: ['BEKLIYOR', 'HATA'] }, denemeSayisi: { lt: 5 } }, orderBy: { createdAt: 'asc' }, take: batch * 6 })
    return rows
      .map((r) => ({ varlikTipi: r.varlikTipi as VarlikTipi, hubId: r.hubId, ifsAnahtar: r.ifsAnahtar, durum: r.durum as KuyrukDurumu, islem: r.islem as Islem | null, hata: r.hata, denemeSayisi: r.denemeSayisi, tetik: r.tetik }))
      .sort((a, b) => SIRA.indexOf(a.varlikTipi) - SIRA.indexOf(b.varlikTipi))
      .slice(0, batch)
  }
  async ekle(kayitlar: Array<Pick<KuyrukKaydi, 'varlikTipi' | 'hubId' | 'tetik'>>) {
    let n = 0
    for (const k of kayitlar) {
      await this.db.ifsPersonelSyncKayit.upsert({
        where: { varlikTipi_hubId: { varlikTipi: k.varlikTipi, hubId: k.hubId } },
        create: { varlikTipi: k.varlikTipi, hubId: k.hubId, tetik: k.tetik ?? null },
        update: { durum: 'BEKLIYOR', tetik: k.tetik ?? null, hata: null },
      })
      n++
    }
    return n
  }
  async sonuc(k: Pick<KuyrukKaydi, 'varlikTipi' | 'hubId'>, s: { durum: KuyrukDurumu; islem?: Islem; ifsAnahtar?: string; hata?: string | null }) {
    await this.db.ifsPersonelSyncKayit.update({
      where: { varlikTipi_hubId: { varlikTipi: k.varlikTipi, hubId: k.hubId } },
      data: { durum: s.durum, islem: s.islem ?? null, ifsAnahtar: s.ifsAnahtar, hata: s.hata ?? null, sonDenemeAt: new Date(), denemeSayisi: { increment: 1 } },
    })
  }
}

export class BellekKuyruk implements KuyrukDeposu {
  readonly kayitlar = new Map<string, KuyrukKaydi>()
  private anahtar(v: VarlikTipi, id: string) { return `${v}:${id}` }
  async bekleyenler(batch: number) {
    return [...this.kayitlar.values()].filter((k) => k.durum === 'BEKLIYOR' || k.durum === 'HATA').sort((a, b) => SIRA.indexOf(a.varlikTipi) - SIRA.indexOf(b.varlikTipi)).slice(0, batch)
  }
  async ekle(kayitlar: Array<Pick<KuyrukKaydi, 'varlikTipi' | 'hubId' | 'tetik'>>) {
    for (const k of kayitlar) this.kayitlar.set(this.anahtar(k.varlikTipi, k.hubId), { ...(this.kayitlar.get(this.anahtar(k.varlikTipi, k.hubId)) ?? { denemeSayisi: 0 }), varlikTipi: k.varlikTipi, hubId: k.hubId, durum: 'BEKLIYOR', tetik: k.tetik ?? null })
    return kayitlar.length
  }
  async sonuc(k: Pick<KuyrukKaydi, 'varlikTipi' | 'hubId'>, s: { durum: KuyrukDurumu; islem?: Islem; ifsAnahtar?: string; hata?: string | null }) {
    const a = this.anahtar(k.varlikTipi, k.hubId)
    const m = this.kayitlar.get(a) ?? { varlikTipi: k.varlikTipi, hubId: k.hubId, durum: 'BEKLIYOR' as KuyrukDurumu, denemeSayisi: 0 }
    this.kayitlar.set(a, { ...m, durum: s.durum, islem: s.islem ?? null, ifsAnahtar: s.ifsAnahtar ?? m.ifsAnahtar, hata: s.hata ?? null, denemeSayisi: m.denemeSayisi + 1 })
  }
}

/**
 * HOOK yardımcısı — Personnel / OrgUnit / DepartmentDefinition yazan uçlardan çağrılır.
 * Ateşle-unut: hata isteği düşürmez, yalnız loglanır (kuyruk kaybı cron tam taramasıyla telafi edilir).
 * Tablo yoksa (migration uygulanmamış) sessizce geçer — P2021.
 */
export async function ifsKuyrugaEkle(db: typeof PrismaTip, kayitlar: Array<{ varlikTipi: VarlikTipi; hubId: string }>, tetik: string): Promise<void> {
  try {
    await new PrismaKuyruk(db).ekle(kayitlar.map((k) => ({ ...k, tetik })))
  } catch (e) {
    const kod = (e as { code?: string })?.code
    if (kod === 'P2021') return // tablo yok — migration bekliyor
    console.error('[ifs-personel-sync] kuyruğa yazılamadı', tetik, e)
  }
}

/** Bir personel için tüm kişi katmanlarını kuyruğa yazar (EMPLOYEE + SF_EMPLOYEE + SF_SITE). */
export function personelKuyrukKayitlari(personnelId: string): Array<{ varlikTipi: VarlikTipi; hubId: string }> {
  return [{ varlikTipi: 'EMPLOYEE', hubId: personnelId }, { varlikTipi: 'SF_EMPLOYEE', hubId: personnelId }, { varlikTipi: 'SF_SITE', hubId: personnelId }]
}
