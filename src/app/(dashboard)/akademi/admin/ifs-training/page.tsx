"use client";

// IFS-3a: "IFS Eğitimleri" başlığı — isIfs=true kursları + "IFS Geçiş · ..."
// paketlerini listeler. Yalnız görünür + gezilebilir (yönetim/authoring detayda,
// 3b'de). Mevcut AdminCoursesTable / AdminPackagesTable reuse; tüm satır aksiyonları
// ilgili detay ekranına yönlenir (bu listeden yıkıcı işlem yok).

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminCoursesTable } from "@/components/akademi/admin/AdminCoursesTable";
import { AdminPackagesTable } from "@/components/akademi/admin/AdminPackagesTable";
import { AdminPackageFormModal } from "@/components/akademi/admin/AdminPackageFormModal";
import type { AdminCourseListItem } from "@/types/akademi-admin";
import type { AdminPackageListItem } from "@/types/akademi-package";

export default function AkademiAdminIfsTrainingPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<AdminCourseListItem[]>([]);
  const [packages, setPackages] = useState<AdminPackageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pkgModalOpen, setPkgModalOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/akademi/admin/courses?includeInactive=true").then((r) =>
        r.ok ? r.json() : { courses: [] }
      ),
      fetch("/api/akademi/admin/packages?includeInactive=true").then((r) =>
        r.ok ? r.json() : { packages: [] }
      ),
    ])
      .then(([c, p]) => {
        setCourses(
          (c.courses ?? []).filter((x: AdminCourseListItem) => x.isIfs)
        );
        setPackages(
          (p.packages ?? []).filter((x: AdminPackageListItem) => x.isIfs)
        );
      })
      .catch(() => {
        setCourses([]);
        setPackages([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toCourse = (c: AdminCourseListItem) =>
    router.push(`/akademi/admin/courses/${c.id}`);
  const toPackage = (p: AdminPackageListItem) =>
    router.push(`/akademi/admin/packages/${p.id}`);

  const emptyBox = (text: string) => (
    <div
      className="text-center py-10 text-sm border border-dashed rounded-lg"
      style={{
        borderColor: "var(--ak-border-default)",
        color: "var(--ak-text-tertiary)",
      }}
    >
      {text}
    </div>
  );

  return (
    <div className="ak-animate-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ color: "var(--ak-text-primary)" }}
          >
            IFS Eğitimleri
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--ak-text-secondary)" }}>
            IFS geçiş eğitim alanları ve paketleri. Görev içeriklerini düzenlemek
            için bir kursa veya pakete tıklayın. Yeni bölüm için &ldquo;Yeni IFS
            Paketi&rdquo;, kurs eklemek için paket detayını kullanın.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setPkgModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Yeni IFS Paketi
        </Button>
      </div>

      {loading ? (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h3
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              Paketler ({packages.length})
            </h3>
            {packages.length ? (
              <AdminPackagesTable
                packages={packages}
                onEdit={toPackage}
                onDelete={toPackage}
                onToggleActive={toPackage}
              />
            ) : (
              emptyBox("Henüz IFS paketi yok.")
            )}
          </section>

          <section className="space-y-2">
            <h3
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              Eğitim Alanları / Kurslar ({courses.length})
            </h3>
            {courses.length ? (
              <AdminCoursesTable
                courses={courses}
                onEdit={toCourse}
                onDelete={toCourse}
                onToggleActive={toCourse}
              />
            ) : (
              emptyBox("Henüz IFS kursu yok. (scripts/import-ifs-training.ts ile içe aktarın)")
            )}
          </section>
        </>
      )}

      {/* Yeni IFS Paketi = yeni IFS bölümü (isIfs=true). Başarıda liste yenilenir;
          /akademi/ifs'te bölüm otomatik görünür. */}
      <AdminPackageFormModal
        open={pkgModalOpen}
        onOpenChange={setPkgModalOpen}
        mode="create"
        isIfs
        onSaved={() => {
          setPkgModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
