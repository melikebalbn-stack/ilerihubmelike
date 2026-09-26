"use client";

import { useRouter } from "next/navigation";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import {
  buildCertificateCardModel,
  type CertificateCardInput,
} from "@/lib/akademi/certificate-card-model";

/**
 * Sertifika kartı — CourseCard/ExamCard ile aynı görünüm ailesi. Kapak = eğitim
 * thumbnail'i (yoksa degrade), sol üst yeşil "Sertifika" etiketi, sağ alt tarih;
 * altta eğitim adı, sertifika no + geçerlilik, SplitBadge PDF İndir. Tüm kart
 * tıklanabilir (doğrulama sayfası); rozet ayrı link (PDF indirir).
 */
export function CertificateCard({ cert }: { cert: CertificateCardInput }) {
  const router = useRouter();
  const m = buildCertificateCardModel(cert);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(m.href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(m.href);
      }}
      className="cursor-pointer overflow-hidden rounded-[14px] border border-[#e5e9f0] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5AA0]"
    >
      {/* Kapak */}
      <div
        className="relative h-[150px]"
        style={
          m.coverImage
            ? { backgroundImage: `url(${m.coverImage})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: m.coverGradient }
        }
      >
        <span className="absolute left-3 top-3 rounded-full bg-[#16a34a] px-[9px] py-1 text-[11px] font-semibold text-white">
          Sertifika
        </span>
        <span className="absolute bottom-[14px] right-3 rounded-md bg-[rgba(15,23,42,.75)] px-2 py-[3px] text-[11px] font-medium text-white">
          {m.dateBadge}
        </span>
      </div>

      {/* Gövde */}
      <div className="px-4 pb-4 pt-3.5">
        <div className="line-clamp-2 min-h-[40px] text-[15px] font-semibold leading-[1.35] text-[#0f172a]">
          {m.courseTitle}
        </div>
        <div className="mt-1.5 font-mono text-[12px] text-[#64748b]">
          Sertifika No {m.certificateNo}
        </div>
        {m.validity && (
          <div
            className={`mt-0.5 text-[12px] ${m.validity.expired ? "font-medium text-[#dc2626]" : "text-[#64748b]"}`}
          >
            {m.validity.label}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-end">
          <span onClick={(e) => e.stopPropagation()}>
            <SplitBadge
              color={m.badge.color}
              left={m.badge.left}
              right={m.badge.right}
              href={m.badge.href}
              download
            />
          </span>
        </div>
      </div>
    </div>
  );
}
