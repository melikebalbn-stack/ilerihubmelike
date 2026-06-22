"use client";

import { Clock, CheckCircle2, Layers } from "lucide-react";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";
import { AnimatedNumber } from "@/components/akademi/shared/AnimatedNumber";
import {
  getGradientForId,
  getDifficultyLabel,
  formatDuration,
} from "@/lib/akademi-helpers";
import type { CourseDetail } from "@/types/akademi";

interface Props {
  course: CourseDetail;
}

export function CourseHero({ course }: Props) {
  return (
    <div
      className="relative rounded-[14px] overflow-hidden p-6 mb-6 text-white ak-animate-in"
      style={{
        background: course.thumbnail
          ? `linear-gradient(135deg, rgba(15,23,42,0.4), rgba(15,23,42,0.6)), url(${course.thumbnail}) center/cover`
          : getGradientForId(course.id),
      }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {course.category && (
              <div className="text-xs font-semibold px-2.5 py-1 rounded bg-white/20 backdrop-blur">
                {course.category}
              </div>
            )}
            <div className="text-xs font-medium px-2.5 py-1 rounded bg-white/10 backdrop-blur">
              {getDifficultyLabel(course.difficulty)}
            </div>
            {!course.isAssigned && (
              <div className="text-xs font-semibold px-2.5 py-1 rounded bg-orange-500/90">
                Atanmamış
              </div>
            )}
            {course.isCompleted && (
              <div className="text-xs font-semibold px-2.5 py-1 rounded bg-green-500/90 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Tamamlandı
              </div>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {course.title}
          </h1>

          {course.description && (
            <p className="text-sm text-white/80 mb-4 max-w-2xl">
              {course.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-white/90">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDuration(course.duration)}
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              {course.contentCount} içerik
            </div>
          </div>
        </div>

        <div className="md:w-64 shrink-0">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-white/70 mb-1">
              İlerleme
            </div>
            <div className="text-3xl font-bold mb-2">
              %<AnimatedNumber value={Math.round(course.progressPercent)} />
            </div>
            <ProgressBar
              value={course.progressPercent}
              size="md"
              color={course.isCompleted ? "green" : "accent"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
