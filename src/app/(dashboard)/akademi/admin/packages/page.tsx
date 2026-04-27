"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AdminPackagesTable } from "@/components/akademi/admin/AdminPackagesTable";
import { AdminPackageFormModal } from "@/components/akademi/admin/AdminPackageFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import type { AdminPackageListItem } from "@/types/akademi-package";

export default function AkademiAdminPackagesPage() {
  const [packages, setPackages] = useState<AdminPackageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingPackage, setEditingPackage] =
    useState<AdminPackageListItem | null>(null);

  const [deletePackage, setDeletePackage] =
    useState<AdminPackageListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPackages = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/akademi/admin/packages${includeInactive ? "?includeInactive=true" : ""}`
    )
      .then((r) => (r.ok ? r.json() : { packages: [] }))
      .then((data) => setPackages(data.packages ?? []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, [includeInactive]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const openCreate = () => {
    setModalMode("create");
    setEditingPackage(null);
    setModalOpen(true);
  };

  const openEdit = (pkg: AdminPackageListItem) => {
    setModalMode("edit");
    setEditingPackage(pkg);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    loadPackages();
    toast.success(
      modalMode === "create" ? "Paket oluşturuldu" : "Paket güncellendi"
    );
  };

  const handleToggleActive = async (pkg: AdminPackageListItem) => {
    try {
      const res = await fetch(`/api/akademi/admin/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pkg.isActive }),
      });
      if (!res.ok) throw new Error("update failed");
      loadPackages();
      toast.success(
        pkg.isActive ? "Paket pasifleştirildi" : "Paket aktifleştirildi"
      );
    } catch {
      toast.error("Güncellenemedi");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletePackage) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/packages/${deletePackage.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("delete failed");
      setDeletePackage(null);
      loadPackages();
      toast.success("Paket silindi");
    } catch {
      toast.error("Silinemedi");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Switch
            id="include-inactive"
            checked={includeInactive}
            onCheckedChange={setIncludeInactive}
          />
          <Label htmlFor="include-inactive" className="text-sm cursor-pointer">
            Pasifleri de göster
          </Label>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Yeni Paket
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
        <AdminPackagesTable
          packages={packages}
          onEdit={openEdit}
          onDelete={setDeletePackage}
          onToggleActive={handleToggleActive}
        />
      )}

      <AdminPackageFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        existing={editingPackage}
        onSaved={handleSaved}
      />

      <AdminDeleteConfirm
        open={!!deletePackage}
        onOpenChange={(open) => !open && setDeletePackage(null)}
        title="Paketi sil"
        description={
          deletePackage
            ? `"${deletePackage.name}" paketi kalıcı olarak silinecek. Bu paket altındaki tüm kurs, departman ve kullanıcı atamaları da silinecek. Devam edilsin mi?`
            : ""
        }
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
