/**
 * FİF kayıt numarası — yıl bazlı atomik seri (KAL-FR-10).
 *
 * Format: FIF-{year}-{seq:3digits} → 'FIF-2026-001' (1000 ve sonrası 4+ hane).
 * Paket 3: numara KSS "Kayda Al" (KSS_KAYIT_BEKLIYOR → FAALIYET) anında verilir;
 * o ana kadar kayitNo NULL. quality-report-no.ts deseni:
 * pg_advisory_xact_lock(hashtext('fif_no_<year>')) ile yıl bazlı eşzamanlı
 * numaralamalar serialize olur. Durum geçişiyle AYNI $transaction içinde
 * çağrılmalı (tx parametresi geç); advisory lock erken bırakılmasın.
 *
 * SIRA SAYISAL bulunur: metin sıralamasında 'FIF-2026-999' > 'FIF-2026-1000'
 * olduğundan eski `orderBy kayitNo desc` 999'dan sonra 1000'i TEKRAR üretip
 * unique hatasına düşüyordu.
 *
 * Yıl geçişi: her yıl 001'den başlar (prefix'e yıl gömülü).
 */
import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export function fifNoPrefix(year: number): string {
  return `FIF-${year}-`
}

/** Bir kayıtNo'dan yıl+sıra ayrıştır (test/tutarlılık için). null = biçim dışı. */
export function parseFifNo(kayitNo: string): { year: number; seq: number } | null {
  const m = /^FIF-(\d{4})-(\d{3,})$/.exec(kayitNo)
  if (!m) return null
  return { year: Number(m[1]), seq: Number(m[2]) }
}

/**
 * SAF: verilen yılın mevcut numaralarından bir sonrakini üret. Biçim dışı ve
 * başka yıla ait numaralar yok sayılır; sıra SAYISAL en büyükten +1.
 */
export function sonrakiFifNo(year: number, mevcutNumaralar: readonly (string | null)[]): string {
  let enBuyuk = 0
  for (const no of mevcutNumaralar) {
    const p = no ? parseFifNo(no) : null
    if (p && p.year === year && p.seq > enBuyuk) enBuyuk = p.seq
  }
  return `${fifNoPrefix(year)}${String(enBuyuk + 1).padStart(3, '0')}`
}

/** Numaralama yılı — İstanbul takvim yılı (yılbaşı gecesi UTC kayması olmasın). */
export function fifNoYili(an: Date): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(an))
}

export async function generateNextFifNo(year: number, tx?: TxClient): Promise<string> {
  const run = async (client: TxClient | typeof prisma): Promise<string> => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fif_no_${year}`}))`

    // Yılın numaraları (yılda en fazla birkaç yüz/bin satır) — sayısal en büyük
    // uygulamada bulunur; metin sıralamasına güvenilmez.
    const satirlar = await client.fif.findMany({
      where: { kayitNo: { startsWith: fifNoPrefix(year) } },
      select: { kayitNo: true },
    })
    return sonrakiFifNo(year, satirlar.map((s) => s.kayitNo))
  }

  if (tx) return run(tx)
  return prisma.$transaction((t) => run(t))
}
