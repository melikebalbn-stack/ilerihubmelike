"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { StatCard } from "@/components/akademi/dashboard/StatCard";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import { AtamaKursDetay } from "@/components/akademi/admin/atama/AtamaKursDetay";
import { YeniAtamaModal } from "@/components/akademi/admin/atama/YeniAtamaModal";

type Kpi = { atamaliKurs: number; toplamAtama: number; gecikmis: number; tamamlanmaYuzde: number };
type KursRow = {
  id: string;
  title: string;
  category: string | null;
  zorunlu: boolean;
  atanan: number;
  tamamlayan: number;
  ortalamaIlerleme: number;
  gecikmis: number;
  enYakinDueDate: string | null;
};
type CipSayilar = { all: number; zorunlu: number; gecikmesi: number };

const CIPLER: { id: string; label: string; key: keyof CipSayilar }[] = [
  { id: "all", label: "Tümü", key: "all" },
  { id: "zorunlu", label: "Zorunlu", key: "zorunlu" },
  { id: "gecikmesi", label: "Gecikmesi olan", key: "gecikmesi" },
];

function trTarih(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
}

export default function AtamalarPage() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [kurslar, setKurslar] = useState<KursRow[]>([]);
  const [cipSayilar, setCipSayilar] = useState<CipSayilar>({ all: 0, zorunlu: 0, gecikmesi: 0 });
  const [toplam, setToplam] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cip, setCip] = useState("all");
  const [page, setPage] = useState(1);
  const [acikKursId, setAcikKursId] = useState<string | null>(null);
  const [yeniModal, setYeniModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;

  const fetchKurslar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ search, cip, page: String(page), limit: String(limit) });
    fetch(`/api/akademi/admin/assignments/kurslar?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setKpi(d.kpi);
        setKurslar(d.kurslar);
        setCipSayilar(d.cipSayilar);
        setToplam(d.toplam);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, cip, page]);

  // Debounce arama
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchKurslar, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchKurslar]);

  const totalPages = Math.max(1, Math.ceil(toplam / limit));

  return (
    <div>
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ak-animate-in">
        <StatCard compact icon="bookOpen" label="Atamalı kurs" value={kpi?.atamaliKurs ?? 0} color="accent" delayIndex={1} />
        <StatCard compact icon="users" label="Toplam atama" value={kpi?.toplamAtama ?? 0} color="purple" delayIndex={2} />
        <StatCard compact icon="flame" label="Gecikmiş" value={kpi?.gecikmis ?? 0} color="red" delayIndex={3} />
        <StatCard compact icon="trophy" label="Tamamlanma" suffix="%" value={kpi?.tamamlanmaYuzde ?? 0} color="green" delayIndex={4} />
      </div>

      {/* Arama + çip + Yeni Atama */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {CIPLER.map((c) => {
            const active = cip === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { setCip(c.id); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "border-transparent bg-[#1A5AA0] text-white" : "border-[#e5e9f0] bg-white text-[#334155] hover:bg-[#f1f5f9]"
                }`}
              >
                {c.label}
                <span className={active ? "text-white/80" : "text-[#94a3b8]"}>{cipSayilar[c.key]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Kurs ara (ad / kategori)…"
            className="w-full rounded-lg border border-[#e5e9f0] bg-white px-3 py-2 text-sm outline-none focus:border-[#1A5AA0] lg:w-64"
          />
          <button
            type="button"
            onClick={() => setYeniModal(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#1A5AA0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12457c]"
          >
            <Plus className="h-4 w-4" /> Yeni Atama
          </button>
        </div>
      </div>

      {/* Kurs bazlı liste */}
      {loading ? (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>Yükleniyor…</div>
      ) : kurslar.length === 0 ? (
        <div className="ak-card-static p-8 text-center text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Atama bulunamadı.
        </div>
      ) : (
        <div className="space-y-2">
          {kurslar.map((k) => {
            const acik = acikKursId === k.id;
            return (
              <div key={k.id} className="ak-card-static overflow-hidden">
                {/* Kurs satırı */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setAcikKursId(acik ? null : k.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {acik ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-[#0f172a]">{k.title}</span>
                        {k.zorunlu && (
                          <span className="shrink-0 rounded bg-[#fef2f2] px-1.5 py-0.5 text-[10px] font-semibold text-[#dc2626]">Zorunlu</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#64748b]">
                        {k.atanan} atanan · {k.tamamlayan} tamamlayan · en yakın: {trTarih(k.enYakinDueDate)}
                        {k.gecikmis > 0 && <span className="ml-1 text-[#dc2626]">· {k.gecikmis} gecikmiş</span>}
                      </div>
                    </div>
                    {/* ortalama ilerleme çubuğu */}
                    <div className="hidden w-40 shrink-0 sm:block">
                      <div className="mb-0.5 flex justify-between text-[11px] text-[#94a3b8]">
                        <span>ort. ilerleme</span><span>%{k.ortalamaIlerleme}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e5e9f0]">
                        <div className="h-full rounded-full bg-[#1A5AA0]" style={{ width: `${k.ortalamaIlerleme}%` }} />
                      </div>
                    </div>
                  </button>
                  <span onClick={(e) => e.stopPropagation()}>
                    <SplitBadge color="gray" left={`${k.atanan} kişi`} right="Detay" onClick={() => setAcikKursId(acik ? null : k.id)} />
                  </span>
                </div>

                {/* Açılır kurs detayı — kişiler yalnız açılınca yüklenir */}
                {acik && (
                  <div className="border-t border-[#e5e9f0] bg-[#f8fafc] p-4">
                    <AtamaKursDetay courseId={k.id} courseTitle={k.title} onDegisti={fetchKurslar} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span style={{ color: "var(--ak-text-tertiary)" }}>Toplam {toplam} kurs · Sayfa {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#e5e9f0] px-3 py-1.5 disabled:opacity-40">Önceki</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#e5e9f0] px-3 py-1.5 disabled:opacity-40">Sonraki</button>
          </div>
        </div>
      )}

      {yeniModal && <YeniAtamaModal onKapat={() => setYeniModal(false)} onAtandi={() => { setYeniModal(false); fetchKurslar(); }} />}
    </div>
  );
}
