"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import { normalizeTr } from "@/lib/normalize-tr";

type Kurs = { id: string; title: string; category: string | null };
type Kisi = { id: string; ad: string };
type SegTip = "tum" | "filtre" | "kisi";
const YAKALAR = [
  { value: "BEYAZ", label: "Beyaz" },
  { value: "GRI", label: "Gri" },
  { value: "MAVI", label: "Mavi" },
];

export function YeniAtamaModal({ onKapat, onAtandi }: { onKapat: () => void; onAtandi: () => void }) {
  const [kurslar, setKurslar] = useState<Kurs[]>([]);
  const [kursArama, setKursArama] = useState("");
  const [kursId, setKursId] = useState("");
  const [departmanlar, setDepartmanlar] = useState<string[]>([]);
  const [segTip, setSegTip] = useState<SegTip>("tum");
  const [yakalar, setYakalar] = useState<Set<string>>(new Set());
  const [deptler, setDeptler] = useState<Set<string>>(new Set());
  const [kisiArama, setKisiArama] = useState("");
  const [kisiSonuc, setKisiSonuc] = useState<Kisi[]>([]);
  const [seciliKisiler, setSeciliKisiler] = useState<Kisi[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<{ atanacak: number; zatenAtanmis: number; hedefToplam: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [ataLoading, setAtaLoading] = useState(false);
  const [sonuc, setSonuc] = useState("");
  const kisiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/akademi/admin/courses").then((r) => (r.ok ? r.json() : [])).then((d) => {
      setKurslar(Array.isArray(d) ? d : d.courses ?? []);
    }).catch(() => {});
    fetch("/api/akademi/admin/assign/secenekler").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) setDepartmanlar(d.departmanlar ?? []);
    }).catch(() => {});
  }, []);

  const kursFiltre = kursArama.trim()
    ? kurslar.filter((k) => normalizeTr(`${k.title} ${k.category ?? ""}`).includes(normalizeTr(kursArama))).slice(0, 20)
    : kurslar.slice(0, 20);
  const seciliKurs = kurslar.find((k) => k.id === kursId);

  // Kişi arama (debounce)
  useEffect(() => {
    if (segTip !== "kisi" || !kisiArama.trim()) { setKisiSonuc([]); return; }
    if (kisiDebounce.current) clearTimeout(kisiDebounce.current);
    kisiDebounce.current = setTimeout(() => {
      fetch(`/api/users?source=db&search=${encodeURIComponent(kisiArama)}`).then((r) => (r.ok ? r.json() : [])).then((d) => {
        const arr = Array.isArray(d) ? d : d.users ?? [];
        setKisiSonuc(arr.map((u: { id: string; name?: string; adSoyad?: string; email?: string }) => ({ id: u.id, ad: u.name || u.adSoyad || u.email || u.id })));
      }).catch(() => {});
    }, 250);
    return () => { if (kisiDebounce.current) clearTimeout(kisiDebounce.current); };
  }, [kisiArama, segTip]);

  const segment = useCallback(() => {
    if (segTip === "tum") return { tumSirket: true };
    if (segTip === "kisi") return { userIds: seciliKisiler.map((k) => k.id) };
    return { yakalar: [...yakalar], departmanlar: [...deptler] };
  }, [segTip, seciliKisiler, yakalar, deptler]);

  // Önizleme (debounce)
  useEffect(() => {
    if (!kursId) { setPreview(null); return; }
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    setPreviewLoading(true);
    previewDebounce.current = setTimeout(() => {
      fetch("/api/akademi/admin/assign/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: kursId, segment: segment() }),
      }).then((r) => (r.ok ? r.json() : null)).then((d) => setPreview(d)).catch(() => setPreview(null)).finally(() => setPreviewLoading(false));
    }, 300);
    return () => { if (previewDebounce.current) clearTimeout(previewDebounce.current); };
  }, [kursId, segment]);

  const ata = async () => {
    if (!kursId || !preview || preview.atanacak === 0) return;
    setAtaLoading(true);
    try {
      const res = await fetch("/api/akademi/admin/assign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: kursId, segment: segment(), dueDate: dueDate || null }),
      });
      const d = await res.json().catch(() => ({}));
      setSonuc(d.message ?? (res.ok ? "Atandı" : "Hata"));
      if (res.ok) setTimeout(onAtandi, 900);
    } finally {
      setAtaLoading(false);
    }
  };

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onKapat}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e5e9f0] px-6 py-4">
          <h2 className="text-lg font-bold text-[#0f172a]">Yeni Atama</h2>
          <button onClick={onKapat} aria-label="Kapat"><X className="h-5 w-5 text-[#64748b]" /></button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Kurs seçimi (yazarak) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#334155]">Kurs</label>
            {seciliKurs ? (
              <div className="flex items-center justify-between rounded-lg border border-[#1A5AA0] bg-[#eff6ff] px-3 py-2">
                <span className="text-sm font-medium">{seciliKurs.title}</span>
                <button onClick={() => setKursId("")} className="text-[12px] text-[#64748b] hover:underline">değiştir</button>
              </div>
            ) : (
              <>
                <input value={kursArama} onChange={(e) => setKursArama(e.target.value)} placeholder="Kurs ara…" className="w-full rounded-lg border border-[#e5e9f0] px-3 py-2 text-sm outline-none focus:border-[#1A5AA0]" />
                {kursArama.trim() && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[#e5e9f0]">
                    {kursFiltre.map((k) => (
                      <button key={k.id} onClick={() => { setKursId(k.id); setKursArama(""); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f1f5f9]">
                        {k.title}{k.category ? <span className="text-[#94a3b8]"> · {k.category}</span> : null}
                      </button>
                    ))}
                    {kursFiltre.length === 0 && <div className="px-3 py-2 text-sm text-[#94a3b8]">Kurs yok</div>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Hedef kitle */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#334155]">Hedef kitle</label>
            <div className="mb-2 flex gap-2">
              {([["tum", "Tüm şirket"], ["filtre", "Yaka / Departman"], ["kisi", "Kişi"]] as [SegTip, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setSegTip(v)} className={`rounded-full border px-3 py-1.5 text-[13px] ${segTip === v ? "border-transparent bg-[#1A5AA0] text-white" : "border-[#e5e9f0] text-[#334155]"}`}>{l}</button>
              ))}
            </div>

            {segTip === "filtre" && (
              <div className="space-y-3 rounded-lg border border-[#e5e9f0] p-3">
                <div>
                  <div className="mb-1 text-[12px] text-[#64748b]">Yaka (çoklu)</div>
                  <div className="flex flex-wrap gap-2">
                    {YAKALAR.map((y) => (
                      <button key={y.value} onClick={() => toggle(yakalar, setYakalar, y.value)} className={`rounded-full border px-3 py-1 text-[13px] ${yakalar.has(y.value) ? "border-transparent bg-[#1A5AA0] text-white" : "border-[#e5e9f0]"}`}>{y.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[12px] text-[#64748b]">Departman (çoklu) — yaka ile birlikte daraltır</div>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                    {departmanlar.map((d) => (
                      <button key={d} onClick={() => toggle(deptler, setDeptler, d)} className={`rounded-full border px-2.5 py-1 text-[12px] ${deptler.has(d) ? "border-transparent bg-[#1A5AA0] text-white" : "border-[#e5e9f0]"}`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {segTip === "kisi" && (
              <div className="rounded-lg border border-[#e5e9f0] p-3">
                <input value={kisiArama} onChange={(e) => setKisiArama(e.target.value)} placeholder="Kişi ara…" className="w-full rounded-lg border border-[#e5e9f0] px-3 py-2 text-sm" />
                {kisiSonuc.length > 0 && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded border border-[#e5e9f0]">
                    {kisiSonuc.map((k) => (
                      <button key={k.id} onClick={() => { if (!seciliKisiler.find((x) => x.id === k.id)) setSeciliKisiler([...seciliKisiler, k]); setKisiArama(""); setKisiSonuc([]); }} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[#f1f5f9]">{k.ad}</button>
                    ))}
                  </div>
                )}
                {seciliKisiler.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {seciliKisiler.map((k) => (
                      <span key={k.id} className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[12px]">
                        {k.ad}<button onClick={() => setSeciliKisiler(seciliKisiler.filter((x) => x.id !== k.id))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Son tarih */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#334155]">Son tarih (boş = süresiz)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-lg border border-[#e5e9f0] px-3 py-2 text-sm" />
          </div>

          {/* Önizleme */}
          {kursId && (
            <div className="rounded-lg bg-[#f8fafc] p-3 text-sm">
              {previewLoading ? <span className="text-[#94a3b8]">Önizleme hesaplanıyor…</span> : preview ? (
                <span><strong className="text-[#16a34a]">{preview.atanacak} kişi</strong> atanacak · <span className="text-[#64748b]">{preview.zatenAtanmis} zaten atanmış (atlanır)</span></span>
              ) : <span className="text-[#94a3b8]">—</span>}
            </div>
          )}

          {sonuc && <div className="text-sm text-[#16a34a]">{sonuc}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#e5e9f0] px-6 py-4">
          <button onClick={onKapat} className="rounded-lg border border-[#e5e9f0] px-4 py-2 text-sm">İptal</button>
          <SplitBadge color="blue" left={ataLoading ? "Atanıyor…" : `${preview?.atanacak ?? 0} kişi`} right="Ata" onClick={ata} disabled={ataLoading || !kursId || !preview || preview.atanacak === 0} />
        </div>
      </div>
    </div>
  );
}
