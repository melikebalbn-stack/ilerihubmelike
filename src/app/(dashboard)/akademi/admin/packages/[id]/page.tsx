"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminPackageCoursesPicker } from "@/components/akademi/admin/AdminPackageCoursesPicker";
import { AdminPackageBolumPicker } from "@/components/akademi/admin/AdminPackageBolumPicker";
import { AdminPackageUserPicker } from "@/components/akademi/admin/AdminPackageUserPicker";
import { AdminPackageFormModal } from "@/components/akademi/admin/AdminPackageFormModal";
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

  const loadPackage = useCallback(() => {
    setLoading(true);
    fetch(`/api/akademi/admin/packages/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPkg(data?.package ?? null))
      .catch(() => setPkg(null))
      .finally(() => setLoading(false));
  }, [id]);

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
          <AdminPackageCoursesPicker
            packageId={pkg.id}
            initialCourses={pkg.courses}
            onSaved={loadPackage}
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
          isActive: pkg.isActive,
          isIfs: pkg.isIfs,
          courseCount: pkg.courseCount,
          bolumCount: pkg.bolumCount,
          userAssignmentCount: pkg.userAssignmentCount,
          createdAt: pkg.createdAt,
          updatedAt: pkg.updatedAt,
        }}
        onSaved={() => {
          setEditModalOpen(false);
          loadPackage();
          toast.success("Paket güncellendi");
        }}
      />
    </div>
  );
}
