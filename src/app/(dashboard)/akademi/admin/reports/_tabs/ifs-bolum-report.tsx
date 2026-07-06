"use client";

// PR-IFS-RAPOR-2b: Bölüm-öncelikli IFS raporu görünümü.
// Tek dropdown (bölüm) → özet kartları + kişi×kurs tablosu (Son Tarih + Durum).
// Export: Excel/PDF (bölüm) + kişi başına PDF. İndirme navigasyonsuz blob.

import { useEffect, useState, useCallback } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ILERI = "#1B4F72";

type Durum = "YOLUNDA" | "GECIKTI" | "TARIHSIZ";
interface KursRow {
  courseId: string;
  kursAd: string;
  gorevCount: number;
  basarili: number;
  pct: number;
  dueDate: string | null;
  durum: Durum;
}
interface Kisi {
  userId: string;
  adSoyad: string;
  kurslar: KursRow[];
}
interface BolumReport {
  bolum: string;
  summary: {
    kisiSayisi: number;
    toplamGorev: number;
    basariliGorev: number;
    ortalamaPct: number;
    gecikenKisi: number;
  };
  kisiler: Kisi[];
}

const DURUM_LABEL: Record<Durum, string> = {
  YOLUNDA: "Yolunda",
  GECIKTI: "Gecikti",
  TARIHSIZ: "Tarihsiz",
};
const DURUM_CLS: Record<Durum, string> = {
  YOLUNDA: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  GECIKTI: "bg-red-100 text-red-700 hover:bg-red-100",
  TARIHSIZ: "bg-slate-100 text-slate-600 hover:bg-slate-100",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ak-card-static p-4">
      <div className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1" style={{ color: ILERI }}>
        {value}
      </div>
    </div>
  );
}

// Ortak blob indirme (navigasyonsuz; hata → toast).
async function blobDownload(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j) => j?.error)
      .catch(() => null);
    throw new Error(
      msg ??
        (res.status === 401 || res.status === 403
          ? "Bu raporu indirme yetkiniz yok"
          : "Rapor indirilemedi")
    );
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

export function IfsBolumReportView() {
  const [bolums, setBolums] = useState<string[]>([]);
  const [bolum, setBolum] = useState("");
  const [report, setReport] = useState<BolumReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<"xlsx" | "pdf" | null>(null);
  const [kisiDownloading, setKisiDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/akademi/admin/reports/ifs-bolum")
      .then((r) => (r.ok ? r.json() : { bolums: [] }))
      .then((d) => {
        const list: string[] = d.bolums ?? [];
        setBolums(list);
        if (list.length) setBolum(list[0]);
      })
      .catch(() => setBolums([]));
  }, []);

  useEffect(() => {
    if (!bolum) return;
    setLoading(true);
    fetch(`/api/akademi/admin/reports/ifs-bolum?bolum=${encodeURIComponent(bolum)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReport(d))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [bolum]);

  const exportBolum = useCallback(
    async (format: "xlsx" | "pdf") => {
      if (!bolum || downloading) return;
      setDownloading(format);
      try {
        await blobDownload(
          `/api/akademi/admin/reports/ifs-aggregate/export?mode=bolum&format=${format}&bolum=${encodeURIComponent(bolum)}`,
          `IFS-Bolum-Raporu.${format === "pdf" ? "pdf" : "xlsx"}`
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Rapor indirilemedi");
      } finally {
        setDownloading(null);
      }
    },
    [bolum, downloading]
  );

  const exportKisi = useCallback(
    async (userId: string, adSoyad: string) => {
      if (!bolum || kisiDownloading) return;
      setKisiDownloading(userId);
      try {
        await blobDownload(
          `/api/akademi/admin/reports/ifs-aggregate/export?mode=kisi&format=pdf&bolum=${encodeURIComponent(bolum)}&userId=${encodeURIComponent(userId)}`,
          `IFS-Kisi-${adSoyad}.pdf`
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Rapor indirilemedi");
      } finally {
        setKisiDownloading(null);
      }
    },
    [bolum, kisiDownloading]
  );

  const s = report?.summary;

  return (
    <div className="ak-animate-in space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="text-xs font-medium block"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Bölüm
          </label>
          <Select value={bolum} onValueChange={setBolum}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Bölüm seçin" />
            </SelectTrigger>
            <SelectContent>
              {bolums.length === 0 && (
                <SelectItem value="__none" disabled>
                  Bölüm yok
                </SelectItem>
              )}
              {bolums.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-end gap-2">
          <button
            type="button"
            onClick={() => exportBolum("xlsx")}
            disabled={!bolum || downloading !== null}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white transition ${
              bolum && downloading === null
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            {downloading === "xlsx" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            Excel İndir
          </button>
          <button
            type="button"
            onClick={() => exportBolum("pdf")}
            disabled={!bolum || downloading !== null}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white transition ${
              bolum && downloading === null
                ? "bg-slate-900 hover:bg-slate-800"
                : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            {downloading === "pdf" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            PDF İndir
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      ) : !report || report.kisiler.length === 0 ? (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Bu bölümde IFS eğitim ataması bulunamadı.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card label="Kişi" value={s!.kisiSayisi} />
            <Card label="Toplam Görev" value={s!.toplamGorev} />
            <Card label="BAŞARILI" value={s!.basariliGorev} />
            <Card label="Ortalama %" value={`%${s!.ortalamaPct}`} />
            <Card label="Geciken" value={s!.gecikenKisi} />
          </div>

          <div className="ak-card-static overflow-hidden" style={{ padding: 0 }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--ak-surface-2)" }}>
                <tr
                  className="text-xs uppercase tracking-wide"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  <th className="text-left px-4 py-3">Ad Soyad</th>
                  <th className="text-left px-4 py-3">Eğitim</th>
                  <th className="text-left px-4 py-3">Görev</th>
                  <th className="text-left px-4 py-3">BAŞARILI</th>
                  <th className="text-left px-4 py-3">%</th>
                  <th className="text-left px-4 py-3">Son Tarih</th>
                  <th className="text-left px-4 py-3">Durum</th>
                </tr>
              </thead>
              <tbody>
                {report.kisiler.map((k) =>
                  k.kurslar.map((c, ci) => (
                    <tr
                      key={`${k.userId}-${c.courseId}`}
                      className="border-t"
                      style={{ borderColor: "var(--ak-border-divider)" }}
                    >
                      <td className="px-4 py-3 font-medium align-top">
                        {ci === 0 && (
                          <div className="flex items-center gap-2">
                            <span>{k.adSoyad}</span>
                            <button
                              type="button"
                              onClick={() => exportKisi(k.userId, k.adSoyad)}
                              disabled={kisiDownloading !== null}
                              title="Kişi PDF"
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-slate-50 disabled:opacity-50"
                              style={{ borderColor: "var(--ak-border-default)" }}
                            >
                              {kisiDownloading === k.userId ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <FileText size={12} />
                              )}
                              PDF
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{c.kursAd}</td>
                      <td className="px-4 py-3">{c.gorevCount}</td>
                      <td className="px-4 py-3">{c.basarili}</td>
                      <td
                        className="px-4 py-3 font-semibold"
                        style={{ color: ILERI }}
                      >
                        %{c.pct}
                      </td>
                      <td className="px-4 py-3">{fmtDate(c.dueDate)}</td>
                      <td className="px-4 py-3">
                        <Badge className={DURUM_CLS[c.durum]} variant="secondary">
                          {DURUM_LABEL[c.durum]}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
