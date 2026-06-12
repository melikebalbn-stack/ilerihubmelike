"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type {
  AdminPackageListItem,
  PackageFormState,
} from "@/types/akademi-package";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  existing?: AdminPackageListItem | null;
  onSaved: () => void;
}

const COLOR_OPTIONS = [
  { value: "", label: "Varsayılan" },
  { value: "#3b82f6", label: "Mavi" },
  { value: "#10b981", label: "Yeşil" },
  { value: "#f59e0b", label: "Turuncu" },
  { value: "#8b5cf6", label: "Mor" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#ef4444", label: "Kırmızı" },
];

export function AdminPackageFormModal({
  open,
  onOpenChange,
  mode,
  existing,
  onSaved,
}: Props) {
  const [form, setForm] = useState<PackageFormState>({
    name: "",
    description: "",
    iconColor: "",
    coverImageUrl: null,
    isActive: true,
    referenceDocs: [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && existing) {
        setForm({
          name: existing.name,
          description: existing.description ?? "",
          iconColor: existing.iconColor ?? "",
          coverImageUrl: existing.coverImageUrl ?? null,
          isActive: existing.isActive,
          referenceDocs: (existing.referenceDocs ?? [])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((d, i) => ({
              title: d.title,
              fileUrl: d.fileUrl,
              sortOrder: i,
            })),
        });
      } else {
        setForm({
          name: "",
          description: "",
          iconColor: "",
          coverImageUrl: null,
          isActive: true,
          referenceDocs: [],
        });
      }
    }
  }, [open, mode, existing]);

  const handleRefDocUpload = async (file: File) => {
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/akademi/admin/packages/upload-ref-doc", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "PDF yüklenemedi");
      const defaultTitle = file.name.replace(/\.pdf$/i, "");
      setForm((f) => ({
        ...f,
        referenceDocs: [
          ...f.referenceDocs,
          {
            title: defaultTitle || "Referans Doküman",
            fileUrl: json.fileUrl,
            sortOrder: f.referenceDocs.length,
          },
        ],
      }));
      toast.success("PDF yüklendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF yüklenemedi");
    } finally {
      setUploadingDoc(false);
    }
  };

  const updateDocTitle = (index: number, title: string) => {
    setForm((f) => ({
      ...f,
      referenceDocs: f.referenceDocs.map((d, i) =>
        i === index ? { ...d, title } : d
      ),
    }));
  };

  const removeDoc = (index: number) => {
    setForm((f) => ({
      ...f,
      referenceDocs: f.referenceDocs
        .filter((_, i) => i !== index)
        .map((d, i) => ({ ...d, sortOrder: i })),
    }));
  };

  const moveDoc = (index: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = f.referenceDocs.slice();
      const target = index + dir;
      if (target < 0 || target >= next.length) return f;
      [next[index], next[target]] = [next[target], next[index]];
      return {
        ...f,
        referenceDocs: next.map((d, i) => ({ ...d, sortOrder: i })),
      };
    });
  };

  const handleCoverUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/akademi/admin/packages/upload-cover", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Görsel yüklenemedi");
      setForm((f) => ({ ...f, coverImageUrl: json.coverImageUrl }));
      toast.success("Kapak görseli yüklendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Paket adı zorunlu");
      return;
    }

    setSaving(true);
    try {
      const url =
        mode === "edit" && existing
          ? `/api/akademi/admin/packages/${existing.id}`
          : "/api/akademi/admin/packages";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          iconColor: form.iconColor || null,
          coverImageUrl: form.coverImageUrl,
          isActive: form.isActive,
          referenceDocs: form.referenceDocs
            .map((d, i) => ({
              title: d.title.trim(),
              fileUrl: d.fileUrl,
              sortOrder: i,
            }))
            .filter((d) => d.title.length > 0),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Kaydedilemedi");
      }

      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Paketi Düzenle" : "Yeni Paket"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="pkg-name">Paket Adı *</Label>
            <Input
              id="pkg-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Örn. Yeni Çalışan Oryantasyonu"
              maxLength={200}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="pkg-desc">Açıklama</Label>
            <Textarea
              id="pkg-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Bu paketin ne için kullanıldığını yazın..."
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="pkg-color">İkon Rengi</Label>
            <div className="flex gap-2 mt-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value || "default"}
                  type="button"
                  onClick={() => setForm({ ...form, iconColor: c.value })}
                  className="w-8 h-8 rounded-md border-2 transition-all"
                  style={{
                    background: c.value || "var(--ak-surface-2)",
                    borderColor:
                      form.iconColor === c.value
                        ? "var(--ak-accent)"
                        : "transparent",
                  }}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Kapak Görseli</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              IFS kartında gösterilir. Boşsa gradient + ikon kullanılır. PNG/JPG/WEBP, max 4MB.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <div
                className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md border bg-muted"
                style={{ background: form.coverImageUrl ? undefined : "var(--ak-surface-2)" }}
              >
                {form.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.coverImageUrl}
                    alt="Kapak önizleme"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">
                    Görsel yok
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  id="pkg-cover"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => document.getElementById("pkg-cover")?.click()}
                >
                  {uploading ? "Yükleniyor..." : form.coverImageUrl ? "Değiştir" : "Görsel Yükle"}
                </Button>
                {form.coverImageUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={uploading}
                    onClick={() => setForm((f) => ({ ...f, coverImageUrl: null }))}
                  >
                    Kaldır
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>Referans Dokümanlar (PDF)</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              IFS paket detayında, alan kartlarının üstünde gösterilir. Sıra
              yukarıdan aşağıya. Yalnız PDF, max 20MB.
            </p>

            {form.referenceDocs.length > 0 && (
              <div className="mt-2 space-y-2">
                {form.referenceDocs.map((doc, i) => (
                  <div
                    key={doc.fileUrl}
                    className="flex items-center gap-2 rounded-md border p-2"
                    style={{ background: "var(--ak-surface-2)" }}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                        disabled={i === 0}
                        onClick={() => moveDoc(i, -1)}
                        aria-label="Yukarı taşı"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                        disabled={i === form.referenceDocs.length - 1}
                        onClick={() => moveDoc(i, 1)}
                        aria-label="Aşağı taşı"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={doc.title}
                      onChange={(e) => updateDocTitle(i, e.target.value)}
                      placeholder="Doküman başlığı"
                      className="h-8 flex-1"
                    />
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Önizle
                    </a>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeDoc(i)}
                      aria-label="Kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <input
              id="pkg-ref-doc"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRefDocUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={uploadingDoc}
              onClick={() => document.getElementById("pkg-ref-doc")?.click()}
            >
              {uploadingDoc ? "Yükleniyor..." : "PDF Ekle"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="pkg-active"
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            />
            <Label htmlFor="pkg-active" className="cursor-pointer">
              Aktif
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Kaydediliyor..." : mode === "edit" ? "Güncelle" : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
