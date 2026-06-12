"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminPackagesTable,
  type PackageSortKey,
} from "@/components/akademi/admin/AdminPackagesTable";
import { AdminPackageFormModal } from "@/components/akademi/admin/AdminPackageFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import type { AdminPackageListItem } from "@/types/akademi-package";

const PAGE_SIZE = 25;

type TypeFilter = "normal" | "ifs" | "all";

export default function AkademiAdminPackagesPage() {
  const [items, setItems] = useState<AdminPackageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filtre / arama / sıralama / sayfalama
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<TypeFilter>("normal"); // default: IFS gizli
  const [includeInactive, setIncludeInactive] = useState(false); // → status
  const [sortBy, setSortBy] = useState<PackageSortKey>("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingPackage, setEditingPackage] =
    useState<AdminPackageListItem | null>(null);

  const [deletePackage, setDeletePackage] =
    useState<AdminPackageListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Arama debounce (~300ms) → sayfayı sıfırla
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadPackages = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sortBy", sortBy);
    params.set("order", order);
    params.set("status", includeInactive ? "all" : "active");
    params.set("type", type);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/akademi/admin/packages?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { items: [], total: 0, pageCount: 1 }))
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setPageCount(data.pageCount ?? 1);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
        setPageCount(1);
      })
      .finally(() => setLoading(false));
  }, [page, sortBy, order, includeInactive, type, debouncedSearch, reloadTick]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const reload = () => setReloadTick((t) => t + 1);

  const onType = (v: TypeFilter) => {
    setType(v);
    setPage(1);
  };
  const onToggleInactive = (v: boolean) => {
    setIncludeInactive(v);
    setPage(1);
  };
  const onSort = (key: PackageSortKey) => {
    if (sortBy === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setOrder("asc");
    }
    setPage(1);
  };

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
    reload();
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
      reload();
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
      const res = await fetch(`/api/akademi/admin/packages/${deletePackage.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setDeletePackage(null);
      reload();
      toast.success("Paket silindi");
    } catch {
      toast.error("Silinemedi");
    } finally {
      setDeleting(false);
    }
  };

  const fromN = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toN = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      {/* Üst satır: arama + Tür + Pasifleri göster + Yeni Paket */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--ak-text-tertiary)" }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Paket adı ara..."
              className="pl-9"
            />
          </div>

          <Select value={type} onValueChange={(v) => onType(v as TypeFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tür" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="ifs">IFS</SelectItem>
              <SelectItem value="all">Hepsi</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={onToggleInactive}
            />
            <Label
              htmlFor="include-inactive"
              className="text-sm cursor-pointer"
            >
              Pasifleri de göster
            </Label>
          </div>
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
        <>
          <AdminPackagesTable
            packages={items}
            onEdit={openEdit}
            onDelete={setDeletePackage}
            onToggleActive={handleToggleActive}
            sort={{ sortBy, order, onSort }}
          />

          {total > 0 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <div style={{ color: "var(--ak-text-tertiary)" }}>
                {fromN}–{toN} / toplam {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Önceki
                </Button>
                <span style={{ color: "var(--ak-text-secondary)" }}>
                  Sayfa {page} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Sonraki
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
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
