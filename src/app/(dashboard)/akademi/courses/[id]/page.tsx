"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CourseHero } from "@/components/akademi/courses/CourseHero";
import { ContentRow } from "@/components/akademi/courses/ContentRow";
import { ContentViewerModal } from "@/components/akademi/courses/ContentViewerModal";
import { CourseExamsSection } from "./_components/course-exams-section";
import type { CourseDetail, ContentItem } from "@/types/akademi";

export default function AkademiCourseDetailPage() {
  const params = useParams();
  const id = params?.id as string;
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
        alert("İşlem başarısız oldu. Lütfen tekrar deneyin.");
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
            href="/akademi/courses"
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

  return (
    <div className="px-8 py-7 max-w-5xl mx-auto">
      <Link
        href="/akademi/courses"
        className="inline-flex items-center gap-2 text-sm font-medium mb-5"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Eğitimlere Dön
      </Link>

      <CourseHero course={course} />

      <div className="mb-3">
        <h2
          className="text-base font-bold mb-3"
          style={{ color: "var(--ak-text-primary)" }}
        >
          İçerikler ({course.contents.length})
        </h2>
      </div>

      {course.contents.length === 0 ? (
        <div
          className="ak-card-static p-6 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Bu eğitime henüz içerik eklenmemiş.
        </div>
      ) : (
        <div className="space-y-2.5">
          {course.contents.map((c, i) => (
            <ContentRow
              key={c.id}
              content={c}
              index={i}
              onOpen={setViewerContent}
              onMarkComplete={handleMarkComplete}
              isMarking={markingId === c.id}
            />
          ))}
        </div>
      )}

      <CourseExamsSection courseId={course.id} />

      <ContentViewerModal
        content={viewerContent}
        onClose={() => setViewerContent(null)}
        onMarkComplete={handleMarkComplete}
        isMarking={markingId !== null}
      />
    </div>
  );
}
