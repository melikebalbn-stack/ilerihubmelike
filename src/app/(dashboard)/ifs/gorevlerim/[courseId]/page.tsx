"use client";

// IFS GÖREVLERİM — alan detayı (drill-down Sv3).
//
// Eskiden Sv2'deki kart /akademi/courses/[id]?ifsDept=… adresine gidiyordu:
// kursiyer IFS'ten akademiye fırlıyor, geri dönüş de iki sıçrama oluyordu
// (/akademi/ifs → /ifs/gorevlerim). Artık üç seviye de /ifs altında.
//
// BİLEŞENLER KOPYALANMADI, akademi'den import edildi — CourseHero, ContentRow,
// ContentViewerModal. ContentRow'un GOREV mantığı (Örnek Yaptım / Farklı Dept. /
// Eğitim Gerekli + açıklama modalı) zaten `isGorev` ile ayrılmış durumda.
// Uçlar da AYNI, yeni uç yazılmadı:
//   GET  /api/akademi/courses/[id]
//   POST /api/akademi/contents/[id]/progress       (GOREV dışı içerik)
//   POST /api/akademi/contents/[id]/ifs-complete   (GOREV durum işaretleme)
//
// CourseExamsSection BİLEREK YOK: /api/akademi/exams bugün süzgeçsiz
// (where { isActive: true }) — aktif her sınavı herkese listeliyor. Buraya
// konsaydı IFS kursiyeri kendi alanıyla ilgisiz sınavları görürdü. Süzgeç
// kararı verilip uygulandıktan sonra eklenebilir (prod-slot-durumu.md'de
// "IFS SINAV: AÇIK KALAN İŞ" maddesi).

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CourseHero } from "@/components/akademi/courses/CourseHero";
import { ContentRow } from "@/components/akademi/courses/ContentRow";
import { ContentViewerModal } from "@/components/akademi/courses/ContentViewerModal";
import type { CourseDetail, ContentItem } from "@/types/akademi";

export default function IfsGorevlerimDetayPage() {
  const params = useParams();
  const courseId = params?.courseId as string;

  // Geri dönüş TEK SIÇRAMA: ?dept= varsa o departmana, yoksa listeye.
  const searchParams = useSearchParams();
  const dept = searchParams.get("dept");
  const backHref = dept
    ? `/ifs/gorevlerim?dept=${encodeURIComponent(dept)}`
    : "/ifs/gorevlerim";

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerContent, setViewerContent] = useState<ContentItem | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadCourse = useCallback(() => {
    if (!courseId) return;
    setLoading(true);
    fetch(`/api/akademi/courses/${courseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCourse(data))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (courseId) loadCourse();
  }, [courseId, loadCourse]);

  const handleMarkComplete = async (contentId: string) => {
    if (markingId) return;
    setMarkingId(contentId);
    try {
      const res = await fetch(`/api/akademi/contents/${contentId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        alert("İşlem başarısız oldu. Lütfen tekrar deneyin.");
        return;
      }
      await res.json();
      loadCourse();
      if (viewerContent?.id === contentId) setViewerContent(null);
    } catch {
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setMarkingId(null);
    }
  };

  // GOREV durum işaretlemesi — ayrı uç (atama guard'ı + IfsTaskEvaluation).
  // Açıklama YALNIZ ORNEK_YAPILDI'da zorunlu; uç bunu kendisi doğruluyor.
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
          body: JSON.stringify(aciklama ? { durum, aciklama } : { durum }),
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
          Alan yükleniyor...
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
          <div className="text-base font-semibold mb-3">Alan bulunamadı</div>
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

      <CourseHero course={course} />

      <div className="mb-3">
        <h2
          className="text-base font-bold mb-3"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Görevler ({course.contents.length})
        </h2>
      </div>

      {course.contents.length === 0 ? (
        <div
          className="ak-card-static p-6 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Bu alanda henüz görev yok.
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
              onGorevDurum={handleGorevDurum}
              isMarking={markingId === c.id}
            />
          ))}
        </div>
      )}

      <ContentViewerModal
        content={viewerContent}
        onClose={() => setViewerContent(null)}
        onMarkComplete={handleMarkComplete}
        isMarking={markingId !== null}
      />
    </div>
  );
}
