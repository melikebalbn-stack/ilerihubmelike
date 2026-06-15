"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminPackageCoursesPicker } from "@/components/akademi/admin/AdminPackageCoursesPicker";
import { AdminPackageBolumPicker } from "@/components/akademi/admin/AdminPackageBolumPicker";
import { AdminPackageUserPicker } from "@/components/akademi/admin/AdminPackageUserPicker";
import { AdminPackageFormModal } from "@/components/akademi/admin/AdminPackageFormModal";
import { AdminCourseFormModal } from "@/components/akademi/admin/AdminCourseFormModal";
import type { AdminPackageDetail } from "@/types/akademi-package";

export default function AkademiAdminPackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [pkg, setPkg] = useState<AdminPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [ifsCourseModalOpen, setIfsCourseModalOpen] = useState(false);

  const loadPackage = useCallback(() => {
    setLoading(true);
    fetch(`/api/akademi/admin/packages/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPkg(data?.package ?? null))
      .catch(() => setPkg(null))
      .finally(() => setLoading(false));
  }, [id]);

  // "Yeni IFS Kursu" → oluştur + bu pakete BAĞLA (PackageCourse PUT set-replace:
  // mevcut kurslar + yeni kurs). Bağlama başarısızsa orphan uyarısı (kurs oluştu
  // ama bağlanmadı → aşağıdaki picker'dan elle eklenebilir).
  const linkNewIfsCourse = useCallback(
    async (created: { id: string }) => {
      if (!pkg) return;
      const courses = [
        ...pkg.courses.map((c) => ({
          courseId: c.courseId,
          order: c.order,
          isRequired: c.isRequired,
        })),
        { courseId: created.id, order: pkg.courses.length, isRequired: true },
      ];
      try {
        const res = await fetch(
          `/api/akademi/admin/packages/${id}/courses`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courses }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(
            `Kurs oluştu ama pakete bağlanamadı: ${err.error || "bilinmeyen hata"}. Aşağıdaki "Kurs Ekle" ile elle ekleyebilirsiniz.`
          );
          return;
        }
        toast.success("IFS kursu oluşturuldu ve pakete bağlandı");
      } catch {
        toast.error(
          "Kurs oluştu ama bağlama sırasında hata oluştu. Aşağıdaki picker'dan elle ekleyin."
        );
      } finally {
        loadPackage();
      }
    },
    [pkg, id, loadPackage]
  );

  useEffect(() => {
    loadPackage();
  }, [loadPackage]);

  if (loading) {
    return (
      <div
        className="ak-card-static p-8 text-center text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Yükleniyor...
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="ak-card-static p-8 text-center">
        <p
          className="text-sm mb-4"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Paket bulunamadı.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/akademi/admin/packages")}
        >
          Paketler listesine dön
        </Button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/akademi/admin/packages")}
        className="inline-flex items-center gap-2 text-sm font-medium mb-4"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Paketler listesine dön
      </button>

      <div className="ak-card-static p-5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2
              className="text-xl font-bold mb-1"
              style={{ color: "var(--ak-text-primary)" }}
            >
              {pkg.name}
            </h2>
            {pkg.description && (
              <p
                className="text-sm mb-2"
                style={{ color: "var(--ak-text-secondary)" }}
              >
                {pkg.description}
              </p>
            )}
            <div
              className="flex items-center gap-4 text-xs"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              <span>{pkg.courseCount} kurs</span>
              <span>•</span>
              <span>{pkg.bolumCount} bölüm</span>
              <span>•</span>
              <span>{pkg.userAssignmentCount} bireysel atama</span>
              <span>•</span>
              <span
                style={{
                  color: pkg.isActive
                    ? "var(--ak-accent)"
                    : "var(--ak-text-tertiary)",
                }}
              >
                {pkg.isActive ? "Aktif" : "Pasif"}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditModalOpen(true)}
          >
            <Edit2 className="w-4 h-4 mr-1.5" />
            Düzenle
          </Button>
        </div>
      </div>

      <Tabs defaultValue="courses" className="w-full">
        <TabsList>
          <TabsTrigger value="courses">Kurslar ({pkg.courseCount})</TabsTrigger>
          <TabsTrigger value="bolums">Bölümler ({pkg.bolumCount})</TabsTrigger>
          <TabsTrigger value="users">
            Bireysel Atamalar ({pkg.userAssignmentCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          {pkg.isIfs && (
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => setIfsCourseModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Yeni IFS Kursu
              </Button>
            </div>
          )}
          <AdminPackageCoursesPicker
            packageId={pkg.id}
            initialCourses={pkg.courses}
            onSaved={loadPackage}
            isIfs={pkg.isIfs}
          />
        </TabsContent>

        <TabsContent value="bolums" className="mt-4">
          <AdminPackageBolumPicker
            packageId={pkg.id}
            initialBolums={pkg.bolums.map((b) => b.bolum)}
            initialDueDate={pkg.bolums.find((b) => b.dueDate)?.dueDate ?? null}
            onSaved={loadPackage}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <AdminPackageUserPicker
            packageId={pkg.id}
            assignments={pkg.userAssignments}
            onSaved={loadPackage}
          />
        </TabsContent>
      </Tabs>

      <AdminPackageFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        existing={{
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          iconColor: pkg.iconColor,
          coverImageUrl: pkg.coverImageUrl,
          isActive: pkg.isActive,
          isIfs: pkg.isIfs,
          courseCount: pkg.courseCount,
          bolumCount: pkg.bolumCount,
          userAssignmentCount: pkg.userAssignmentCount,
          referenceDocs: pkg.referenceDocs,
          createdAt: pkg.createdAt,
          updatedAt: pkg.updatedAt,
        }}
        onSaved={() => {
          setEditModalOpen(false);
          loadPackage();
          toast.success("Paket güncellendi");
        }}
      />

      {/* IFS pakette "Yeni IFS Kursu": oluştur (isIfs=true) + onCreated ile pakete bağla. */}
      {pkg.isIfs && (
        <AdminCourseFormModal
          open={ifsCourseModalOpen}
          onOpenChange={setIfsCourseModalOpen}
          mode="create"
          categories={[]}
          isIfs
          onCreated={linkNewIfsCourse}
          onSaved={() => setIfsCourseModalOpen(false)}
        />
      )}
    </div>
  );
}
