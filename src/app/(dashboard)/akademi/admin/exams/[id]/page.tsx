"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import { QuestionsManager } from "./_components/questions-manager";

type CourseOption = { id: string; title: string };

type ExamDetail = {
  id: string;
  title: string;
  description: string | null;
  courseId: string | null;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  isActive: boolean;
  course: { id: string; title: string } | null;
  _count: { attempts: number };
  questions: { id: string }[];
};

export default function EditExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [passingScore, setPassingScore] = useState("70");
  const [timeLimit, setTimeLimit] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadExam = useCallback(async () => {
    if (!examId) return;
    try {
      const res = await fetch(`/api/akademi/admin/exams/${examId}`);
      if (!res.ok) {
        setExam(null);
        return;
      }
      const data = await res.json();
      const e: ExamDetail = data.exam;
      setExam(e);
      setTitle(e.title);
      setDescription(e.description ?? "");
      setCourseId(e.courseId ?? "");
      setPassingScore(e.passingScore.toString());
      setTimeLimit(e.timeLimit?.toString() ?? "");
      setMaxAttempts(e.maxAttempts.toString());
      setIsActive(e.isActive);
    } catch {
      setExam(null);
    }
  }, [examId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadExam(),
      fetch("/api/akademi/admin/courses")
        .then((r) => (r.ok ? r.json() : { courses: [] }))
        .then((data) =>
          setCourses(
            (data.courses ?? []).map((c: CourseOption) => ({
              id: c.id,
              title: c.title,
            }))
          )
        )
        .catch(() => setCourses([])),
    ]).finally(() => setLoading(false));
  }, [loadExam]);

  const handleSave = async () => {
    if (saving) return;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      toast.error("Başlık en az 3 karakter olmalı");
      return;
    }

    const ps = parseInt(passingScore, 10);
    if (isNaN(ps) || ps < 0 || ps > 100) {
      toast.error("Geçme barajı 0-100 arası olmalı");
      return;
    }

    const tl = timeLimit.trim() ? parseInt(timeLimit, 10) : null;
    if (tl !== null && (isNaN(tl) || tl < 1 || tl > 480)) {
      toast.error("Süre 1-480 dakika arası olmalı");
      return;
    }

    const ma = parseInt(maxAttempts, 10);
    if (isNaN(ma) || ma < 1 || ma > 10) {
      toast.error("Max deneme 1-10 arası olmalı");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/akademi/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || null,
          courseId: courseId || null,
          passingScore: ps,
          timeLimit: tl,
          maxAttempts: ma,
          isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Güncelleme başarısız");
        return;
      }

      toast.success("Sınav güncellendi");
      loadExam();
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/akademi/admin/exams/${examId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Silinemedi");
        return;
      }
      toast.success("Sınav silindi");
      router.push("/akademi/admin/exams");
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="text-sm text-center py-8"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Yükleniyor...
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="ak-card-static p-8 text-center text-sm">
        Sınav bulunamadı.{" "}
        <Link
          href="/akademi/admin/exams"
          className="underline"
          style={{ color: "var(--ak-accent)" }}
        >
          Listeye dön
        </Link>
      </div>
    );
  }

  return (
    <div className="ak-animate-in max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/akademi/admin/exams"
          className="p-1.5 rounded hover:opacity-70 transition-opacity"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--ak-text-primary)" }}
          >
            {exam.title}
          </h2>
          <p className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
            {exam._count.attempts} deneme · {exam.questions.length} soru
          </p>
        </div>
      </div>

      {/* Exam settings form */}
      <div className="ak-card-static p-6 space-y-5">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Sınav Ayarları
        </h3>

        <div className="space-y-2">
          <Label htmlFor="title">
            Başlık <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Açıklama</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="space-y-2">
          <Label>İlişkili Kurs</Label>
          <Select
            value={courseId || "__none__"}
            onValueChange={(v) => setCourseId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kurs seç (opsiyonel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Bağımsız sınav —</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="passingScore">
              Geçme Barajı (%) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="passingScore"
              type="number"
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              min={0}
              max={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeLimit">Süre (dk)</Label>
            <Input
              id="timeLimit"
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              placeholder="Sınırsız"
              min={1}
              max={480}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAttempts">
              Max Deneme <span className="text-red-500">*</span>
            </Label>
            <Input
              id="maxAttempts"
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              min={1}
              max={10}
            />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-3 border-t"
          style={{ borderColor: "var(--ak-border-divider)" }}
        >
          <div>
            <Label htmlFor="isActive" className="font-semibold">
              Aktif
            </Label>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Pasif sınavlar kullanıcılara görünmez
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setDeleteOpen(true)}
            disabled={saving}
          >
            Sınavı Sil
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      <QuestionsManager examId={examId} onChange={loadExam} />

      <AdminDeleteConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Sınavı silmek istediğinize emin misiniz?"
        description={`"${exam.title}" kalıcı olarak silinecek. ${
          exam._count.attempts > 0
            ? `Bu sınava ${exam._count.attempts} deneme kaydı var — silme engellenir, bunun yerine pasif yapın.`
            : "Tüm sorular ve seçenekler de silinir."
        }`}
        confirmLabel="Sil"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
