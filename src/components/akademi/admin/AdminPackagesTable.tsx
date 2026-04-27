"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, Package } from "lucide-react";
import type { AdminPackageListItem } from "@/types/akademi-package";

interface Props {
  packages: AdminPackageListItem[];
  onEdit: (pkg: AdminPackageListItem) => void;
  onDelete: (pkg: AdminPackageListItem) => void;
  onToggleActive: (pkg: AdminPackageListItem) => void;
}

export function AdminPackagesTable({
  packages,
  onEdit,
  onDelete,
  onToggleActive,
}: Props) {
  const router = useRouter();

  if (packages.length === 0) {
    return (
      <div
        className="ak-card-static p-8 text-center text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Henüz paket yok. &ldquo;Yeni Paket&rdquo; butonuyla ilk paketi oluşturun.
      </div>
    );
  }

  return (
    <div className="ak-card-static overflow-hidden" style={{ padding: 0 }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              className="text-xs uppercase tracking-wide"
              style={{
                background: "var(--ak-surface-2)",
                color: "var(--ak-text-tertiary)",
              }}
            >
              <th className="text-left px-4 py-3">Paket</th>
              <th className="text-center px-4 py-3">Kurs</th>
              <th className="text-center px-4 py-3">Bölüm</th>
              <th className="text-center px-4 py-3">Bireysel</th>
              <th className="text-center px-4 py-3">Durum</th>
              <th className="text-right px-4 py-3">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr
                key={p.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  router.push(`/akademi/admin/packages/${p.id}`);
                }}
                className="cursor-pointer transition-colors hover:bg-[var(--ak-surface-2)]"
                style={{ borderTop: "1px solid var(--ak-border)" }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: p.iconColor
                          ? `${p.iconColor}22`
                          : "var(--ak-accent-glow)",
                        color: p.iconColor || "var(--ak-accent)",
                      }}
                    >
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "var(--ak-text-primary)" }}
                      >
                        {p.name}
                      </div>
                      {p.description && (
                        <div
                          className="text-xs line-clamp-1 max-w-md"
                          style={{ color: "var(--ak-text-tertiary)" }}
                        >
                          {p.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td
                  className="text-center px-4 py-3 text-sm"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {p.courseCount}
                </td>
                <td
                  className="text-center px-4 py-3 text-sm"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {p.bolumCount}
                </td>
                <td
                  className="text-center px-4 py-3 text-sm"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {p.userAssignmentCount}
                </td>
                <td className="text-center px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleActive(p);
                    }}
                    className="text-xs px-2 py-1 rounded-md transition-colors"
                    style={{
                      background: p.isActive
                        ? "var(--ak-accent-glow)"
                        : "var(--ak-surface-2)",
                      color: p.isActive
                        ? "var(--ak-accent)"
                        : "var(--ak-text-tertiary)",
                    }}
                  >
                    {p.isActive ? "Aktif" : "Pasif"}
                  </button>
                </td>
                <td className="text-right px-4 py-3">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(p);
                      }}
                      className="p-1.5 rounded-md transition-colors hover:bg-[var(--ak-accent-glow)]"
                      style={{ color: "var(--ak-text-secondary)" }}
                      aria-label="Düzenle"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p);
                      }}
                      className="p-1.5 rounded-md transition-colors hover:bg-red-500/10"
                      style={{ color: "var(--ak-text-secondary)" }}
                      aria-label="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
