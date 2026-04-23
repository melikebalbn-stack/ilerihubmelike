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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminCategoryCombobox } from "./AdminCategoryCombobox";
import type {
  AdminCourseListItem,
  CourseDifficulty,
} from "@/types/akademi-admin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  course?: AdminCourseListItem | null;
  categories: string[];
  onSaved: () => void;
}

const DIFFICULTY_LABELS: Record<CourseDifficulty, string> = {
  BEGINNER: "Başlangıç",
  INTERMEDIATE: "Orta Seviye",
  ADVANCED: "İleri Seviye",
};

export function AdminCourseFormModal({
  open,
  onOpenChange,
  mode,
  course,
  categories,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<CourseDifficulty>("BEGINNER");
  const [duration, setDuration] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && course) {
      setTitle(course.title);
      setDescription(course.description);
      setThumbnail(course.thumbnail ?? "");
      setCategory(course.category ?? "");
      setDifficulty(course.difficulty);
      setDuration(course.duration?.toString() ?? "");
      setIsActive(course.isActive);
    } else {
      setTitle("");
      setDescription("");
      setThumbnail("");
      setCategory("");
      setDifficulty("BEGINNER");
      setDuration("");
      setIsActive(true);
    }
  }, [open, mode, course]);

  const handleSubmit = async () => {
    if (saving) return;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      toast.error("Başlık en az 2 karakter olmalı");
      return;
    }
    if (trimmedTitle.length > 200) {
      toast.error("Başlık en fazla 200 karakter olmalı");
      return;
    }

    let durationNum: number | null = null;
    if (duration.trim()) {
      const parsed = parseInt(duration, 10);
      if (isNaN(parsed) || parsed <= 0) {
        toast.error("Süre pozitif bir sayı olmalı");
        return;
      }
      durationNum = parsed;
    }

    setSaving(true);
    try {
      const payload = {
        title: trimmedTitle,
        description: description.trim(),
        thumbnail: thumbnail.trim() || null,
        category: category.trim() || null,
        difficulty,
        duration: durationNum,
        isActive,
      };

      const url =
        mode === "edit" && course
          ? `/api/akademi/admin/courses/${course.id}`
          : "/api/akademi/admin/courses";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "İşlem başarısız oldu");
        return;
      }

      toast.success(
        mode === "edit" ? "Kurs güncellendi" : "Kurs oluşturuldu"
      );
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
          <DialogTitle>
            {mode === "edit" ? "Kursu Düzenle" : "Yeni Kurs"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Kurs bilgilerini güncelleyin"
              : "Yeni bir kurs oluşturun. İçerik yükleme Sprint 2b'de aktif olacak."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Başlık <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. İş Sağlığı ve Güvenliği"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kursun kısa açıklaması"
              rows={3}
              maxLength={1000}
            />
          </div>

          <AdminCategoryCombobox
            value={category}
            onChange={setCategory}
            categories={categories}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zorluk</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as CourseDifficulty)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Süre (dakika)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                min={1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="thumbnail">Kapak Görseli (URL)</Label>
            <Input
              id="thumbnail"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://... (opsiyonel)"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t">
            <div>
              <Label htmlFor="isActive" className="font-semibold">
                Aktif
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Pasif kurslar kullanıcılara görünmez
              </p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
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
            {saving
              ? "Kaydediliyor..."
              : mode === "edit"
              ? "Güncelle"
              : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
