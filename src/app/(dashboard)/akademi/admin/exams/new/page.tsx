"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

type CourseOption = { id: string; title: string };

export default function NewExamPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [passingScore, setPassingScore] = useState("70");
  const [timeLimit, setTimeLimit] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [courses, setCourses] = useState<CourseOption[]>([]);

  useEffect(() => {
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
      .catch(() => setCourses([]));
  }, []);

  const handleSubmit = async () => {
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
      const res = await fetch("/api/akademi/admin/exams", {
        method: "POST",
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
        toast.error(err.error || "İşlem başarısız");
        return;
      }

      const data = await res.json();
      toast.success("Sınav oluşturuldu");
      router.push(`/akademi/admin/exams/${data.exam.id}`);
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ak-animate-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
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
            Yeni Sınav
          </h2>
          <p className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
            Sorular bir sonraki adımda eklenebilir
          </p>
        </div>
      </div>

      <div className="ak-card-static p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">
            Başlık <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. BGYS Temel Bilgiler Sınavı"
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Açıklama</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sınavın amacı ve kapsamı"
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

        <div className="flex gap-3 pt-1">
          <Link href="/akademi/admin/exams">
            <Button variant="outline" disabled={saving}>
              İptal
            </Button>
          </Link>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Oluşturuluyor..." : "Sınav Oluştur"}
          </Button>
        </div>
      </div>
    </div>
  );
}
