// Kapasite durum etiketleri — PRISMA'SIZ saf modül: istemci (use client) bileşenleri de
// import eder. kapasite.ts prisma/pg çeker; istemciye ASLA doğrudan değer olarak girmemeli.
export type KapasiteDurumu = 'ARAC_YOK' | 'ASIM' | 'DOLMAK_UZERE' | 'UYGUN'

/** Durum etiketleri — ekran, Excel ve PDF AYNI metni kullanır (tek kaynak). */
export const KAPASITE_DURUM_ETIKETLERI: Record<KapasiteDurumu, string> = {
  ARAC_YOK: 'Araç yok',
  ASIM: 'Aşım',
  DOLMAK_UZERE: 'Dolmak üzere',
  UYGUN: 'Uygun',
}

export function kapasiteDurumEtiketi(ozet: { durum: KapasiteDurumu; asimMiktari: number }): string {
  return ozet.durum === 'ASIM'
    ? `${KAPASITE_DURUM_ETIKETLERI.ASIM} +${ozet.asimMiktari}`
    : KAPASITE_DURUM_ETIKETLERI[ozet.durum]
}
