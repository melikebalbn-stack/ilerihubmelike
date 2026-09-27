"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import { DURUM_ETIKET, type AtamaDurum } from "@/lib/akademi/atama-model";

type Kisi = {
  userAssignmentId: string;
  userId: string;
  ad: string;
  departman: string;
  yaka: string | null;
  atandi: string;
  dueDate: string | null;
  ilerleme: number;
  durum: AtamaDurum;
};

const YAKA_ET: Record<string, string> = { MAVI: "Mavi", BEYAZ: "Beyaz", GRI: "Gri" };
const DURUM_CIP: { id: string; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "BASLAMADI", label: "Başlamadı" },
  { id: "DEVAM", label: "Devam" },
  { id: "BITTI", label: "Bitti" },
  { id: "GECIKTI", label: "Gecikti" },
];

function trTarih(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
}

export function AtamaKursDetay({
  courseId,
  courseTitle,
  onDegisti,
}: {
  courseId: string;
  courseTitle: string;
  onDegisti: () => void;
}) {
  const [kisiler, setKisiler] = useState<Kisi[]>([]);
  const [durumSayilar, setDurumSayilar] = useState<Record<string, number>>({});
  const [departmanlar, setDepartmanlar] = useState<string[]>([]);
  const [yakalar, setYakalar] = useState<string[]>([]);
  const [toplam, setToplam] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [durum, setDurum] = useState("all");
  const [departman, setDepartman] = useState("all");
  const [yaka, setYaka] = useState("all");
  const [page, setPage] = useState(1);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [uzatTarih, setUzatTarih] = useState("");
  const [islemMesaj, setIslemMesaj] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 50;
  void courseTitle;

  const filtreQS = useCallback(
    () => new URLSearchParams({ search, durum, departman, yaka }).toString(),
    [search, durum, departman, yaka]
  );

  const fetchKisiler = useCallback(() => {
    setLoading(true);
    fetch(`/api/akademi/admin/assignments/kurs/${courseId}/kisiler?${filtreQS()}&page=${page}&limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setKisiler(d.kisiler);
        setDurumSayilar(d.durumSayilar);
        setDepartmanlar(d.departmanlar);
        setYakalar(d.yakalar);
        setToplam(d.toplam);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId, filtreQS, page]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchKisiler, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchKisiler]);

  const totalPages = Math.max(1, Math.ceil(toplam / limit));
  const sayfaIds = kisiler.map((k) => k.userAssignmentId);
  const hepsiSecili = sayfaIds.length > 0 && sayfaIds.every((id) => secili.has(id));

  const toggle = (id: string) =>
    setSecili((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleHepsi = () =>
    setSecili((s) => { const n = new Set(s); if (hepsiSecili) sayfaIds.forEach((id) => n.delete(id)); else sayfaIds.forEach((id) => n.add(id)); return n; });

  const topluIslem = async (action: string, extra: Record<string, unknown> = {}) => {
    const ids = [...secili];
    if (!ids.length) return;
    const res = await fetch("/api/akademi/admin/assignments/toplu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userAssignmentIds: ids, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    setIslemMesaj(d.message ?? (res.ok ? "Tamam" : "Hata"));
    setSecili(new Set());
    fetchKisiler();
    onDegisti();
  };

  const hatirlat = async (id: string) => {
    await fetch("/api/akademi/admin/assignments/toplu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hatirlat", userAssignmentIds: [id] }),
    });
    setIslemMesaj("Hatırlatma gönderildi");
  };

  function durumBadge(k: Kisi) {
    if (k.durum === "BITTI")
      return <SplitBadge color="green" left="Bitti" right="Sertifika" download href={`/api/akademi/admin/sertifika?userId=${k.userId}&courseId=${courseId}`} />;
    const renk = k.durum === "GECIKTI" ? "red" : "blue";
    return <SplitBadge color={renk} left={DURUM_ETIKET[k.durum]} right="Hatırlat" onClick={() => hatirlat(k.userAssignmentId)} />;
  }

  return (
    <div>
      {/* Araç çubuğu: Excel / seçili işlemler */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SplitBadge color="green" left="Excel" right="İndir" download href={`/api/akademi/admin/assignments/kurs/${courseId}/excel?${filtreQS()}`} />
        <input type="date" value={uzatTarih} onChange={(e) => setUzatTarih(e.target.value)} className="rounded-lg border border-[#e5e9f0] px-2 py-1.5 text-sm" />
        <SplitBadge color="blue" left={`Seçili ${secili.size}`} right="Süre uzat" onClick={() => topluIslem("sure-uzat", { dueDate: uzatTarih || null })} disabled={secili.size === 0} />
        <SplitBadge color="gray" left={`Seçili ${secili.size}`} right="Kaldır" onClick={() => topluIslem("kaldir")} disabled={secili.size === 0} />
        {islemMesaj && <span className="text-[12px] text-[#16a34a]">{islemMesaj}</span>}
      </div>

      {/* Filtreler */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Kişi ara…" className="rounded-lg border border-[#e5e9f0] px-3 py-1.5 text-sm"
        />
        {DURUM_CIP.map((c) => {
          const active = durum === c.id;
          const say = durumSayilar[c.id === "all" ? "all" : c.id] ?? 0;
          return (
            <button key={c.id} type="button" onClick={() => { setDurum(c.id); setPage(1); }}
              className={`rounded-full border px-2.5 py-1 text-[12px] ${active ? "border-transparent bg-[#1A5AA0] text-white" : "border-[#e5e9f0] bg-white text-[#334155]"}`}>
              {c.label} <span className={active ? "text-white/80" : "text-[#94a3b8]"}>{say}</span>
            </button>
          );
        })}
        <select value={departman} onChange={(e) => { setDepartman(e.target.value); setPage(1); }} className="rounded-lg border border-[#e5e9f0] px-2 py-1.5 text-sm">
          <option value="all">Tüm bölümler</option>
          {departmanlar.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={yaka} onChange={(e) => { setYaka(e.target.value); setPage(1); }} className="rounded-lg border border-[#e5e9f0] px-2 py-1.5 text-sm">
          <option value="all">Tüm yakalar</option>
          {yakalar.map((y) => <option key={y} value={y}>{YAKA_ET[y] ?? y}</option>)}
        </select>
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="py-4 text-sm text-[#94a3b8]">Yükleniyor…</div>
      ) : kisiler.length === 0 ? (
        <div className="py-4 text-sm text-[#94a3b8]">Kişi bulunamadı.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#e5e9f0] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#f1f5f9] text-left text-[12px] text-[#64748b]">
              <tr>
                <th className="px-3 py-2"><input type="checkbox" checked={hepsiSecili} onChange={toggleHepsi} /></th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Departman</th>
                <th className="px-3 py-2">Yaka</th>
                <th className="px-3 py-2">Atandı</th>
                <th className="px-3 py-2">Son Tarih</th>
                <th className="px-3 py-2">İlerleme</th>
                <th className="px-3 py-2 text-right">Durum</th>
              </tr>
            </thead>
            <tbody>
              {kisiler.map((k) => (
                <tr key={k.userAssignmentId} className="border-t border-[#eef2f7]">
                  <td className="px-3 py-2"><input type="checkbox" checked={secili.has(k.userAssignmentId)} onChange={() => toggle(k.userAssignmentId)} /></td>
                  <td className="px-3 py-2 font-medium text-[#0f172a]">{k.ad}</td>
                  <td className="px-3 py-2 text-[#64748b]">{k.departman}</td>
                  <td className="px-3 py-2 text-[#64748b]">{k.yaka ? YAKA_ET[k.yaka] ?? k.yaka : "—"}</td>
                  <td className="px-3 py-2 text-[#64748b]">{trTarih(k.atandi)}</td>
                  <td className="px-3 py-2 text-[#64748b]">{trTarih(k.dueDate)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#e5e9f0]">
                        <div className="h-full rounded-full bg-[#1A5AA0]" style={{ width: `${k.ilerleme}%` }} />
                      </div>
                      <span className="text-[11px] text-[#94a3b8]">%{k.ilerleme}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right"><span className="inline-flex">{durumBadge(k)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-[13px]">
          <span className="text-[#94a3b8]">Toplam {toplam} kişi · Sayfa {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-[#e5e9f0] px-2 py-1 disabled:opacity-40">Önceki</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-[#e5e9f0] px-2 py-1 disabled:opacity-40">Sonraki</button>
          </div>
        </div>
      )}
    </div>
  );
}
