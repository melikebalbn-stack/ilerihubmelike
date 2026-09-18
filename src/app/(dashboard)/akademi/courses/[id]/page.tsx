"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CourseHero } from "@/components/akademi/courses/CourseHero";
import { ContentRow } from "@/components/akademi/courses/ContentRow";
import { VideoContentCard } from "@/components/akademi/courses/VideoContentCard";
import { ContentViewerModal } from "@/components/akademi/courses/ContentViewerModal";
import { CourseExamsSection } from "./_components/course-exams-section";
import type { CourseDetail, ContentItem } from "@/types/akademi";

export default function AkademiCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // ESKİ LİNK KORUMASI: IFS alan detayı /ifs/odevler/[courseId] altına taşındı.
  // Kayıtlı/paylaşılmış ?ifsDept= linkleri kırılmasın diye burada yönlendiriyoruz
  // — /akademi/ifs ve /akademi/admin/ifs-training için kurduğumuz desenin aynısı.
  // Parametre YOKSA sayfa eskisi gibi çalışır; akademi kursiyerleri etkilenmez.
  const searchParams = useSearchParams();
  const ifsDept = searchParams.get("ifsDept");
  useEffect(() => {
    if (ifsDept && id) {
      router.replace(
        `/ifs/odevler/${id}?dept=${encodeURIComponent(ifsDept)}`
      );
    }
  }, [ifsDept, id, router]);

  const backHref = "/akademi/courses";
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerContent, setViewerContent] = useState<ContentItem | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadCourse = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/akademi/courses/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCourse(data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (id) loadCourse();
  }, [id, loadCourse]);

  const handleMarkComplete = async (contentId: string) => {
    if (markingId) return;
    setMarkingId(contentId);
    try {
      const res = await fetch(
        `/api/akademi/contents/${contentId}/progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        // 409: "Videonun %90'ı izlenmeli (%X)" gibi sunucu mesajını göster.
        const err = await res.json().catch(() => ({}));
        alert(err.error || "İşlem başarısız oldu. Lütfen tekrar deneyin.");
        return;
      }
      await res.json();
      loadCourse();
      if (viewerContent?.id === contentId) {
        setViewerContent(null);
      }
    } catch {
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setMarkingId(null);
    }
  };

  // IFS-4: GOREV "Örnek Yaptım" / geri al — ayrı endpoint (atama guard + evaluation).
  const handleGorevDurum = async (
    contentId: string,
    durum: string,
    aciklama?: string
  ) => {
    if (markingId) return;
    setMarkingId(contentId);
    try {
      const res = await fetch(
        `/api/akademi/contents/${contentId}/ifs-complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            aciklama ? { durum, aciklama } : { durum }
          ),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "İşlem başarısız oldu. Lütfen tekrar deneyin.");
        return;
      }
      await res.json();
      loadCourse();
    } catch {
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="px-8 py-7 max-w-5xl mx-auto">
        <div
          className="text-sm text-center py-12"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Eğitim yükleniyor...
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="px-8 py-7 max-w-5xl mx-auto">
        <div
          className="ak-card-static p-8 text-center"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          <div className="text-base font-semibold mb-3">
            Eğitim bulunamadı
          </div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--ak-accent)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Eğitimlere Dön
          </Link>
        </div>
      </div>
    );
  }

  // Eğitim ilerlemesi = tamamlanan / zorunlu (GOREV dışı) içerik. Hero bunu gösterir;
  // course-progress.ts'in sınav ağırlıklı yüzdesi (sertifika/rapor) DEĞİŞMEDİ.
  const zorunluIcerikler = course.contents.filter((c) => c.type !== "GOREV");
  const zorunluIcerik = zorunluIcerikler.length;
  const tamamlananIcerik = zorunluIcerikler.filter((c) => c.completedByCurrentUser).length;
  const egitimYuzdesi =
    zorunluIcerik > 0 ? Math.round((tamamlananIcerik / zorunluIcerik) * 100) : Math.round(course.progressPercent);

  return (
    <div className="px-8 py-7 max-w-5xl mx-auto">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium mb-5"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Eğitimlere Dön
      </Link>

      <CourseHero course={course} contentPercent={egitimYuzdesi} />

      {/* 1. ADIM — EĞİTİM: VIDEO içerikler büyük kart, diğerleri satır. */}
      <section
        className="ak-card-static p-5 mb-5"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            1. Adım — Eğitim
          </h2>
          <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
            {tamamlananIcerik}/{zorunluIcerik} içerik tamamlandı
          </span>
        </div>

        {course.contents.length === 0 ? (
          <div
            className="p-6 text-center text-sm"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Bu eğitime henüz içerik eklenmemiş.
          </div>
        ) : (
          <div className="space-y-3">
            {course.contents.map((c, i) =>
              c.type === "VIDEO" ? (
                <VideoContentCard
                  key={c.id}
                  content={c}
                  index={i}
                  onOpen={setViewerContent}
                />
              ) : (
                <ContentRow
                  key={c.id}
                  content={c}
                  index={i}
                  onOpen={setViewerContent}
                  onMarkComplete={handleMarkComplete}
                  onGorevDurum={handleGorevDurum}
                  isMarking={markingId === c.id}
                />
              )
            )}
          </div>
        )}
      </section>

      {/* 2. ADIM — SINAV: sunucudan gelen locked ile kilitli görünüm. */}
      <CourseExamsSection courseId={course.id} reloadKey={course.progressPercent + ":" + tamamlananIcerik} />

      <ContentViewerModal
        content={viewerContent}
        onClose={() => setViewerContent(null)}
        onMarkComplete={handleMarkComplete}
        isMarking={markingId !== null}
      />
    </div>
  );
}
