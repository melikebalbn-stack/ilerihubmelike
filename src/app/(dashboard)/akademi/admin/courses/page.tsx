"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AdminCoursesTable } from "@/components/akademi/admin/AdminCoursesTable";
import { AdminCourseFormModal } from "@/components/akademi/admin/AdminCourseFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import type { AdminCourseListItem } from "@/types/akademi-admin";

export default function AkademiAdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourseListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCourse, setEditingCourse] =
    useState<AdminCourseListItem | null>(null);

  const [deleteCourse, setDeleteCourse] =
    useState<AdminCourseListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCourses = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/akademi/admin/courses${
        includeInactive ? "?includeInactive=true" : ""
      }`
    )
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((data) => setCourses(data.courses ?? []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [includeInactive]);

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
    loadCourses();
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
      loadCourses();
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCourse) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/courses/${deleteCourse.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Silinemedi");
        return;
      }
      toast.success("Kurs pasif duruma alındı");
      setDeleteCourse(null);
      loadCourses();
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="ak-animate-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Switch
            id="includeInactive"
            checked={includeInactive}
            onCheckedChange={setIncludeInactive}
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

      {loading ? (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      ) : (
        <AdminCoursesTable
          courses={courses}
          onEdit={openEdit}
          onDelete={setDeleteCourse}
          onToggleActive={handleToggleActive}
        />
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
        title="Kursu pasifleştirmek istediğinize emin misiniz?"
        description={
          deleteCourse
            ? `"${deleteCourse.title}" pasif duruma alınacak. Kullanıcılara artık görünmeyecek ancak verileri silinmez. "Pasifleri göster" ile geri alabilirsiniz.`
            : ""
        }
        confirmLabel="Pasifleştir"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}
