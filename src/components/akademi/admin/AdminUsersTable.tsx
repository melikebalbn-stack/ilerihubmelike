"use client";

import { AdminUserProgressBar } from "./AdminUserProgressBar";
import { getInitials } from "@/lib/akademi-helpers";
import type { AdminUserListItem } from "@/types/akademi-admin";

interface Props {
  users: AdminUserListItem[];
  onSelect: (user: AdminUserListItem) => void;
}

export function AdminUsersTable({ users, onSelect }: Props) {
  if (users.length === 0) {
    return (
      <div
        className="ak-card-static p-8 text-center text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Kullanıcı bulunamadı.
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
              <th className="text-left px-4 py-3 font-semibold">Kullanıcı</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">
                Departman
              </th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                Seviye
              </th>
              <th className="text-left px-4 py-3 font-semibold">Atamalar</th>
              <th className="text-left px-4 py-3 font-semibold">Tamamlama</th>
              <th className="text-left px-4 py-3 font-semibold">XP</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={() => onSelect(u)}
                className="transition-colors hover:bg-gray-50 cursor-pointer"
                style={{
                  borderBottom: "1px solid var(--ak-border-divider)",
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: "var(--ak-accent-glow)",
                        color: "var(--ak-accent)",
                      }}
                    >
                      {getInitials(u.name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--ak-text-primary)" }}
                      >
                        {u.name}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {u.email}
                      </span>
                    </div>
                  </div>
                </td>
                <td
                  className="px-4 py-3 text-sm hidden md:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {u.department ?? "—"}
                </td>
                <td
                  className="px-4 py-3 text-sm hidden lg:table-cell"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Seviye {u.level}
                </td>
                <td
                  className="px-4 py-3 text-sm"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {u.assignmentCount > 0 ? (
                    <>
                      {u.completedCount} / {u.assignmentCount}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.assignmentCount > 0 ? (
                    <AdminUserProgressBar
                      value={u.completionRate}
                      label={`%${u.completionRate}`}
                      size="sm"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">Atama yok</span>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-sm font-semibold"
                  style={{ color: "var(--ak-accent)" }}
                >
                  {u.totalXp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
