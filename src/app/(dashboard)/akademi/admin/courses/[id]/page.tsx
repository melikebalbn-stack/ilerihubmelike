"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminCourseDetailHeader } from "@/components/akademi/admin/AdminCourseDetailHeader";
import { AdminContentsTable } from "@/components/akademi/admin/AdminContentsTable";
import { AdminContentFormModal } from "@/components/akademi/admin/AdminContentFormModal";
import { AdminCourseFormModal } from "@/components/akademi/admin/AdminCourseFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import type {
  AdminCourseListItem,
  AdminContentItem,
} from "@/types/akademi-admin";

export default function AkademiAdminCourseDetailPage() {
  const params = useParams();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<AdminCourseListItem | null>(null);
  const [contents, setContents] = useState<AdminContentItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentMode, setContentMode] = useState<"create" | "edit">("create");
  const [editingContent, setEditingContent] = useState<AdminContentItem | null>(
    null
  );
  const [deleteContent, setDeleteContent] = useState<AdminContentItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const [courseModalOpen, setCourseModalOpen] = useState(false);

  const loadCourse = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await fetch(
        "/api/akademi/admin/courses?includeInactive=true"
      );
      const data = await res.json();
      const found = (data.courses || []).find(
        (c: AdminCourseListItem) => c.id === courseId
      );
      setCourse(found || null);
    } catch {
      setCourse(null);
    }
  }, [courseId]);

  const loadContents = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await fetch(
        `/api/akademi/admin/contents?courseId=${encodeURIComponent(courseId)}`
      );
      const data = await res.json();
      setContents(data.contents || []);
    } catch {
      setContents([]);
    }
  }, [courseId]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/akademi/admin/courses/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    Promise.all([loadCourse(), loadContents(), loadCategories()]).finally(() =>
      setLoading(false)
    );
  }, [courseId, loadCourse, loadContents, loadCategories]);

  const handleReorder = async (orderedIds: string[]) => {
    const res = await fetch("/api/akademi/admin/contents/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentIds: orderedIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Reorder failed");
    }
    loadContents();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteContent) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/contents/${deleteContent.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Silinemedi");
        return;
      }
      toast.success("İçerik pasif duruma alındı");
      setDeleteContent(null);
      loadContents();
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  const openCreateContent = () => {
    setContentMode("create");
    setEditingContent(null);
    setContentModalOpen(true);
  };

  const openEditContent = (c: AdminContentItem) => {
    setContentMode("edit");
    setEditingContent(c);
    setContentModalOpen(true);
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        Yükleniyor...
      </div>
    );
  }

  if (!course) {
    return (
      <div className="ak-card-static p-8 text-center text-sm">
        Kurs bulunamadı.
      </div>
    );
  }

  const activeContentsCount = contents.filter((c) => c.isActive).length;

  return (
    <div className="ak-animate-in">
      <AdminCourseDetailHeader
        course={course}
        onEdit={() => setCourseModalOpen(true)}
      />

      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-base font-bold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          İçerikler ({activeContentsCount})
        </h2>
        <Button onClick={openCreateContent} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni İçerik
        </Button>
      </div>

      <AdminContentsTable
        contents={contents}
        onEdit={openEditContent}
        onDelete={setDeleteContent}
        onReorder={handleReorder}
      />

      <AdminContentFormModal
        open={contentModalOpen}
        onOpenChange={setContentModalOpen}
        mode={contentMode}
        courseId={courseId}
        content={editingContent}
        onSaved={() => {
          loadContents();
          loadCourse();
        }}
      />

      <AdminCourseFormModal
        open={courseModalOpen}
        onOpenChange={setCourseModalOpen}
        mode="edit"
        course={course}
        categories={categories}
        onSaved={() => {
          loadCourse();
          loadContents();
        }}
      />

      <AdminDeleteConfirm
        open={deleteContent !== null}
        onOpenChange={(o) => !o && setDeleteContent(null)}
        title="İçeriği pasifleştirmek istediğinize emin misiniz?"
        description={
          deleteContent
            ? `"${deleteContent.title}" içeriği pasif duruma alınacak. Dosya silinmez, geri alınabilir.`
            : ""
        }
        confirmLabel="Pasifleştir"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}
