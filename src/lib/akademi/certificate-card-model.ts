import type { SplitBadgeColor } from "@/components/akademi/SplitBadge";

export type CertificateCardInput = {
  id: string;
  certificateNo: string;
  verificationCode: string;
  issuedAt: string;
  validUntil: string | null;
  course: { id: string; title: string; thumbnail?: string | null } | null;
};

export type CertificateCardModel = {
  id: string;
  href: string; // kart tıklaması → doğrulama sayfası
  courseTitle: string;
  certificateNo: string;
  coverImage: string | null;
  coverGradient: string;
  dateBadge: string; // kapak sağ-alt (düzenlenme tarihi)
  validity: { label: string; expired: boolean } | null;
  badge: { color: SplitBadgeColor; left: string; right: string; href: string };
};

function trTarih(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
}

const DOWNLOAD_URL = (id: string) => `/api/akademi/certificates/${id}/download`;

/** Sertifika kartı görünüm modeli (saf, test edilir). now dışarıdan alınır. */
export function buildCertificateCardModel(
  c: CertificateCardInput,
  now: Date = new Date()
): CertificateCardModel {
  const expired = c.validUntil ? new Date(c.validUntil) < now : false;

  const validity = c.validUntil
    ? {
        label: expired
          ? `Süresi doldu — ${trTarih(c.validUntil)}`
          : `Geçerlilik: ${trTarih(c.validUntil)}`,
        expired,
      }
    : { label: "Süresiz geçerli", expired: false };

  const badge: CertificateCardModel["badge"] = expired
    ? { color: "gray", left: "Süresi doldu", right: "PDF İndir", href: DOWNLOAD_URL(c.id) }
    : { color: "green", left: "Geçerli", right: "PDF İndir", href: DOWNLOAD_URL(c.id) };

  return {
    id: c.id,
    href: `/akademi/verify/${c.verificationCode}`,
    courseTitle: c.course?.title ?? "Eğitim",
    certificateNo: c.certificateNo,
    coverImage: c.course?.thumbnail ?? null,
    coverGradient: "linear-gradient(135deg,#12325E,#12B5CB)",
    dateBadge: trTarih(c.issuedAt),
    validity,
    badge,
  };
}
