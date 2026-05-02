"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Eye, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type AdminCert = {
  id: string;
  certificateNo: string;
  verificationCode: string;
  filePath: string | null;
  issuedAt: string;
  user: { id: string; name: string; email: string };
  course: { id: string; title: string } | null;
  _count: { downloads: number; verifications: number };
};

export default function AdminCertificatesPage() {
  const [certs, setCerts] = useState<AdminCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [missingPdfOnly, setMissingPdfOnly] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (missingPdfOnly) params.set("missingPdf", "true");
    fetch(`/api/akademi/admin/certificates?${params}`)
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((d) => setCerts(d.certificates ?? []))
      .catch(() => {
        toast.error("Liste yüklenemedi");
        setCerts([]);
      })
      .finally(() => setLoading(false));
  }, [search, missingPdfOnly]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function handleRegenerate(id: string) {
    setRegeneratingId(id);
    try {
      const res = await fetch(
        `/api/akademi/admin/certificates/${id}/regenerate-pdf`,
        { method: "POST" }
      );
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "PDF üretilemedi");
        return;
      }
      toast.success("PDF üretildi");
      load();
    } catch {
      toast.error("Hata");
    } finally {
      setRegeneratingId(null);
    }
  }

  return (
    <div className="ak-animate-in space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ak-text-tertiary)" }}
          />
          <input
            type="text"
            placeholder="Sertifika no, kullanıcı, kurs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
            style={{
              borderColor: "var(--ak-border-default)",
              background: "var(--ak-surface-input)",
              color: "var(--ak-text-primary)",
            }}
          />
        </div>
        <label
          className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={missingPdfOnly}
            onChange={(e) => setMissingPdfOnly(e.target.checked)}
          />
          Sadece PDF&apos;i eksik olanlar
        </label>
      </div>

      {loading && (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      )}

      {!loading && certs.length === 0 && (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          {search || missingPdfOnly
            ? "Sonuç bulunamadı"
            : "Henüz sertifika verilmemiş"}
        </div>
      )}

      {!loading && certs.length > 0 && (
        <div
          className="rounded-lg overflow-hidden border"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <table className="w-full text-sm">
            <thead style={{ background: "var(--ak-surface-secondary)" }}>
              <tr>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Sertifika No
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Kullanıcı
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Kurs
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Tarih
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  PDF
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  İndirme
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Doğrulama
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr
                  key={c.id}
                  className="border-t transition-colors hover:bg-slate-50"
                  style={{ borderColor: "var(--ak-border-divider)" }}
                >
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {c.certificateNo}
                  </td>
                  <td className="px-4 py-3">
                    <div style={{ color: "var(--ak-text-primary)" }}>
                      {c.user.name}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {c.user.email}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    {c.course?.title ?? "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    {new Date(c.issuedAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.filePath ? (
                      <CheckCircle2
                        size={14}
                        className="text-green-600 mx-auto"
                      />
                    ) : (
                      <button
                        onClick={() => handleRegenerate(c.id)}
                        disabled={regeneratingId === c.id}
                        className="text-xs px-2 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded inline-flex items-center gap-1 disabled:opacity-60"
                      >
                        <RefreshCw
                          size={11}
                          className={
                            regeneratingId === c.id ? "animate-spin" : ""
                          }
                        />
                        {regeneratingId === c.id ? "Üretiliyor..." : "PDF Üret"}
                      </button>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {c._count.downloads}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {c._count.verifications}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/akademi/verify/${c.verificationCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 border rounded hover:bg-slate-100 inline-flex items-center gap-1"
                      style={{ borderColor: "var(--ak-border-default)" }}
                    >
                      <Eye size={11} />
                      Görüntüle
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
