"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Clock, CheckCircle2 } from "lucide-react";
import { AnimatedNumber } from "@/components/akademi/shared/AnimatedNumber";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";
import {
  getGradientForId,
  getDifficultyLabel,
  formatDuration,
} from "@/lib/akademi-helpers";
import type { CourseListItem } from "@/types/akademi";

interface Props {
  course: CourseListItem;
  // IFS Sv2'den gelindiğinde: kurs detayına bölüm origin'i taşı (geri-link bölüme dönsün).
  ifsDept?: string;
}

export function CourseCard({ course, ifsDept }: Props) {
  const href = ifsDept
    ? `/akademi/courses/${course.id}?ifsDept=${encodeURIComponent(ifsDept)}`
    : `/akademi/courses/${course.id}`;
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link
        href={href}
        className="ak-card block overflow-hidden h-full flex flex-col"
      >
        <div
          className="relative h-36 flex items-center justify-center"
          style={{
            background: course.thumbnail
              ? `url(${course.thumbnail}) center/cover`
              : getGradientForId(course.id),
          }}
        >
          {!course.thumbnail && (
            <BookOpen className="w-12 h-12 text-white opacity-80" />
          )}

          {course.isCompleted && (
            <div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
              style={{
                background: "rgba(255,255,255,0.95)",
                color: "var(--ak-green)",
              }}
            >
              <CheckCircle2 className="w-3 h-3" />
              Tamamlandı
            </div>
          )}
          {!course.isCompleted && course.progressPercent > 0 && (
            <div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(255,255,255,0.95)",
                color: "var(--ak-orange)",
              }}
            >
              Devam Ediyor
            </div>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            {course.category && (
              <div
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{
                  background: "var(--ak-accent-glow)",
                  color: "var(--ak-accent)",
                }}
              >
                {course.category}
              </div>
            )}
            <div
              className="text-xs"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              {getDifficultyLabel(course.difficulty)}
            </div>
          </div>

          <div
            className="text-base font-bold mb-1 line-clamp-2"
            style={{ color: "var(--ak-text-primary)" }}
          >
            {course.title}
          </div>

          {course.description && (
            <div
              className="text-xs mb-3 line-clamp-2 flex-1"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              {course.description}
            </div>
          )}

          <div className="mt-auto space-y-2">
            <ProgressBar
              value={course.progressPercent}
              size="sm"
              color={course.isCompleted ? "green" : "accent"}
            />
            <div className="flex items-center justify-between text-xs">
              <div
                className="flex items-center gap-1"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                <Clock className="w-3 h-3" />
                {formatDuration(course.duration)}
              </div>
              <div
                className="font-semibold"
                style={{ color: "var(--ak-text-secondary)" }}
              >
                %<AnimatedNumber value={Math.round(course.progressPercent)} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
