"use client";

// IFS-5a: Görev Değerlendirme matrisi — READ-ONLY görünüm.
// Bölüm + IFS kursu + kullanıcı seçici → seçili kullanıcının görevleri × değerlendirme
// alanları (Eğitim Verildi / Uygulamalı / Örnek Yaptı + Proje Ekibi / Danışman yorumu).
// Eğitmen düzenleme + inline kaydet IFS-5b'de. Departman özeti PR-3'te (burada değil).

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";

interface BoardMeta {
  scope: "full" | "own";
  bolums: string[];
}
interface CourseOpt {
  id: string;
  title: string;
  isIfs: boolean;
}
interface TaskRow {
  contentId: string;
  konu: string;
  modul: string | null;
  altModul: string | null;
  ifsEkran: string | null;
  order: number;
}
interface UserRow {
  userId: string;
  name: string;
  completionPct: number;
  completedCount: number;
  totalTasks: number;
}
interface EvalCell {
  egitimVerildi: boolean;
  uygulamaliYapildi: boolean;
  ornekYapildi: boolean;
  projeEkibiYorum: string | null;
  danismanYorum: string | null;
}
interface MatrixData {
  tasks: TaskRow[];
  users: UserRow[];
  evaluations: Record<string, EvalCell> | null;
  userId: string | null;
  canEdit: boolean;
}

function Flag({ on }: { on: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
      style={
        on
          ? { background: "var(--ak-green-glow)", color: "var(--ak-green)" }
          : {
              background: "var(--ak-surface-secondary)",
              color: "var(--ak-text-tertiary)",
            }
      }
      title={on ? "Evet" : "Hayır"}
    >
      {on ? "✓" : "—"}
    </span>
  );
}

