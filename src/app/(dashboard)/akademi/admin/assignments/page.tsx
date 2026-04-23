"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminAssignmentsTable } from "@/components/akademi/admin/AdminAssignmentsTable";
import { AdminAssignmentFormModal } from "@/components/akademi/admin/AdminAssignmentFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import type {
  AdminAssignmentListItem,
  AdminCourseListItem,
} from "@/types/akademi-admin";

export default function AkademiAdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AdminAssignmentListItem[]>([]);
  const [courses, setCourses] = useState<AdminCourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourseId, setFilterCourseId] = useState<string>("__ALL__");

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<AdminAssignmentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAssignments = useCallback(() => {
    setLoading(true);
    const url =
      filterCourseId === "__ALL__"
        ? "/api/akademi/admin/assignments"
        : `/api/akademi/admin/assignments?courseId=${encodeURIComponent(
            filterCourseId
          )}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { assignments: [] }))
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [filterCourseId]);

  const loadCourses = useCallback(() => {
    fetch("/api/akademi/admin/courses")
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((data) => setCourses(data.courses ?? []))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleSaved = () => {
    loadAssignments();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/assignments/${deleteTarget.userAssignmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Atama kaldırılamadı");
        return;
      }
      toast.success("Atama kaldırıldı");
      setDeleteTarget(null);
      loadAssignments();
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  const activeCourses = courses.filter((c) => c.isActive);

  return (
    <div className="ak-animate-in">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Kurs filtrele:</Label>
          <Select value={filterCourseId} onValueChange={setFilterCourseId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Tüm kurslar</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                  {!c.isActive && " (pasif)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Atama
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
        <AdminAssignmentsTable
          assignments={assignments}
          onDelete={setDeleteTarget}
        />
      )}

      <AdminAssignmentFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        courses={activeCourses.map((c) => ({ id: c.id, title: c.title }))}
        prefilledCourseId={
          filterCourseId !== "__ALL__" ? filterCourseId : null
        }
        onSaved={handleSaved}
      />

      <AdminDeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Atamayı kaldırmak istediğinize emin misiniz?"
        description={
          deleteTarget
            ? `"${deleteTarget.userName}" kullanıcısının "${deleteTarget.courseTitle}" atamasını kaldırıyorsunuz. Mevcut ilerleme kaydı korunur.`
            : ""
        }
        confirmLabel="Kaldır"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}
