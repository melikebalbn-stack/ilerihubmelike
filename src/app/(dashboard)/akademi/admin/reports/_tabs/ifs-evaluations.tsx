"use client";

// IFS-5a: Görev Değerlendirme matrisi — READ-ONLY görünüm.
// Bölüm + IFS kursu + kullanıcı seçici → seçili kullanıcının görevleri × değerlendirme
// alanları (Eğitim Verildi / Uygulamalı / Örnek Yaptı + Proje Ekibi / Danışman yorumu).
// Eğitmen düzenleme + inline kaydet IFS-5b'de. Departman özeti PR-3'te (burada değil).

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";

const ILERI_NAVY = "#1B4F72";

type OrnekStatus = "PENDING" | "BASARILI" | "TEKRAR_GEREKLI";
type CourseSeviye = "BASARILI" | "EGITIM_GEREKLI" | "BASARISIZ";

const ORNEK_STATUS_LABEL: Record<OrnekStatus, string> = {
  PENDING: "Bekliyor",
  BASARILI: "Başarılı",
  TEKRAR_GEREKLI: "Tekrar Gerekli",
};
const SEVIYE_LABEL: Record<CourseSeviye, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitime İhtiyacı Var",
  BASARISIZ: "Başarısız",
};

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
  ornekAciklama: string | null;
  ornekStatus: OrnekStatus;
  projeEkibiYorum: string | null;
  danismanYorum: string | null;
}
interface CourseEvaluation {
  seviye: CourseSeviye | null;
  not: string | null;
}
interface MatrixData {
  tasks: TaskRow[];
  users: UserRow[];
  evaluations: Record<string, EvalCell> | null;
  courseEvaluation: CourseEvaluation | null;
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
        ornekAciklama: null,
        ornekStatus: "PENDING",
        projeEkibiYorum: null,
        danismanYorum: null,
      };
      return { ...prev, [contentId]: { ...base, ...patch } };
    });

  // refetch=true → yazma sonrası matrisi yeniden çek (ör. ornekStatus değişince
  // kullanıcının ilerleme %'si recompute ile güncellenir).
  const patchCell = async (
    contentId: string,
    patch: Partial<EvalCell>,
    opts?: { refetch?: boolean; successMsg?: string }
  ) => {
    if (!selectedUser) return;
    try {
      const res = await fetch("/api/akademi/admin/reports/ifs-evaluations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser, contentId, ...patch }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Kaydedilemedi");
        load();
        return;
      }
      if (opts?.successMsg) toast.success(opts.successMsg);
      if (opts?.refetch) load();
    } catch {
      toast.error("Kaydedilemedi");
      load();
    }
  };

  const toggleCell = (contentId: string, patch: Partial<EvalCell>) => {
    setLocal(contentId, patch);
    patchCell(contentId, patch);
  };

  // PR-3: per-örnek eğitmen statüsü (Başarılı / Tekrar Gerekli / Bekliyor).
  // Yazımdan sonra ilerleme değişir → refetch.
  const setStatus = (contentId: string, status: OrnekStatus) => {
    setLocal(contentId, { ornekStatus: status });
    patchCell(
      contentId,
      { ornekStatus: status },
      { refetch: true, successMsg: "Statü kaydedildi" }
    );
  };

  // PR-3: per-ders eğitmen değerlendirmesi (seviye + not).
  const [courseEval, setCourseEval] = useState<CourseEvaluation>({
    seviye: null,
    not: null,
  });
  useEffect(() => {
    setCourseEval(
      data?.courseEvaluation ?? { seviye: null, not: null }
    );
  }, [data]);

  const saveCourseEval = async (patch: Partial<CourseEvaluation>) => {
    if (!selectedUser || !courseId) return;
    const next = { ...courseEval, ...patch };
    setCourseEval(next);
    try {
      const res = await fetch(
        "/api/akademi/admin/reports/ifs-course-evaluation",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedUser,
            courseId,
            seviye: next.seviye,
            not: next.not,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Kaydedilemedi");
        load();
        return;
      }
      toast.success("Ders değerlendirmesi kaydedildi");
      load(); // isCompleted / % recompute sonrası güncellensin
    } catch {
      toast.error("Kaydedilemedi");
      load();
    }
  };

  const selectCls = "px-3 py-2 text-sm rounded-md border bg-white min-w-[200px]";
  const selectedUserRow = data?.users.find((u) => u.userId === selectedUser);
  const canEdit = data?.canEdit ?? false;

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

          {/* PR-3: Per-ders eğitmen değerlendirmesi — seviye + not. Tamamlanma
              (isCompleted) yalnız seviye=Başarılı ile olur. */}
          <div
            className="ak-card-static p-4 space-y-3"
            style={{ borderTop: `3px solid ${ILERI_NAVY}` }}
          >
            <div
              className="text-sm font-semibold"
              style={{ color: ILERI_NAVY }}
            >
              Ders Değerlendirmesi (Eğitmen)
            </div>
            {canEdit ? (
              <>
                <RadioGroup
                  className="flex flex-wrap gap-4"
                  value={courseEval.seviye ?? ""}
                  onValueChange={(v) =>
                    saveCourseEval({ seviye: v as CourseSeviye })
                  }
                >
                  {(
                    ["BASARILI", "EGITIM_GEREKLI", "BASARISIZ"] as CourseSeviye[]
                  ).map((s) => (
                    <label
                      key={s}
                      htmlFor={`seviye-${s}`}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <RadioGroupItem id={`seviye-${s}`} value={s} />
                      {SEVIYE_LABEL[s]}
                    </label>
                  ))}
                </RadioGroup>
                <div className="space-y-1">
                  <Label className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
                    Not
                  </Label>
                  <Textarea
                    rows={2}
                    className="text-sm"
                    placeholder="Ders geneli değerlendirme notu..."
                    value={courseEval.not ?? ""}
                    onChange={(ev) =>
                      setCourseEval((c) => ({ ...c, not: ev.target.value }))
                    }
                    onBlur={(ev) =>
                      saveCourseEval({ not: ev.target.value.trim() || null })
                    }
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                {courseEval.seviye ? (
                  <Badge
                    variant={
                      courseEval.seviye === "BASARILI"
                        ? "default"
                        : courseEval.seviye === "BASARISIZ"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {SEVIYE_LABEL[courseEval.seviye]}
                  </Badge>
                ) : (
                  <span style={{ color: "var(--ak-text-tertiary)" }}>
                    Henüz değerlendirilmedi
                  </span>
                )}
                {courseEval.not && (
                  <span style={{ color: "var(--ak-text-secondary)" }}>
                    {courseEval.not}
                  </span>
                )}
              </div>
            )}
          </div>

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
                    Kursiyer Açıklaması
                  </th>
                  <th className="text-center px-2 py-2 text-xs font-semibold uppercase">
                    Eğitmen Statüsü
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
                  const status: OrnekStatus = e?.ornekStatus ?? "PENDING";
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
                      {/* Kursiyer "Örnek Yaptım" — SALT-OKUNUR bilgi rozeti. */}
                      <td className="px-2 py-2 text-center">
                        {e?.ornekYapildi ? (
                          <Badge variant="secondary" title="Kursiyer denedi olarak işaretledi">
                            Denedi
                          </Badge>
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--ak-text-tertiary)" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      {/* Kursiyer açıklaması — SALT-OKUNUR; ekip okuyup statü verir. */}
                      <td className="px-3 py-2 align-top">
                        {e?.ornekAciklama ? (
                          <span
                            className="text-xs whitespace-pre-wrap break-words"
                            style={{ color: "var(--ak-text-secondary)" }}
                          >
                            {e.ornekAciklama}
                          </span>
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--ak-text-tertiary)" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      {/* Eğitmen statüsü — Başarılı / Tekrar Gerekli (kontrol). */}
                      <td className="px-2 py-2 text-center">
                        {canEdit ? (
                          <Select
                            value={status}
                            onValueChange={(v) =>
                              setStatus(t.contentId, v as OrnekStatus)
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px] mx-auto text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">Bekliyor</SelectItem>
                              <SelectItem value="BASARILI">Başarılı</SelectItem>
                              <SelectItem value="TEKRAR_GEREKLI">
                                Tekrar Gerekli
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={
                              status === "BASARILI"
                                ? "default"
                                : status === "TEKRAR_GEREKLI"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {ORNEK_STATUS_LABEL[status]}
                          </Badge>
                        )}
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
