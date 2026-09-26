"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { CertificateCard } from "@/components/akademi/dashboard/CertificateCard";
import type { CertificateCardInput } from "@/lib/akademi/certificate-card-model";

export default function CertificatesPage() {
  useAkademiAuth();
  const [certs, setCerts] = useState<CertificateCardInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akademi/certificates")
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((d) => setCerts(d.certificates ?? []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      <div className="mb-6 ak-animate-in">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ak-text-primary)" }}>
          Sertifikalarım
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Tamamladığınız eğitimlerin sertifikaları
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Yükleniyor…
        </div>
      ) : certs.length === 0 ? (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Henüz sertifikanız yok.{" "}
          <Link href="/akademi/courses" className="font-medium" style={{ color: "var(--ak-accent)" }}>
            Eğitimlere göz atın
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-[18px]">
          {certs.map((c) => (
            <CertificateCard key={c.id} cert={c} />
          ))}
        </div>
      )}
    </div>
  );
}
