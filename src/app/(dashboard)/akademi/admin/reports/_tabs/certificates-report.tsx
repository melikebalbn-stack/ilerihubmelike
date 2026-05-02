"use client";

import { useEffect, useState, useCallback } from "react";

type CertRow = {
  id: string;
  certificateNo: string;
  verificationCode: string;
  user: {
    id: string;
    name: string;
    email: string;
    bolum: string | null;
  };
  course: { id: string; title: string } | null;
  issuedAt: string;
  validUntil: string | null;
  expired: boolean;
  downloadCount: number;
  verificationCount: number;
};

export function CertificatesReportTab() {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiredOnly, setExpiredOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (expiredOnly) params.set("expiredOnly", "true");
    fetch(`/api/akademi/admin/reports/certificates?${params}`)
      .then((r) => r.json())
      .then((d) => setCerts(d.certificates ?? []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, [expiredOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <label
        className="inline-flex items-center gap-2 text-sm cursor-pointer"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <input
          type="checkbox"
          checked={expiredOnly}
          onChange={(e) => setExpiredOnly(e.target.checked)}
          className="w-4 h-4"
        />
        Sadece süresi dolmuş sertifikalar
      </label>

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
          <table className="w-full text-sm">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
