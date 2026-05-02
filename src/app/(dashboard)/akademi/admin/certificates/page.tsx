"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Eye } from "lucide-react";
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

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/akademi/admin/certificates?${params}`)
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((d) => setCerts(d.certificates ?? []))
      .catch(() => {
        toast.error("Liste yüklenemedi");
        setCerts([]);
      })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="ak-animate-in space-y-4">
      <div className="relative max-w-md">
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
          {search ? "Sonuç bulunamadı" : "Henüz sertifika verilmemiş"}
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
