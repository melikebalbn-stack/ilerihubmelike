"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { StatCard } from "@/components/akademi/dashboard/StatCard";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import {
  AnnouncementModal,
  type AnnouncementPopupData,
} from "@/components/announcements/AnnouncementModal";
import {
  announcementsKpi,
  buildCategoryChips,
  categoryColor,
  categoryLabel,
  cardBadge,
  heroBadge,
  matchesSearch,
  readingTimeLabel,
} from "@/lib/announcements/announcement-ui";

interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface Announcement {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  category: Category | null;
  priority: string;
  status: string;
  isPinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  requireAcknowledgment: boolean;
  eylemUrl: string | null;
  eylemMetni: string | null;
  authorName: string;
  viewCount: number;
  isRead: boolean;
  isAcknowledged: boolean;
}

function trTarih(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function toPopup(a: Announcement): AnnouncementPopupData {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    authorName: a.authorName,
    publishedAt: a.publishedAt ?? a.createdAt,
    requireAcknowledgment: a.requireAcknowledgment,
    eylemUrl: a.eylemUrl,
    eylemMetni: a.eylemMetni,
    category: a.category,
  };
}

export default function AnnouncementsPage() {
  const { data: session } = useSession();
  const isAdmin =
    (session?.user?.permissions?.includes("duyuru.admin") ?? false) ||
    (session?.user?.permissions?.includes("duyuru.create") ?? false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [modal, setModal] = useState<AnnouncementPopupData | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/announcements/categories").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/announcements?limit=100").then((r) => (r.ok ? r.json() : { announcements: [] })),
    ])
      .then(([cats, list]) => {
        setCategories(Array.isArray(cats) ? cats : []);
        setAnnouncements(list.announcements ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpi = useMemo(() => announcementsKpi(announcements), [announcements]);
  const chips = useMemo(() => buildCategoryChips(announcements, categories), [announcements, categories]);

  // İlk sabitlenmiş = hero; grid'de tekrar gösterilmez.
  const hero = useMemo(() => announcements.find((a) => a.isPinned) ?? null, [announcements]);

  const filtered = useMemo(
    () =>
      announcements.filter(
        (a) =>
          a.id !== hero?.id &&
          (activeCat === "all" || a.category?.id === activeCat) &&
          matchesSearch(a, search)
      ),
    [announcements, hero, activeCat, search]
  );

  const markSeen = (id: string, acknowledged: boolean) => {
    setAnnouncements((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, isRead: true, isAcknowledged: acknowledged || a.isAcknowledged } : a
      )
    );
  };

  const dismiss = () => {
    if (!modal) return;
    fetch(`/api/announcements/${modal.id}/goruldu`, { method: "POST" }).catch(() => {});
    markSeen(modal.id, false);
    setModal(null);
  };
  const acknowledge = () => {
    if (!modal) return;
    fetch(`/api/announcements/${modal.id}/acknowledge`, { method: "POST" }).catch(() => {});
    markSeen(modal.id, true);
    setModal(null);
  };

  return (
    <div className="akademi-scope">
      <div className="px-2 sm:px-4 py-2 max-w-7xl mx-auto">
        {/* Başlık */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ak-animate-in">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ak-text-primary)" }}>
              Duyurular
            </h1>
            <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
              Şirket duyurularını ve haberleri takip edin
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/announcements/manage"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1A5AA0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12457c]"
            >
              <Plus className="h-4 w-4" /> Yeni Duyuru
            </Link>
          )}
        </div>

        {/* KPI (compact) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ak-animate-in">
          <StatCard compact icon="trendingUp" label="Toplam" value={kpi.total} color="accent" delayIndex={1} />
          <StatCard compact icon="flame" label="Okunmamış" value={kpi.unread} color="red" delayIndex={2} />
          <StatCard compact icon="clock" label="Bu ay" value={kpi.thisMonth} color="orange" delayIndex={3} />
          <StatCard compact icon="award" label="Sabitlenmiş" value={kpi.pinned} color="purple" delayIndex={4} />
        </div>

        {/* Sabitlenmiş hero bandı */}
        {hero && (
          <button
            type="button"
            onClick={() => setModal(toPopup(hero))}
            className="relative mb-6 block w-full overflow-hidden rounded-2xl p-6 text-left text-white ak-animate-in"
            style={{ background: "linear-gradient(135deg,#0f2c54,#1A5AA0)" }}
          >
            {/* ince blueprint ızgarası */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: categoryColor(hero.category) }} />
                  SABİTLENMİŞ · {categoryLabel(hero.category)}
                </div>
                <h2 className="mb-2 text-2xl font-bold leading-snug">{hero.title}</h2>
                {hero.summary && <p className="mb-3 max-w-2xl text-sm text-white/85 line-clamp-2">{hero.summary}</p>}
                <div className="text-[13px] text-white/70">
                  {hero.authorName} · {trTarih(hero.publishedAt ?? hero.createdAt)} · {readingTimeLabel(hero.content)}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">Önemli</span>
                <span onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const b = heroBadge(hero.isRead);
                    return <SplitBadge color={b.color} left={b.left} right={b.right} onClick={() => setModal(toPopup(hero))} />;
                  })()}
                </span>
              </div>
            </div>
          </button>
        )}

        {/* Filtre çipleri + arama */}
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => {
              const active = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCat(c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "border-transparent bg-[#1A5AA0] text-white"
                      : "border-[#e5e9f0] bg-white text-[#334155] hover:bg-[#f1f5f9]"
                  }`}
                >
                  {c.color && c.id !== "all" && (
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                  )}
                  {c.label}
                  <span className={active ? "text-white/80" : "text-[#94a3b8]"}>{c.count}</span>
                </button>
              );
            })}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Duyuru ara…"
            className="w-full rounded-lg border border-[#e5e9f0] bg-white px-3 py-2 text-sm outline-none focus:border-[#1A5AA0] lg:w-64"
          />
        </div>

        {/* Kart grid */}
        {loading ? (
          <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div className="ak-card-static p-8 text-center text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
            Filtrelere uygun duyuru bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[18px]">
            {filtered.map((a) => {
              const color = categoryColor(a.category);
              const b = cardBadge(a.isRead);
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setModal(toPopup(a))}
                  onKeyDown={(e) => e.key === "Enter" && setModal(toPopup(a))}
                  className="cursor-pointer overflow-hidden rounded-[14px] border border-[#e5e9f0] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5AA0]"
                >
                  {/* 56px kategori renk şeridi */}
                  <div className="flex h-[56px] items-center justify-between px-4 text-white" style={{ background: color }}>
                    <span className="text-[12px] font-semibold uppercase tracking-wide">{categoryLabel(a.category)}</span>
                    <span className="rounded-md bg-black/20 px-2 py-[3px] text-[11px] font-medium">
                      {trTarih(a.publishedAt ?? a.createdAt)}
                    </span>
                  </div>
                  <div className="px-4 pb-4 pt-3.5">
                    <div className="line-clamp-2 min-h-[42px] text-[15px] font-semibold leading-[1.35] text-[#0f172a]">
                      {a.title}
                    </div>
                    {a.summary && (
                      <p className="mt-1.5 line-clamp-2 min-h-[36px] text-[13px] text-[#64748b]">{a.summary}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] text-[#94a3b8]">{a.authorName}</span>
                      <span onClick={(e) => e.stopPropagation()}>
                        <SplitBadge color={b.color} left={b.left} right={b.right} onClick={() => setModal(toPopup(a))} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && <AnnouncementModal a={modal} onDismiss={dismiss} onAcknowledge={acknowledge} />}
    </div>
  );
}