export function IfsEvaluationsTab() {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [bolum, setBolum] = useState("");
  const [courseId, setCourseId] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);

  // Scope + bölümler (department-board meta reuse) + IFS kursları
  useEffect(() => {
    fetch("/api/akademi/admin/reports/department-board")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: BoardMeta | null) => {
        setMeta(m);
        if (m?.bolums?.length) setBolum(m.bolums[0]);
      })
      .catch(() => setMeta(null));
    fetch("/api/akademi/admin/courses?includeInactive=true")
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => {
        const ifs: CourseOpt[] = (d.courses ?? []).filter(
          (c: CourseOpt) => c.isIfs
        );
        setCourses(ifs);
        if (ifs.length) setCourseId(ifs[0].id);
      })
      .catch(() => setCourses([]));
  }, []);

  const load = useCallback(() => {
    if (!bolum || !courseId) return;
    setLoading(true);
    const qs = new URLSearchParams({ bolum, courseId });
    if (selectedUser) qs.set("userId", selectedUser);
    fetch(`/api/akademi/admin/reports/ifs-evaluations?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MatrixData | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [bolum, courseId, selectedUser]);

  useEffect(() => {
    load();
  }, [load]);

  // Bölüm/kurs değişince seçili kullanıcıyı sıfırla
  useEffect(() => {
    setSelectedUser("");
  }, [bolum, courseId]);

  // IFS-5b: düzenlenebilir hücreler (canEdit ise) — local + inline PATCH.
  const [cells, setCells] = useState<Record<string, EvalCell>>({});
  useEffect(() => {
    setCells(data?.evaluations ?? {});
  }, [data]);

  const setLocal = (contentId: string, patch: Partial<EvalCell>) =>
    setCells((prev) => {
      const base: EvalCell = prev[contentId] ?? {
        egitimVerildi: false,
        uygulamaliYapildi: false,
        ornekYapildi: false,
        projeEkibiYorum: null,
        danismanYorum: null,
      };
      return { ...prev, [contentId]: { ...base, ...patch } };
    });

  const patchCell = async (contentId: string, patch: Partial<EvalCell>) => {
    if (!selectedUser) return;
    try {
      const res = await fetch(
        "/api/akademi/admin/reports/ifs-evaluations",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUser, contentId, ...patch }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Kaydedilemedi");
        load();
      }
    } catch {
      toast.error("Kaydedilemedi");
      load();
    }
  };

  const toggleCell = (contentId: string, patch: Partial<EvalCell>) => {
    setLocal(contentId, patch);
    patchCell(contentId, patch);
  };

  const selectCls = "px-3 py-2 text-sm rounded-md border bg-white min-w-[200px]";
  const selectedUserRow = data?.users.find((u) => u.userId === selectedUser);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="text-xs font-medium block"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Bölüm
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={bolum}
            onChange={(e) => setBolum(e.target.value)}
            disabled={!meta || meta.bolums.length <= 1}
          >
            {(meta?.bolums ?? []).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium block"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            IFS Eğitim Alanı
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.length === 0 && <option value="">IFS kursu yok</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium block"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Çalışan
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">— Çalışan seçin —</option>
            {(data?.users ?? []).map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.name} (%{u.completionPct})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Yükleniyor...
        </div>
      ) : !selectedUser ? (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Değerlendirme matrisini görmek için bir çalışan seçin.
        </div>
      ) : !data || data.tasks.length === 0 ? (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Bu eğitim alanında görev yok.
        </div>
      ) : (
        <>
          {selectedUserRow && (
            <div className="ak-card-static p-4 flex items-center gap-4">
              <div className="flex-1">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {selectedUserRow.name}
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  {selectedUserRow.completedCount}/{selectedUserRow.totalTasks}{" "}
                  görev tamamlandı
                </div>
              </div>
              <div className="w-40">
                <ProgressBar
                  value={selectedUserRow.completionPct}
                  showLabel
                  color={
                    selectedUserRow.completionPct >= 100 ? "green" : "accent"
                  }
                />
              </div>
            </div>
          )}

          <div
            className="rounded-lg overflow-hidden border bg-white"
            style={{ borderColor: "var(--ak-border-default)" }}
          >
            <table className="w-full text-sm">
              <thead style={{ background: "var(--ak-surface-secondary)" }}>
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                    Görev (Konu)
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                    Modül / Ekran
                  </th>
                  <th className="text-center px-2 py-2 text-xs font-semibold uppercase">
                    Eğitim Verildi
                  </th>
                  <th className="text-center px-2 py-2 text-xs font-semibold uppercase">
                    Uygulamalı
                  </th>
                  <th className="text-center px-2 py-2 text-xs font-semibold uppercase">
                    Örnek Yaptı
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                    Proje Ekibi
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                    Danışman
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => {
                  const e = cells[t.contentId];
                  const canEdit = data.canEdit;
                  return (
                    <tr
                      key={t.contentId}
                      className="border-t align-top"
                      style={{ borderColor: "var(--ak-border-divider)" }}
                    >
                      <td className="px-3 py-2 font-medium">{t.konu}</td>
                      <td
                        className="px-3 py-2 text-xs"
                        style={{ color: "var(--ak-text-tertiary)" }}
                      >
                        {[t.modul, t.ifsEkran].filter(Boolean).join(" / ") ||
                          "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {canEdit ? (
                          <Switch
                            checked={Boolean(e?.egitimVerildi)}
                            onCheckedChange={(v) =>
                              toggleCell(t.contentId, { egitimVerildi: v })
                            }
                          />
                        ) : (
                          <Flag on={Boolean(e?.egitimVerildi)} />
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {canEdit ? (
                          <Switch
                            checked={Boolean(e?.uygulamaliYapildi)}
                            onCheckedChange={(v) =>
                              toggleCell(t.contentId, { uygulamaliYapildi: v })
                            }
                          />
                        ) : (
                          <Flag on={Boolean(e?.uygulamaliYapildi)} />
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Flag on={Boolean(e?.ornekYapildi)} />
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <Textarea
                            rows={1}
                            className="text-xs min-h-[34px]"
                            value={e?.projeEkibiYorum ?? ""}
                            onChange={(ev) =>
                              setLocal(t.contentId, {
                                projeEkibiYorum: ev.target.value,
                              })
                            }
                            onBlur={(ev) =>
                              patchCell(t.contentId, {
                                projeEkibiYorum: ev.target.value.trim() || null,
                              })
                            }
                          />
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--ak-text-secondary)" }}
                          >
                            {e?.projeEkibiYorum || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <Textarea
                            rows={1}
                            className="text-xs min-h-[34px]"
                            value={e?.danismanYorum ?? ""}
                            onChange={(ev) =>
                              setLocal(t.contentId, {
                                danismanYorum: ev.target.value,
                              })
                            }
                            onBlur={(ev) =>
                              patchCell(t.contentId, {
                                danismanYorum: ev.target.value.trim() || null,
                              })
                            }
                          />
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--ak-text-secondary)" }}
                          >
                            {e?.danismanYorum || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
