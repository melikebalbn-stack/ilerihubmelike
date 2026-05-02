"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Eye, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type TemplateData = {
  id?: string;
  name: string;
  description: string | null;
  content: string;
  logoPath: string | null;
  primaryColor: string;
  accentColor: string;
  defaultValidityMonths: number | null;
  isDefault: boolean;
};

const DEFAULT_FORM: TemplateData = {
  name: "",
  description: "",
  content: "{}",
  logoPath: null,
  primaryColor: "#0d2659",
  accentColor: "#b38c26",
  defaultValidityMonths: null,
  isDefault: false,
};

export function TemplateForm({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<TemplateData>(DEFAULT_FORM);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/akademi/admin/certificate-templates/${templateId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.template) {
          const t = d.template;
          setForm({
            id: t.id,
            name: t.name,
            description: t.description ?? "",
            content: t.content ?? "{}",
            logoPath: t.logoPath,
            primaryColor: t.primaryColor,
            accentColor: t.accentColor,
            defaultValidityMonths: t.defaultValidityMonths,
            isDefault: t.isDefault,
          });
        }
      })
      .catch(() => {
        toast.error("Şablon yüklenemedi");
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        "/api/akademi/admin/certificate-templates/upload-logo",
        {
          method: "POST",
          body: fd,
        }
      );
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Yükleme hatası");
        return;
      }
      setForm((f) => ({ ...f, logoPath: d.logoPath }));
      toast.success("Logo yüklendi");
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit() {
    if (form.name.trim().length < 2) {
      toast.error("Şablon adı en az 2 karakter olmalı");
      return;
    }
    setSaving(true);
    try {
      const url = templateId
        ? `/api/akademi/admin/certificate-templates/${templateId}`
        : "/api/akademi/admin/certificate-templates";
      const method = templateId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Kayıt başarısız");
        return;
      }
      toast.success(templateId ? "Güncellendi" : "Şablon oluşturuldu");
      router.push("/akademi/admin/certificate-templates");
      router.refresh();
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="ak-animate-in max-w-3xl space-y-4">
      <Link
        href="/akademi/admin/certificate-templates"
        className="inline-flex items-center gap-1 text-sm hover:underline"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Şablon Listesine Dön
      </Link>

      <div
        className="border rounded-lg p-6 bg-white space-y-4"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {templateId ? "Şablonu Düzenle" : "Yeni Şablon"}
        </h1>

        <div className="space-y-2">
          <Label htmlFor="tname">
            Şablon Adı <span className="text-red-500">*</span>
          </Label>
          <Input
            id="tname"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Örn. Standart Sertifika"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tdesc">Açıklama</Label>
          <Textarea
            id="tdesc"
            value={form.description ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={2}
            placeholder="Bu şablon hangi durumlarda kullanılır?"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tprimary">Ana Renk</Label>
            <div className="flex gap-2">
              <input
                id="tprimary"
                type="color"
                value={form.primaryColor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, primaryColor: e.target.value }))
                }
                className="w-12 h-10 border rounded cursor-pointer"
              />
              <Input
                value={form.primaryColor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, primaryColor: e.target.value }))
                }
                className="flex-1 font-mono text-sm"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="taccent">Vurgu Rengi</Label>
            <div className="flex gap-2">
              <input
                id="taccent"
                type="color"
                value={form.accentColor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accentColor: e.target.value }))
                }
                className="w-12 h-10 border rounded cursor-pointer"
              />
              <Input
                value={form.accentColor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accentColor: e.target.value }))
                }
                className="flex-1 font-mono text-sm"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Logo (PNG/JPG, max 2MB)</Label>
          {form.logoPath ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoPath}
                alt="Logo"
                className="h-16 border rounded p-1 bg-white object-contain"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, logoPath: null }))}
                className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 inline-flex items-center gap-1"
              >
                <Trash2 size={11} />
                Kaldır
              </button>
            </div>
          ) : (
            <label
              className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-slate-50 text-sm"
              style={{ borderColor: "var(--ak-border-default)" }}
            >
              <Upload size={14} />
              {uploading ? "Yükleniyor..." : "Logo Yükle"}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tdvm">Varsayılan Geçerlilik (Ay)</Label>
          <Input
            id="tdvm"
            type="number"
            value={form.defaultValidityMonths ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                defaultValidityMonths: e.target.value
                  ? Number(e.target.value)
                  : null,
              }))
            }
            min={1}
            max={120}
            placeholder="Boş = sınırsız"
          />
          <p
            className="text-xs"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Yeni sertifikalar için varsayılan geçerlilik süresi. Boş bırakılırsa
            süresiz olur.
          </p>
        </div>

        <div
          className="flex items-center justify-between py-3 border-t"
          style={{ borderColor: "var(--ak-border-divider)" }}
        >
          <div>
            <Label htmlFor="tisdefault" className="font-semibold">
              Varsayılan Şablon
            </Label>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Yeni sertifikalarda otomatik kullanılır (sadece bir tane olabilir)
            </p>
          </div>
          <Switch
            id="tisdefault"
            checked={form.isDefault}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
          />
        </div>

        <div
          className="flex justify-between pt-4 border-t"
          style={{ borderColor: "var(--ak-border-divider)" }}
        >
          <div>
            {templateId && (
              <a
                href={`/api/akademi/admin/certificate-templates/${templateId}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 border rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 text-sm"
                style={{ borderColor: "var(--ak-border-default)" }}
              >
                <Eye size={13} />
                PDF Önizle
              </a>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="gap-2"
          >
            <Save size={16} />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}
