"use client";

import { useEffect, useState, useCallback } from "react";
import { Eye, Search } from "lucide-react";

type CertRow = {
  id: string;
  certificateNo: string;
  verificationCode: string;
  user: {
    id: string;
    name: string;
    email: string;
    bolum: string | null;
    yaka: "YONETICI" | "BEYAZ" | "GRI" | "MAVI" | null;
  };
  course: { id: string; title: string } | null;
  issuedAt: string;
  validUntil: string | null;
  expired: boolean;
  downloadCount: number;
  verificationCount: number;
};

const YAKA_ETIKET: Record<
  NonNullable<CertRow["user"]["yaka"]>,
  string
> = {
  YONETICI: "Yönetici",
  BEYAZ: "Beyaz yaka",
  GRI: "Gri yaka",
  MAVI: "Mavi yaka",
};

export function CertificatesReportTab() {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [bolumFilter, setBolumFilter] = useState("");
  const [yakaFilter, setYakaFilter] = useState("");
  const [bolums, setBolums] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/akademi/admin/reports/departments")
      .then((r) => r.json())
      .then((d) =>
        setBolums((d.departments ?? []).map((b: { bolum: string }) => b.bolum))
      )
      .catch(() => setBolums([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (expiredOnly) params.set("expiredOnly", "true");
    if (search) params.set("search", search);
    if (bolumFilter) params.set("bolum", bolumFilter);
    if (yakaFilter) params.set("yaka", yakaFilter);
    fetch(`/api/akademi/admin/reports/certificates?${params}`)
      .then((r) => r.json())
      .then((d) => setCerts(d.certificates ?? []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, [expiredOnly, search, bolumFilter, yakaFilter]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Kişi, e-posta veya sertifika no ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
            style={{ borderColor: "var(--ak-border-default)" }}
          />
        </div>
        <select
          value={bolumFilter}
          onChange={(e) => setBolumFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <option value="">Tüm bölümler</option>
          {bolums.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={yakaFilter}
          onChange={(e) => setYakaFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <option value="">Tüm yakalar</option>
          <option value="YONETICI">Yönetici</option>
          <option value="BEYAZ">Beyaz yaka</option>
          <option value="GRI">Gri yaka</option>
          <option value="MAVI">Mavi yaka</option>
        </select>
        <label
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md bg-white cursor-pointer select-none"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <input
            type="checkbox"
            checked={expiredOnly}
            onChange={(e) => setExpiredOnly(e.target.checked)}
            className="w-4 h-4"
          />
          Süresi dolmuş
        </label>
        <span
          className="text-xs ml-auto"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          {certs.length} sertifika
        </span>
      </div>

      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
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
          {expiredOnly
            ? "Süresi dolmuş sertifika yok"
            : "Henüz sertifika yok"}
        </div>
      )}

      {!loading && certs.length > 0 && (
        <div
          className="rounded-lg overflow-hidden border bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <table className="w-full text-xs">
            <thead style={{ background: "var(--ak-surface-secondary)" }}>
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Sertifika No
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Kullanıcı
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Kurs
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Veriliş
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Geçerlilik
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  İndirme
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Doğrulama
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr
                  key={c.id}
                  className="border-t hover:bg-slate-50"
                  style={{ borderColor: "var(--ak-border-divider)" }}
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    {c.certificateNo}
                  </td>
                  <td className="px-4 py-2">
                    <div>{c.user.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {c.user.bolum ?? "—"}
                      {c.user.yaka ? ` · ${YAKA_ETIKET[c.user.yaka]}` : ""}
                    </div>
                  </td>
                  <td
                    className="px-4 py-2"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    {c.course?.title ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(c.issuedAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {c.validUntil ? (
                      <span
                        className={
                          c.expired ? "text-red-600 font-semibold" : ""
                        }
                      >
                        {new Date(c.validUntil).toLocaleDateString("tr-TR")}
                        {c.expired && " (Dolmuş)"}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ak-text-tertiary)" }}>
                        Sınırsız
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">{c.downloadCount}</td>
                  <td className="px-4 py-2 text-center">
                    {c.verificationCount}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/api/akademi/certificates/${c.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      title={`${c.user.name} — sertifikayı aç`}
                    >
                      <Eye size={13} />
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
