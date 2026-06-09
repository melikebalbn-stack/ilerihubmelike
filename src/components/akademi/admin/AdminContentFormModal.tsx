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
import { AdminContentTypeSelect } from "./AdminContentTypeSelect";
import { AdminContentFileUpload } from "./AdminContentFileUpload";
import type {
  AdminContentItem,
  AdminContentType,
} from "@/types/akademi-admin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  courseId: string;
  content?: AdminContentItem | null;
  onSaved: () => void;
}

export function AdminContentFormModal({
  open,
  onOpenChange,
  mode,
  courseId,
  content,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AdminContentType>("VIDEO");
  const [duration, setDuration] = useState<string>("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  // IFS-3b: GOREV alanları (IfsTaskMeta)
  const [modul, setModul] = useState("");
  const [altModul, setAltModul] = useState("");
  const [ifsEkran, setIfsEkran] = useState("");
  const [refDocUrl, setRefDocUrl] = useState("");
  const [refVideoUrl, setRefVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && content) {
      setTitle(content.title);
      setDescription(content.description ?? "");
      setType(content.type);
      setDuration(content.duration?.toString() ?? "");
      setFilePath(content.filePath);
      setFileSize(content.fileSize);
      setModul(content.ifsMeta?.modul ?? "");
      setAltModul(content.ifsMeta?.altModul ?? "");
      setIfsEkran(content.ifsMeta?.ifsEkran ?? "");
      setRefDocUrl(content.ifsMeta?.refDocUrl ?? "");
      setRefVideoUrl(content.ifsMeta?.refVideoUrl ?? "");
    } else {
      setTitle("");
      setDescription("");
      setType("VIDEO");
      setDuration("");
      setFilePath(null);
      setFileSize(null);
      setModul("");
      setAltModul("");
      setIfsEkran("");
      setRefDocUrl("");
      setRefVideoUrl("");
    }
  }, [open, mode, content]);

  const handleSubmit = async () => {
    if (saving) return;

    const t = title.trim();
    if (t.length < 2) {
      toast.error("Başlık en az 2 karakter olmalı");
      return;
    }

    let durationNum: number | null = null;
    if (duration.trim()) {
      const parsed = parseInt(duration, 10);
      if (isNaN(parsed) || parsed <= 0) {
        toast.error("Süre pozitif sayı olmalı");
        return;
      }
      durationNum = parsed;
    }

    setSaving(true);
    try {
      const url =
        mode === "edit" && content
          ? `/api/akademi/admin/contents/${content.id}`
          : "/api/akademi/admin/contents";
      const method = mode === "edit" ? "PATCH" : "POST";

      const isGorev = type === "GOREV";
      const base: Record<string, unknown> = {
        title: t,
        description: description.trim() || null,
        type,
        // GOREV görevinin kendi dosyası/süresi yok.
        duration: isGorev ? null : durationNum,
        filePath: isGorev ? null : filePath || null,
        fileSize: isGorev ? null : fileSize || null,
        ...(isGorev
          ? {
              ifsMeta: {
                modul: modul.trim() || null,
                altModul: altModul.trim() || null,
                ifsEkran: ifsEkran.trim() || null,
                refDocUrl: refDocUrl.trim() || null,
                refVideoUrl: refVideoUrl.trim() || null,
              },
            }
          : {}),
      };
      const payload: Record<string, unknown> =
        mode === "edit" ? base : { courseId, ...base };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "İşlem başarısız");
        return;
      }

      toast.success(
        mode === "edit" ? "İçerik güncellendi" : "İçerik oluşturuldu"
      );
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "İçeriği Düzenle" : "Yeni İçerik"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "İçerik bilgilerini güncelleyin"
              : "Kursa yeni bir içerik ekleyin"}
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
              placeholder="Örn. Bilgi Güvenliği Temelleri"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="İçeriğin kısa açıklaması"
              rows={2}
              maxLength={500}
            />
          </div>

          <AdminContentTypeSelect value={type} onChange={setType} />

          {type !== "QUIZ" && type !== "GOREV" && (
            <div className="space-y-2">
              <Label>Dosya</Label>
              <AdminContentFileUpload
                contentType={type}
                currentFilePath={filePath}
                onUploaded={(data) => {
                  setFilePath(data.filePath || null);
                  setFileSize(data.fileSize || null);
                }}
              />
            </div>
          )}

          {type === "GOREV" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="modul">Modül</Label>
                  <Input
                    id="modul"
                    value={modul}
                    onChange={(e) => setModul(e.target.value)}
                    placeholder="Örn. DEPO YÖNETİMİ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="altModul">Alt Modül</Label>
                  <Input
                    id="altModul"
                    value={altModul}
                    onChange={(e) => setAltModul(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsEkran">IFS Ekranı</Label>
                  <Input
                    id="ifsEkran"
                    value={ifsEkran}
                    onChange={(e) => setIfsEkran(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refDoc">
                  Referans Eğitim Dokümanı (link veya yükle)
                </Label>
                <Input
                  id="refDoc"
                  value={refDocUrl}
                  onChange={(e) => setRefDocUrl(e.target.value)}
                  placeholder="https://... veya aşağıdan dosya yükleyin"
                />
                <AdminContentFileUpload
                  contentType="DOCUMENT"
                  currentFilePath={null}
                  onUploaded={(data) =>
                    data.filePath &&
                    setRefDocUrl(`/api/akademi/files/documents/${data.filePath}`)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refVideo">
                  Referans Eğitim Videosu (link veya yükle)
                </Label>
                <Input
                  id="refVideo"
                  value={refVideoUrl}
                  onChange={(e) => setRefVideoUrl(e.target.value)}
                  placeholder="https://... veya aşağıdan dosya yükleyin"
                />
                <AdminContentFileUpload
                  contentType="VIDEO"
                  currentFilePath={null}
                  onUploaded={(data) =>
                    data.filePath &&
                    setRefVideoUrl(`/api/akademi/files/videos/${data.filePath}`)
                  }
                />
              </div>
            </div>
          )}

          {type === "QUIZ" && (
            <div
              className="p-3 rounded-md text-sm"
              style={{
                background: "var(--ak-orange-glow)",
                color: "var(--ak-text-secondary)",
              }}
            >
              <strong style={{ color: "var(--ak-orange)" }}>ℹ️ Sınav:</strong>{" "}
              Sınav sorularının yönetimi Sprint 3&apos;te aktif olacak.
            </div>
          )}

          {type !== "GOREV" && (
            <div className="space-y-2">
              <Label htmlFor="duration">Süre (dakika, opsiyonel)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="10"
                min={1}
              />
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
