"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { StatCard } from "@/components/akademi/dashboard/StatCard";
import { CourseCard } from "@/components/akademi/dashboard/CourseCard";
import {
  CourseFilters,
  type CourseFilter,
} from "@/components/akademi/courses/CourseFilters";
import { buildCourseCardModel } from "@/lib/akademi/course-card-model";
import { coursesKpi } from "@/lib/akademi/page-kpi";
import type { CourseListItem } from "@/types/akademi";

export default function AkademiCoursesPage() {
  const { user } = useAkademiAuth();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CourseFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const url =
      user?.role === "admin"
        ? "/api/akademi/courses"
        : "/api/akademi/courses/my";
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => setCourses(data.courses ?? []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [user?.role]);

  const filtered = useMemo(() => {
    let result = courses;
    if (filter === "in_progress")
      result = result.filter((c) => !c.isCompleted && c.progressPercent > 0);
    else if (filter === "completed")
      result = result.filter((c) => c.isCompleted);
    else if (filter === "not_started")
      result = result.filter((c) => !c.isCompleted && c.progressPercent === 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [courses, filter, search]);

  const counts = useMemo(
    () => ({
      all: courses.length,
      inProgress: courses.filter((c) => !c.isCompleted && c.progressPercent > 0).length,
      completed: courses.filter((c) => c.isCompleted).length,
      notStarted: courses.filter((c) => !c.isCompleted && c.progressPercent === 0).length,
    }),
    [courses]
  );

  const kpi = useMemo(() => coursesKpi(courses), [courses]);
  const now = new Date();

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      <div className="mb-6 ak-animate-in">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ak-text-primary)" }}>
          Eğitimler
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          {user?.role === "admin" ? "Katalogdaki tüm eğitimler" : "Sana atanmış eğitimler"}
        </p>
      </div>

      {/* KPI satırı */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ak-animate-in">
        <StatCard compact icon="bookOpen" label="Toplam Eğitim" value={kpi.total} color="accent" delayIndex={1} />
        <StatCard compact icon="clock" label="Devam Eden" value={kpi.inProgress} color="orange" delayIndex={2} />
        <StatCard compact icon="award" label="Tamamlanan" value={kpi.completed} color="green" delayIndex={3} />
        <StatCard compact icon="flame" label="Zorunlu (Bekleyen)" value={kpi.zorunluPending} color="red" delayIndex={4} />
      </div>

      <CourseFilters
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        counts={counts}
      />

      {/* IFS Eğitimleri bandı — korunur (IFS marka stili) */}
      <Link
        href="/akademi/ifs"
        className="ak-card flex items-center gap-4 p-5 mb-5 transition hover:brightness-110"
        style={{ background: "#3D0068", border: "1px solid #5A1A8C" }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.10)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ifs-mark.webp" alt="IFS" className="w-full h-full object-contain p-1.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold" style={{ color: "#ffffff" }}>IFS Eğitimleri</div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
            Departmanına göre IFS geçiş görevleri — referans doküman & videolarla
          </div>
        </div>
        <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "rgba(255,255,255,0.80)" }} />
      </Link>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Eğitimler yükleniyor…
        </div>
      ) : filtered.length === 0 ? (
        <div className="ak-card-static p-8 text-center" style={{ color: "var(--ak-text-tertiary)" }}>
          {search || filter !== "all" ? "Filtreye uyan eğitim bulunamadı." : "Henüz eğitim yok."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-[18px]">
          {filtered.map((c) => (
            <CourseCard
              key={c.id}
              model={buildCourseCardModel(
                {
                  id: c.id,
                  title: c.title,
                  thumbnail: c.thumbnail,
                  category: c.category,
                  duration: c.duration,
                  videoCount: c.videoCount ?? 0,
                  examQuestionCount: c.examQuestionCount ?? 0,
                  progressPercent: c.progressPercent,
                  isCompleted: c.isCompleted,
                  dueDate: c.dueDate ?? null,
                  assignedAt: c.assignedAt ?? null,
                },
                now
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
