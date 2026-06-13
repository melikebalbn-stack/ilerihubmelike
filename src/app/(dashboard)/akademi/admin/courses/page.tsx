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
  AdminCoursesTable,
  type CourseSortKey,
} from "@/components/akademi/admin/AdminCoursesTable";
import { AdminCourseFormModal } from "@/components/akademi/admin/AdminCourseFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import type { AdminCourseListItem } from "@/types/akademi-admin";

const ALL = "__all__"; // Radix Select boş value kabul etmez → "Hepsi" sentinel
const PAGE_SIZE = 25;

type TypeFilter = "normal" | "ifs" | "all";

export default function AkademiAdminCoursesPage() {
  const [items, setItems] = useState<AdminCourseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtre / arama / sıralama / sayfalama durumu
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [difficulty, setDifficulty] = useState<string>(ALL);
  const [type, setType] = useState<TypeFilter>("normal"); // default: IFS gizli
  const [includeInactive, setIncludeInactive] = useState(false); // → status
  const [sortBy, setSortBy] = useState<CourseSortKey>("title");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  // Arama debounce (~300ms) → sayfayı sıfırla
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadCourses = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sortBy", sortBy);
    params.set("order", order);
    params.set("status", includeInactive ? "all" : "active");
    params.set("type", type);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (category !== ALL) params.set("category", category);
    if (difficulty !== ALL) params.set("difficulty", difficulty);

    fetch(`/api/akademi/admin/courses?${params.toString()}`)
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
  }, [
    page,
    sortBy,
    order,
    includeInactive,
    type,
    debouncedSearch,
    category,
    difficulty,
    reloadTick,
  ]);

  const loadCategories = useCallback(() => {
    fetch("/api/akademi/admin/courses/categories")
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const reload = () => setReloadTick((t) => t + 1);

  // Filtre değişince sayfayı 1'e al
  const onCategory = (v: string) => {
    setCategory(v);
    setPage(1);
  };
  const onDifficulty = (v: string) => {
    setDifficulty(v);
    setPage(1);
  };
  const onType = (v: TypeFilter) => {
    setType(v);
    setPage(1);
  };
  const onToggleInactive = (v: boolean) => {
    setIncludeInactive(v);
    setPage(1);
  };

  const onSort = (key: CourseSortKey) => {
    if (sortBy === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setOrder("asc");
    }
    setPage(1);
  };

  // ── Modal / sil / toggle (DEĞİŞMEDİ) ──
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCourse, setEditingCourse] =
    useState<AdminCourseListItem | null>(null);
  const [deleteCourse, setDeleteCourse] =
    useState<AdminCourseListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setModalMode("create");
    setEditingCourse(null);
    setModalOpen(true);
  };
  const openEdit = (course: AdminCourseListItem) => {
    setModalMode("edit");
    setEditingCourse(course);
    setModalOpen(true);
  };
  const handleSaved = () => {
    reload();
    loadCategories();
  };
  const handleToggleActive = async (course: AdminCourseListItem) => {
    try {
      const res = await fetch(`/api/akademi/admin/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !course.isActive }),
      });
      if (!res.ok) {
        toast.error("Durum değiştirilemedi");
        return;
      }
      toast.success(
        course.isActive ? "Kurs pasifleştirildi" : "Kurs aktifleştirildi"
      );
      reload();
    } catch {
      toast.error("Bir hata oluştu");
    }
  };
  const handleDeleteConfirm = async () => {
    if (!deleteCourse) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/akademi/admin/courses/${deleteCourse.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Silinemedi");
        return;
      }
      toast.success("Kurs kalıcı olarak silindi");
      setDeleteCourse(null);
      reload();
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  const fromN = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toN = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="ak-animate-in">
      {/* Üst satır: arama + Pasifleri göster + Yeni Kurs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--ak-text-tertiary)" }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kurs adı ara..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="includeInactive"
              checked={includeInactive}
              onCheckedChange={onToggleInactive}
            />
            <Label htmlFor="includeInactive" className="text-sm cursor-pointer">
              Pasifleri göster
            </Label>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Yeni Kurs
          </Button>
        </div>
      </div>

      {/* Filtre satırı: Kategori / Zorluk / Tür */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={category} onValueChange={onCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm Kategoriler</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={onDifficulty}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Zorluk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm Zorluklar</SelectItem>
            <SelectItem value="BEGINNER">Başlangıç</SelectItem>
            <SelectItem value="INTERMEDIATE">Orta Seviye</SelectItem>
            <SelectItem value="ADVANCED">İleri Seviye</SelectItem>
          </SelectContent>
        </Select>

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
          <AdminCoursesTable
            courses={items}
            onEdit={openEdit}
            onDelete={setDeleteCourse}
            onToggleActive={handleToggleActive}
            sort={{ sortBy, order, onSort }}
          />

          {/* Sayfalama */}
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

      <AdminCourseFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        course={editingCourse}
        categories={categories}
        onSaved={handleSaved}
      />

      <AdminDeleteConfirm
        open={deleteCourse !== null}
        onOpenChange={(o) => !o && setDeleteCourse(null)}
        title="Kursu KALICI olarak sil?"
        description={
          deleteCourse
            ? `"${deleteCourse.title}" kursu ve TÜM içerikleri (${deleteCourse.contentCount}) ile atamaları (${deleteCourse.assignmentCount}) — ilerleme, değerlendirme ve sertifikalar dahil — kalıcı olarak silinecek. Bu işlem GERİ ALINAMAZ. (Yalnızca gizlemek için "Aktif" anahtarını kapatın.)`
            : ""
        }
        confirmLabel="Kalıcı Sil"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}
