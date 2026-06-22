"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, Eye, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";

type Template = {
  id: string;
  name: string;
  description: string | null;
  primaryColor: string;
  accentColor: string;
  logoPath: string | null;
  defaultValidityMonths: number | null;
  isDefault: boolean;
  createdAt: string;
  _count: { certificates: number };
};

export default function CertificateTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/akademi/admin/certificate-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {
        toast.error("Yüklenemedi");
        setTemplates([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/certificate-templates/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Silinemedi");
        return;
      }
      toast.success("Şablon silindi");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="ak-animate-in space-y-5">
      <div className="flex items-center justify-end">
        <Link href="/akademi/admin/certificate-templates/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Yeni Şablon
          </Button>
        </Link>
      </div>

      {loading && (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Henüz şablon yok. &quot;Yeni Şablon&quot; ile başlayın.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="border rounded-lg p-4 bg-white"
            style={{ borderColor: "var(--ak-border-default)" }}
          >
            {t.logoPath && (
              <div className="h-16 mb-3 flex items-center justify-center bg-slate-50 rounded border border-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.logoPath}
                  alt={t.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3
                className="font-semibold flex items-center gap-1.5"
                style={{ color: "var(--ak-text-primary)" }}
              >
                {t.name}
                {t.isDefault && (
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                )}
              </h3>
            </div>
            {t.description && (
              <p
                className="text-xs mb-2"
                style={{ color: "var(--ak-text-secondary)" }}
              >
                {t.description}
              </p>
            )}
            <div className="flex gap-1 mb-2">
              <div
                className="w-6 h-6 rounded border border-slate-200"
                style={{ backgroundColor: t.primaryColor }}
                title={`Ana: ${t.primaryColor}`}
              />
              <div
                className="w-6 h-6 rounded border border-slate-200"
                style={{ backgroundColor: t.accentColor }}
                title={`Vurgu: ${t.accentColor}`}
              />
            </div>
            <div
              className="text-xs mb-3"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              {t._count.certificates} sertifika kullanıyor
              {t.defaultValidityMonths && (
                <span> · {t.defaultValidityMonths} ay geçerli</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/akademi/admin/certificate-templates/${t.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 border rounded hover:bg-slate-50 inline-flex items-center gap-1"
                style={{ borderColor: "var(--ak-border-default)" }}
              >
                <Eye size={11} />
                Önizle
              </a>
              <Link
                href={`/akademi/admin/certificate-templates/${t.id}`}
                className="text-xs px-2 py-1 border rounded hover:bg-slate-50 inline-flex items-center gap-1"
                style={{ borderColor: "var(--ak-border-default)" }}
              >
                <Edit2 size={11} />
                Düzenle
              </Link>
              {!t.isDefault && t._count.certificates === 0 && (
                <button
                  onClick={() => setDeleteTarget(t)}
                  className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 inline-flex items-center gap-1"
                >
                  <Trash2 size={11} />
                  Sil
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AdminDeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Şablonu silmek istediğinize emin misiniz?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" kalıcı olarak silinecek. Bu şablonla üretilmiş PDF'ler etkilenmez.`
            : ""
        }
        confirmLabel="Sil"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
