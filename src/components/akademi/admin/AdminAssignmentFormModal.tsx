"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AdminCourseSelect } from "./AdminCourseSelect";
import { AdminUserPicker } from "./AdminUserPicker";

interface CourseOption {
  id: string;
  title: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: CourseOption[];
  prefilledCourseId?: string | null;
  onSaved: () => void;
}

export function AdminAssignmentFormModal({
  open,
  onOpenChange,
  courses,
  prefilledCourseId,
  onSaved,
}: Props) {
  const [courseId, setCourseId] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCourseId(prefilledCourseId ?? "");
    setUserIds([]);
    setDueDate("");
  }, [open, prefilledCourseId]);

  const handleSubmit = async () => {
    if (saving) return;

    if (!courseId) {
      toast.error("Kurs seçmelisiniz");
      return;
    }
    if (userIds.length === 0) {
      toast.error("En az bir kullanıcı seçmelisiniz");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/akademi/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          userIds,
          dueDate: dueDate || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Atama yapılamadı");
        return;
      }

      const data = await res.json();
      toast.success(data.message || "Atama oluşturuldu");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Atama</DialogTitle>
          <DialogDescription>
            Bir veya birden fazla kullanıcıya kurs atayın. Son tarih opsiyoneldir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <AdminCourseSelect
            value={courseId}
            onChange={setCourseId}
            courses={courses}
          />

          <AdminUserPicker value={userIds} onChange={setUserIds} />

          <div className="space-y-2">
            <Label htmlFor="dueDate">Son Tarih (opsiyonel)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            <p className="text-xs text-gray-500">
              Boş bırakılırsa süresiz atanır
            </p>
          </div>

          {userIds.length > 0 && (
            <div
              className="p-3 rounded-md text-sm"
              style={{
                background: "var(--ak-accent-glow)",
                color: "var(--ak-text-secondary)",
              }}
            >
              <strong style={{ color: "var(--ak-accent)" }}>
                {userIds.length} kullanıcı
              </strong>{" "}
              seçildi. Zaten atanmış olanlar atlanır (çift atama yapılmaz).
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            İptal
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Atanıyor..." : "Ata"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
