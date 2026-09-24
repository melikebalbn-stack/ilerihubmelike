import { getISOWeek, getISOWeekYear } from "date-fns";

// ISO hafta/yıl hesaplama — src/lib/vardiya-hafta.ts'teki gibi date-fns'in
// getISOWeek/getISOWeekYear'ı kullanılıyor, elle hafta hesaplama YOK.
export function hesaplaYilHafta(
  tarih: Date | string | null | undefined
): { yil: number; hafta: number } | null {
  if (!tarih) return null;
  const d = typeof tarih === "string" ? new Date(tarih) : tarih;
  if (Number.isNaN(d.getTime())) return null;
  return { yil: getISOWeekYear(d), hafta: getISOWeek(d) };
}
