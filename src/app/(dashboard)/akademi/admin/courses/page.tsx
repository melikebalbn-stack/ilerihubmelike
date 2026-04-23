import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";

export default function AkademiAdminCoursesPage() {
  return (
    <div className="ak-animate-in">
      <div className="ak-card-static p-8 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--ak-accent-glow)" }}
        >
          <BookOpen
            className="w-8 h-8"
            style={{ color: "var(--ak-accent)" }}
          />
        </div>
        <div
          className="text-lg font-bold mb-2"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Kurs Yönetimi
        </div>
        <p
          className="text-sm mb-6 max-w-md mx-auto"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Kurs oluşturma, düzenleme, silme ve içerik yönetimi{" "}
          <strong>Sprint 2a PR-B2</strong>&apos;de aktif olacak.
        </p>
        <Link
          href="/akademi/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--ak-accent)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Admin Paneline Dön
        </Link>
      </div>
    </div>
  );
}
