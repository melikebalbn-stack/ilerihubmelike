import type { SplitBadgeColor } from "@/components/akademi/SplitBadge";
import { normalizeTr } from "@/lib/normalize-tr";

/**
 * Duyuru modülü — SAF görünüm mantığı (test edilir). React/DOM yok.
 * Kategori sistemi şemada AnnouncementCategory TABLOSU (color alanıyla) olarak
 * var; ayrı enum EKLENMEDİ. Renk = category.color ?? ada göre sabit eşleme ?? default.
 */

export const DEFAULT_CATEGORY_COLOR = "#1A5AA0";

// Tarifedeki 6 kategori için ada göre yedek renk (category.color boşsa).
// Anahtarlar normalizeTr ile eşlenir → "İnsan Varlıkları", "IT", "INSAN_VARLIKLARI" hepsi tutar.
const NAME_COLOR: Record<string, string> = {
  genel: "#1A5AA0",
  "insan varliklari": "#7c3aed",
  insan_varliklari: "#7c3aed",
  iv: "#7c3aed",
  it: "#0891b2",
  kalite: "#dc2626",
  uretim: "#ea580c",
  sosyal: "#16a34a",
};

export type CategoryLike = {
  id?: string;
  name?: string | null;
  color?: string | null;
} | null;

export function categoryColor(category: CategoryLike): string {
  const c = category?.color?.trim();
  if (c) return c;
  const byName = category?.name ? NAME_COLOR[normalizeTr(category.name)] : undefined;
  return byName ?? DEFAULT_CATEGORY_COLOR;
}

export function categoryLabel(category: CategoryLike): string {
  return category?.name?.trim() || "Genel";
}

// ─── KPI ────────────────────────────────────────────────────────────────
export type AnnouncementKpiItem = {
  isRead?: boolean;
  isPinned?: boolean;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

export type AnnouncementsKpi = {
  total: number;
  unread: number; // bana göre okunmamış
  thisMonth: number; // bu ay yayınlanan
  pinned: number; // sabitlenmiş
};

export function announcementsKpi(
  items: AnnouncementKpiItem[],
  now: Date = new Date()
): AnnouncementsKpi {
  const y = now.getFullYear();
  const m = now.getMonth();
  let unread = 0;
  let thisMonth = 0;
  let pinned = 0;
  for (const a of items) {
    if (!a.isRead) unread++;
    if (a.isPinned) pinned++;
    const d = a.publishedAt ?? a.createdAt;
    if (d) {
      const dt = new Date(d);
      if (!isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === m) {
        thisMonth++;
      }
    }
  }
  return { total: items.length, unread, thisMonth, pinned };
}

// ─── Okuma süresi ─────────────────────────────────────────────────────────
export function readingTimeMin(content: string | null | undefined): number {
  if (!content) return 1;
  const text = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return 1;
  const words = text.split(" ").length;
  return Math.max(1, Math.round(words / 200));
}

export function readingTimeLabel(content: string | null | undefined): string {
  return `${readingTimeMin(content)} dk okuma`;
}

// ─── Kart / hero aksiyon rozeti (SplitBadge modeli) ──────────────────────
export type BadgeModel = { color: SplitBadgeColor; left: string; right: string };

/** Kart rozeti: okunmamış → kırmızı "Yeni|Oku", okunmuş → gri "Okundu|Aç". */
export function cardBadge(isRead: boolean | undefined): BadgeModel {
  return isRead
    ? { color: "gray", left: "Okundu", right: "Aç" }
    : { color: "red", left: "Yeni", right: "Oku" };
}

/** Hero rozeti: okunmamış → cyan "Yeni|Duyuruyu oku", okunmuş → gri "Okundu|Aç". */
export function heroBadge(isRead: boolean | undefined): BadgeModel {
  return isRead
    ? { color: "gray", left: "Okundu", right: "Aç" }
    : { color: "cyan", left: "Yeni", right: "Duyuruyu oku" };
}

// ─── Popup açılma seçimi (SAF kural) ─────────────────────────────────────
export type PendingItem = {
  id: string;
  seen: boolean; // AnnouncementRead kaydı var mı (görüldü VEYA onaylandı)
  publishedAt?: string | Date | null;
};

/**
 * Otomatik açılacak popup'lar: HİÇ görülmemiş (seen=false) yayındaki duyurular,
 * EN YENİ önce. Kural: bir kez gördü VEYA onayladı → seen=true → tekrar çıkmaz.
 */
export function selectPendingPopups<T extends PendingItem>(items: T[]): T[] {
  return items
    .filter((a) => !a.seen)
    .sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });
}

/**
 * Popup kapatma kuralı. onayZorunlu ise yalnız onay kutusu işaretliyken kapanabilir
 * (✕ ve dış tıklama kapatmaz). Değilse her zaman kapatılabilir.
 */
export function canClosePopup(
  requireAcknowledgment: boolean,
  ackChecked: boolean
): boolean {
  if (requireAcknowledgment) return ackChecked;
  return true;
}

// ─── Filtre çipi sayımı ───────────────────────────────────────────────────
export type ChipCount = { id: string; label: string; count: number; color?: string };

/** "Tümü" + her kategori için sayılı çip. items category.id/name taşımalı. */
export function buildCategoryChips(
  items: Array<{ category?: CategoryLike }>,
  categories: Array<{ id: string; name: string; color?: string | null }>
): ChipCount[] {
  const counts = new Map<string, number>();
  for (const a of items) {
    const id = a.category?.id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const chips: ChipCount[] = [
    { id: "all", label: "Tümü", count: items.length },
  ];
  for (const c of categories) {
    chips.push({
      id: c.id,
      label: c.name,
      count: counts.get(c.id) ?? 0,
      color: categoryColor(c),
    });
  }
  return chips;
}

/** Arama: başlık/özet üzerinde normalizeTr eşleşmesi. */
export function matchesSearch(
  a: { title?: string | null; summary?: string | null },
  query: string
): boolean {
  const q = normalizeTr(query.trim());
  if (!q) return true;
  const hay = normalizeTr(`${a.title ?? ""} ${a.summary ?? ""}`);
  return hay.includes(q);
}
