"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, TrendingUp, Calendar, CheckCircle2 } from "lucide-react";
import { AdminUserProgressBar } from "./AdminUserProgressBar";
import { getInitials } from "@/lib/akademi-helpers";
import type { AdminUserProgressResponse } from "@/types/akademi-admin";

interface Props {
  userId: string | null;
  onClose: () => void;
}

export function AdminUserDetailModal({ userId, onClose }: Props) {
  const [data, setData] = useState<AdminUserProgressResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/akademi/admin/users/${userId}/progress`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId]);

  const open = userId !== null;
  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("tr-TR") : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kullanıcı İlerlemesi</DialogTitle>
          <DialogDescription>
            Bu kullanıcının akademi ilerleme detayı
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="text-sm text-gray-500 text-center py-8">
            Yükleniyor...
          </div>
        )}

        {!loading && !data && (
          <div className="text-sm text-gray-500 text-center py-8">
            Veri alınamadı.
          </div>
        )}

        {!loading && data && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  background: "var(--ak-accent-glow)",
                  color: "var(--ak-accent)",
                }}
              >
                {getInitials(data.user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-base font-bold truncate"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {data.user.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {data.user.email}
                  {data.user.department && ` · ${data.user.department}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className="text-xs"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  Seviye {data.level}
                </div>
                <div
                  className="text-xl font-bold"
                  style={{ color: "var(--ak-accent)" }}
                >
                  {data.totalXp} XP
                </div>
              </div>
            </div>

            <div>
              <div
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                📚 Kurslar ({data.courses.length})
              </div>
              {data.courses.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Atanmış kurs yok
                </div>
              ) : (
                <div className="space-y-2">
                  {data.courses.map((c) => (
                    <div
                      key={c.assignmentId}
                      className="flex items-center gap-3 p-3 rounded-md border"
                      style={{
                        borderColor: "var(--ak-border-divider)",
                        opacity: c.courseIsActive ? 1 : 0.5,
                      }}
                    >
                      <BookOpen
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--ak-accent)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--ak-text-primary)" }}
                        >
                          {c.courseTitle}
                          {!c.courseIsActive && (
                            <span className="ml-2 text-xs text-gray-400">
                              (pasif)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>Atandı: {formatDate(c.assignedAt)}</span>
                          {c.dueDate && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(c.dueDate)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="w-32 shrink-0 flex items-center gap-2">
                        {c.isCompleted && (
                          <CheckCircle2
                            className="w-4 h-4 shrink-0"
                            style={{ color: "var(--ak-green)" }}
                          />
                        )}
                        <AdminUserProgressBar
                          value={c.progressPercent}
                          label={`%${Math.round(c.progressPercent)}`}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                ⚡ Son Kazanımlar ({data.recentHistory.length})
              </div>
              {data.recentHistory.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Henüz XP kazanımı yok
                </div>
              ) : (
                <div className="space-y-1">
                  {data.recentHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50"
                    >
                      <TrendingUp
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--ak-green)" }}
                      />
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "var(--ak-green)" }}
                      >
                        +{h.amount}
                      </div>
                      <div
                        className="text-sm flex-1 truncate"
                        style={{ color: "var(--ak-text-secondary)" }}
                      >
                        {h.reason}
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">
                        {formatDate(h.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
