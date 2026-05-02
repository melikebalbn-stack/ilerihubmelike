"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Clock, Users, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";

type ExamRow = {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  isActive: boolean;
  createdAt: string;
  course: { id: string; title: string } | null;
  _count: { questions: number; attempts: number };
};

export default function AdminExamsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteExam, setDeleteExam] = useState<ExamRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/akademi/admin/exams?${params}`)
      .then((r) => (r.ok ? r.json() : { exams: [] }))
      .then((data) => setExams(data.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const handleDeleteConfirm = async () => {
    if (!deleteExam) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/akademi/admin/exams/${deleteExam.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Silinemedi");
        return;
      }
      toast.success(`"${deleteExam.title}" silindi`);
      setDeleteExam(null);
      load();
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="ak-animate-in">
      <div className="flex items-center justify-between mb-5">
        <div className="relative max-w-xs w-full">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ak-text-tertiary)" }}
          />
          <input
            type="text"
            placeholder="Sınav adı ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
            style={{
              borderColor: "var(--ak-border-default)",
              background: "var(--ak-surface-input)",
              color: "var(--ak-text-primary)",
            }}
          />
        </div>

        <Link href="/akademi/admin/exams/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Yeni Sınav
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

      {!loading && exams.length === 0 && (
        <div
          className="ak-card-static p-12 text-center text-sm border border-dashed rounded-lg"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          {search ? "Aramayla eşleşen sınav bulunamadı" : "Henüz sınav yok"}
        </div>
      )}

      {!loading && exams.length > 0 && (
        <div
          className="rounded-lg overflow-hidden border"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <table className="w-full text-sm">
            <thead style={{ background: "var(--ak-surface-secondary)" }}>
              <tr>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Başlık
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Kurs
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  <span className="flex items-center justify-center gap-1">
                    <FileQuestion size={13} /> Soru
                  </span>
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  <span className="flex items-center justify-center gap-1">
                    <Users size={13} /> Deneme
                  </span>
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  <span className="flex items-center justify-center gap-1">
                    <Clock size={13} /> Süre
                  </span>
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Geçme
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  Durum
                </th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr
                  key={exam.id}
                  className="border-t transition-colors"
                  style={{ borderColor: "var(--ak-border-divider)" }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/akademi/admin/exams/${exam.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--ak-text-primary)" }}
                    >
                      {exam.title}
                    </Link>
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    {exam.course?.title ?? (
                      <span style={{ color: "var(--ak-text-tertiary)" }}>—</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {exam._count.questions}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {exam._count.attempts}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    {exam.timeLimit ? (
                      `${exam.timeLimit} dk`
                    ) : (
                      <span style={{ color: "var(--ak-text-tertiary)" }}>—</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    %{exam.passingScore}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {exam.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-800">
                        Aktif
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{
                          background: "var(--ak-surface-secondary)",
                          color: "var(--ak-text-tertiary)",
                        }}
                      >
                        Pasif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/akademi/admin/exams/${exam.id}`}
                        className="p-1.5 rounded hover:opacity-70 transition-opacity"
                        title="Düzenle"
                        style={{ color: "var(--ak-text-secondary)" }}
                      >
                        <Edit2 size={14} />
                      </Link>
                      <button
                        onClick={() => setDeleteExam(exam)}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDeleteConfirm
        open={deleteExam !== null}
        onOpenChange={(o) => !o && setDeleteExam(null)}
        title="Sınavı silmek istediğinize emin misiniz?"
        description={
          deleteExam
            ? `"${deleteExam.title}" kalıcı olarak silinecek. Deneme kaydı varsa silme engellenir.`
            : ""
        }
        confirmLabel="Sil"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}
