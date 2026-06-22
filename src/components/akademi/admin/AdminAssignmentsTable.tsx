"use client";

import { Trash2, BookOpen, CheckCircle2, Calendar } from "lucide-react";
import { AdminUserProgressBar } from "./AdminUserProgressBar";
import type { AdminAssignmentListItem } from "@/types/akademi-admin";

interface Props {
  assignments: AdminAssignmentListItem[];
  onDelete: (assignment: AdminAssignmentListItem) => void;
}

export function AdminAssignmentsTable({ assignments, onDelete }: Props) {
  if (assignments.length === 0) {
    return (
      <div
        className="ak-card-static p-8 text-center text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Henüz atama yok. &ldquo;Yeni Atama&rdquo; butonuyla ilk atamayı yapın.
      </div>
    );
  }

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("tr-TR") : "—";

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
              <th className="text-left px-4 py-3 font-semibold">Kullanıcı</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">
                Departman
              </th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                Atandı
              </th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                Son Tarih
              </th>
              <th className="text-left px-4 py-3 font-semibold">İlerleme</th>
              <th className="text-right px-4 py-3 font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr
                key={a.userAssignmentId}
                className="transition-colors hover:bg-gray-50"
                style={{
                  borderBottom: "1px solid var(--ak-border-divider)",
                  opacity: a.courseIsActive ? 1 : 0.6,
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen
                      className="w-4 h-4 shrink-0"
                      style={{ color: "var(--ak-accent)" }}
                    />
                    <span
                      className="text-sm font-semibold truncate max-w-[200px]"
                      style={{ color: "var(--ak-text-primary)" }}
                    >
                      {a.courseTitle}
                    </span>
                    {!a.courseIsActive && (
                      <span className="text-xs text-gray-400">(pasif)</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--ak-text-primary)" }}
                    >
                      {a.userName}
                    </span>
                    <span className="text-xs text-gray-500">{a.userEmail}</span>
                  </div>
                </td>
                <td
                  className="px-4 py-3 text-sm hidden md:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {a.userDepartment ?? "—"}
                </td>
                <td
                  className="px-4 py-3 text-sm hidden lg:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {formatDate(a.assignedAt)}
                </td>
                <td
                  className="px-4 py-3 text-sm hidden lg:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {a.dueDate ? (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(a.dueDate)}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {a.isCompleted && (
                      <CheckCircle2
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--ak-green)" }}
                      />
                    )}
                    <AdminUserProgressBar
                      value={a.progressPercent}
                      label={`%${Math.round(a.progressPercent)}`}
                      size="sm"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(a)}
                    className="p-2 rounded-md transition-colors hover:bg-red-50"
                    title="Atamayı kaldır"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
