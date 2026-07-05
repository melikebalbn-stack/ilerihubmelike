// PR-IFS-RAPOR-2a: Akademi son tarih (dueDate) parse — GÜN SONUNA normalize.
//
// Overdue hesabı `dueDate < now` (akademi-department-board.ts). "YYYY-MM-DD"
// girişini düz `new Date()` ile ayrıştırmak UTC gün-BAŞINI (00:00:00Z) verir;
// bu, kullanıcıyı son gününün başında overdue yapardı. Gün SONUNA
// (23:59:59.999 UTC) normalize ederek son günü tam tanırız — asla erken overdue.
//
// NOT (timezone): gün sonu UTC olarak yazılır. TR (UTC+3) için overdue eşiği
// TR ertesi gün ~03:00'e denk gelir → küçük bir tolerans, asla erken değil.
// Mevcut bolums/assignments route'ları hâlâ gün-başı (00:00Z) yazıyor; bu akış
// (paket→kullanıcı + toplu araç) bilinçli olarak gün sonuna normalize eder.

export interface ParsedDueDate {
  dueDate: Date | null;
  error?: string;
}

export function parseDueDateEndOfDay(
  input: string | null | undefined
): ParsedDueDate {
  if (!input) return { dueDate: null };

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (m) {
    const dt = new Date(
      Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
    );
    if (isNaN(dt.getTime())) return { dueDate: null, error: "Geçersiz tarih" };
    return { dueDate: dt };
  }

  // Fallback: ISO/instant verildiyse o günü baz alıp gün sonuna çek.
  const d = new Date(input);
  if (isNaN(d.getTime())) return { dueDate: null, error: "Geçersiz tarih" };
  return {
    dueDate: new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        23,
        59,
        59,
        999
      )
    ),
  };
}
