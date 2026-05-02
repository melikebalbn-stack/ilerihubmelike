"use client";

import { useEffect, useState } from "react";
import { Award, Download, Copy, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAkademiAuth } from "@/lib/akademi-auth";

type Certificate = {
  id: string;
  certificateNo: string;
  verificationCode: string;
  filePath: string | null;
  issuedAt: string;
  validUntil: string | null;
  course: { id: string; title: string } | null;
  _count: { downloads: number };
};

export default function CertificatesPage() {
  useAkademiAuth();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akademi/certificates")
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((d) => setCerts(d.certificates ?? []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, []);

  function copyText(text: string, label: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} kopyalandı`);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="ak-animate-in space-y-5">
      <div>
        <h1
          className="text-2xl font-bold flex items-center gap-2"
          style={{ color: "var(--ak-text-primary)" }}
        >
          <Award size={24} />
          Sertifikalarım
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Tamamladığınız kursların sertifikaları
        </p>
      </div>

      {certs.length === 0 && (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Henüz sertifikanız yok. Bir kursu tamamlayın ve gerekli sınavları
          geçin.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certs.map((c) => {
          const verifyUrl =
            typeof window !== "undefined"
              ? `${window.location.origin}/akademi/verify/${c.verificationCode}`
              : `/akademi/verify/${c.verificationCode}`;
          return (
            <div
              key={c.id}
              className="border-2 border-amber-200 bg-amber-50/30 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded">
                  <Award size={28} className="text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {c.course?.title ?? "Kurs"}
                  </h3>
                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    Sertifika No:{" "}
                    <span className="font-mono">{c.certificateNo}</span>
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    Tarih: {new Date(c.issuedAt).toLocaleDateString("tr-TR")}
                  </div>
                  {c.validUntil && (
                    <div
                      className={`text-xs mt-0.5 ${
                        new Date(c.validUntil) < new Date()
                          ? "text-red-600 font-semibold"
                          : ""
                      }`}
                      style={
                        new Date(c.validUntil) < new Date()
                          ? undefined
                          : { color: "var(--ak-text-tertiary)" }
                      }
                    >
                      Geçerlilik:{" "}
                      {new Date(c.validUntil).toLocaleDateString("tr-TR")}
                      {new Date(c.validUntil) < new Date() && (
                        <span className="ml-1">(SÜRESİ DOLMUŞ)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {c.filePath ? (
                  <a
                    href={`/api/akademi/certificates/${c.id}/download`}
                    download
                    className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 inline-flex items-center gap-1.5 font-medium"
                  >
                    <Download size={12} />
                    PDF İndir
                  </a>
                ) : (
                  <a
                    href={`/api/akademi/certificates/${c.id}/download`}
                    className="text-xs px-3 py-1.5 bg-amber-100 text-amber-800 rounded inline-flex items-center gap-1.5 font-medium hover:bg-amber-200"
                    title="PDF henüz hazır değil — tıkladığında üretilir"
                  >
                    <Clock size={12} />
                    PDF Oluştur
                  </a>
                )}
                <button
                  onClick={() => copyText(c.verificationCode, "Doğrulama kodu")}
                  className="text-xs px-3 py-1.5 border rounded hover:bg-slate-50 inline-flex items-center gap-1.5"
                  style={{ borderColor: "var(--ak-border-default)" }}
                  title="Doğrulama kodunu kopyala"
                >
                  <Copy size={12} />
                  Kod
                </button>
                <button
                  onClick={() => copyText(verifyUrl, "Doğrulama linki")}
                  className="text-xs px-3 py-1.5 border rounded hover:bg-slate-50 inline-flex items-center gap-1.5"
                  style={{ borderColor: "var(--ak-border-default)" }}
                  title="Doğrulama URL'sini kopyala"
                >
                  <ExternalLink size={12} />
                  Link
                </button>
              </div>

              {c._count.downloads > 0 && (
                <div
                  className="text-xs mt-2"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  {c._count.downloads} kez indirildi
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
