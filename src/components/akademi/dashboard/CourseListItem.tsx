"use client";

import Link from "next/link";
import { ChevronRight, BookOpen } from "lucide-react";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";
import { getGradientForId, formatDuration } from "@/lib/akademi-helpers";
import type { CourseListItem as CourseListItemType } from "@/types/akademi";

interface Props {
  course: CourseListItemType;
  delayIndex?: number;
}

export function CourseListItem({ course, delayIndex = 1 }: Props) {
  return (
    <Link
      href={`/akademi/courses/${course.id}`}
      className={`ak-card p-4 flex items-center gap-4 ak-animate-in ak-delay-${delayIndex}`}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: course.thumbnail
            ? `url(${course.thumbnail}) center/cover`
            : getGradientForId(course.id),
        }}
      >
        {!course.thumbnail && <BookOpen className="w-6 h-6 text-white" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div
            className="text-sm font-semibold truncate"
            style={{ color: "var(--ak-text-primary)" }}
          >
            {course.title}
          </div>
          <div
            className="text-xs shrink-0"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            {formatDuration(course.duration)}
          </div>
        </div>
        <ProgressBar
          value={course.progressPercent}
          size="sm"
          color={course.isCompleted ? "green" : "accent"}
        />
      </div>

      <ChevronRight
        className="w-4 h-4 shrink-0"
        style={{ color: "var(--ak-text-tertiary)" }}
      />
    </Link>
  );
}
