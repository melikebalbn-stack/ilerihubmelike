"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, BookOpen, ChevronUp, ChevronDown } from "lucide-react";
import type { AdminCourseListItem } from "@/types/akademi-admin";
import { getDifficultyLabel, formatDuration } from "@/lib/akademi-helpers";

export type CourseSortKey =
  | "title"
  | "category"
  | "difficulty"
  | "duration"
  | "content"
  | "assignment"
  | "status";

interface Props {
  courses: AdminCourseListItem[];
  onEdit: (course: AdminCourseListItem) => void;
  onDelete: (course: AdminCourseListItem) => void;
  onToggleActive: (course: AdminCourseListItem) => void;
  // PR-1: opsiyonel sıralama. Verilmezse başlıklar düz metin (ör. IFS eğitim
  // sekmesi bu prop'u geçmez → davranış değişmez).
  sort?: {
    sortBy: CourseSortKey;
    order: "asc" | "desc";
    onSort: (key: CourseSortKey) => void;
  };
}

export function AdminCoursesTable({
  courses,
  onEdit,
  onDelete,
  onToggleActive,
  sort,
}: Props) {
  const router = useRouter();

  function Th({
    label,
    sortKey,
    className = "",
    align = "left",
  }: {
    label: string;
    sortKey?: CourseSortKey;
    className?: string;
    align?: "left" | "right";
  }) {
    const base = `px-4 py-3 font-semibold ${
      align === "right" ? "text-right" : "text-left"
    } ${className}`;
    if (!sort || !sortKey) {
      return <th className={base}>{label}</th>;
    }
    const active = sort.sortBy === sortKey;
    return (
      <th className={base}>
        <button
          type="button"
          onClick={() => sort.onSort(sortKey)}
          className="inline-flex items-center gap-1 uppercase tracking-wide hover:opacity-80"
          style={active ? { color: "var(--ak-text-secondary)" } : undefined}
        >
          {label}
          {active &&
            (sort.order === "asc" ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            ))}
        </button>
      </th>
    );
  }

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
              <Th label="Kurs" sortKey="title" />
              <Th
                label="Kategori"
                sortKey="category"
                className="hidden md:table-cell"
              />
              <Th
                label="Zorluk"
                sortKey="difficulty"
                className="hidden lg:table-cell"
              />
              <Th
                label="Süre"
                sortKey="duration"
                className="hidden lg:table-cell"
              />
              <Th
                label="İçerik"
                sortKey="content"
                className="hidden md:table-cell"
              />
              <Th
                label="Atama"
                sortKey="assignment"
                className="hidden md:table-cell"
              />
              <Th label="Durum" sortKey="status" />
              <Th label="İşlem" align="right" />
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
