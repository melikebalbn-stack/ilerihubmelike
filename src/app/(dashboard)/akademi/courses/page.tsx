"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { GraduationCap, ChevronRight } from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { CourseCard } from "@/components/akademi/courses/CourseCard";
import {
  CourseFilters,
  type CourseFilter,
} from "@/components/akademi/courses/CourseFilters";
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

    if (filter === "in_progress") {
      result = result.filter(
        (c) => !c.isCompleted && c.progressPercent > 0
      );
    } else if (filter === "completed") {
      result = result.filter((c) => c.isCompleted);
    } else if (filter === "not_started") {
      result = result.filter(
        (c) => !c.isCompleted && c.progressPercent === 0
      );
    }

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
      inProgress: courses.filter(
        (c) => !c.isCompleted && c.progressPercent > 0
      ).length,
      completed: courses.filter((c) => c.isCompleted).length,
      notStarted: courses.filter(
        (c) => !c.isCompleted && c.progressPercent === 0
      ).length,
    }),
    [courses]
  );

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      <div className="mb-6 ak-animate-in">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--ak-text-primary)" }}
        >
          📚 Eğitimler
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          {user?.role === "admin"
            ? "Katalogdaki tüm eğitimler"
            : "Sana atanmış eğitimler"}
        </p>
      </div>

      <CourseFilters
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        counts={counts}
      />

      {/* IFS-6.1: IFS Eğitimleri giriş kartı (nav'dan buraya taşındı) —
          katalogun üstünde, normal kurs kartlarından ayrı "bölüm girişi". */}
      <Link
        href="/akademi/ifs"
        className="ak-card flex items-center gap-4 p-5 mb-5"
        style={{
          background: "var(--ak-accent-glow)",
          border: "1px solid var(--ak-accent)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--ak-accent)" }}
        >
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-base font-bold"
            style={{ color: "var(--ak-text-primary)" }}
          >
            🎓 IFS Eğitimleri
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Departmanına göre IFS geçiş görevleri — referans doküman & videolarla
          </div>
        </div>
        <ChevronRight
          className="w-5 h-5 shrink-0"
          style={{ color: "var(--ak-accent)" }}
        />
      </Link>

      {loading ? (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Eğitimler yükleniyor...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="ak-card-static p-8 text-center"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          {search || filter !== "all"
            ? "Filtreye uyan eğitim bulunamadı."
            : "Henüz eğitim yok."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
