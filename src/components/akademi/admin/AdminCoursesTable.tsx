"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, BookOpen } from "lucide-react";
import type { AdminCourseListItem } from "@/types/akademi-admin";
import { getDifficultyLabel, formatDuration } from "@/lib/akademi-helpers";

interface Props {
  courses: AdminCourseListItem[];
  onEdit: (course: AdminCourseListItem) => void;
  onDelete: (course: AdminCourseListItem) => void;
  onToggleActive: (course: AdminCourseListItem) => void;
}

export function AdminCoursesTable({
  courses,
  onEdit,
  onDelete,
  onToggleActive,
}: Props) {
  const router = useRouter();

  if (courses.length === 0) {
    return (
      <div
        className="ak-card-static p-8 text-center text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Henüz kurs yok. &ldquo;Yeni Kurs&rdquo; butonuyla ilk kursu oluşturun.
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
                color: "var(--ak-text-tertiary)",
                borderBottom: "1px solid var(--ak-border-divider)",
              }}
            >
              <th className="text-left px-4 py-3 font-semibold">Kurs</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">
                Kategori
              </th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                Zorluk
              </th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                Süre
              </th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">
                İçerik
              </th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">
                Atama
              </th>
              <th className="text-left px-4 py-3 font-semibold">Durum</th>
              <th className="text-right px-4 py-3 font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr
                key={c.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button")) return;
                  router.push(`/akademi/admin/courses/${c.id}`);
                }}
                className="transition-colors hover:bg-gray-50 cursor-pointer"
                style={{
                  borderBottom: "1px solid var(--ak-border-divider)",
                  opacity: c.isActive ? 1 : 0.6,
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "var(--ak-accent-glow)" }}
                    >
                      <BookOpen
                        className="w-4 h-4"
                        style={{ color: "var(--ak-accent)" }}
                      />
                    </div>
                    <div
                      className="text-sm font-semibold truncate max-w-xs"
                      style={{ color: "var(--ak-text-primary)" }}
                    >
                      {c.title}
                    </div>
                  </div>
                </td>
                <td
                  className="px-4 py-3 text-sm hidden md:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {c.category ?? "—"}
                </td>
                <td
                  className="px-4 py-3 text-sm hidden lg:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {getDifficultyLabel(c.difficulty)}
                </td>
                <td
                  className="px-4 py-3 text-sm hidden lg:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {formatDuration(c.duration)}
                </td>
                <td
                  className="px-4 py-3 text-sm hidden md:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {c.contentCount}
                </td>
                <td
                  className="px-4 py-3 text-sm hidden md:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {c.assignmentCount}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleActive(c);
                    }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
                    style={{
                      background: c.isActive
                        ? "var(--ak-green-glow)"
                        : "var(--ak-text-muted)",
                      color: c.isActive
                        ? "var(--ak-green)"
                        : "var(--ak-text-tertiary)",
                    }}
                  >
                    {c.isActive ? "Aktif" : "Pasif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(c);
                      }}
                      className="p-2 rounded-md transition-colors hover:bg-gray-100"
                      title="Düzenle"
                    >
                      <Pencil
                        className="w-4 h-4"
                        style={{ color: "var(--ak-text-secondary)" }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c);
                      }}
                      className="p-2 rounded-md transition-colors hover:bg-red-50"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
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
