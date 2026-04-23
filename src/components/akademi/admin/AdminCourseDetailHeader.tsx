"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, BookOpen, Clock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDifficultyLabel,
  formatDuration,
  getGradientForId,
} from "@/lib/akademi-helpers";
import type { AdminCourseListItem } from "@/types/akademi-admin";

interface Props {
  course: AdminCourseListItem;
  onEdit: () => void;
}

export function AdminCourseDetailHeader({ course, onEdit }: Props) {
  return (
    <>
      <Link
        href="/akademi/admin/courses"
        className="inline-flex items-center gap-2 text-sm font-medium mb-4"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Kurslara Dön
      </Link>

      <div
        className="relative rounded-[14px] overflow-hidden p-5 mb-5 text-white"
        style={{
          background: course.thumbnail
            ? `linear-gradient(135deg, rgba(15,23,42,0.4), rgba(15,23,42,0.6)), url(${course.thumbnail}) center/cover`
            : getGradientForId(course.id),
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {course.category && (
                <span className="text-xs font-semibold px-2 py-1 rounded bg-white/20">
                  {course.category}
                </span>
              )}
              <span className="text-xs px-2 py-1 rounded bg-white/10">
                {getDifficultyLabel(course.difficulty)}
              </span>
              {!course.isActive && (
                <span className="text-xs px-2 py-1 rounded bg-red-500/80">
                  Pasif
                </span>
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-bold mb-1">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-white/80 line-clamp-2">
                {course.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-white/90 mt-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {formatDuration(course.duration)}
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                {course.contentCount} içerik
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {course.assignmentCount} atama
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={onEdit}
            className="gap-2 shrink-0"
          >
            <Pencil className="w-4 h-4" />
            Kursu Düzenle
          </Button>
        </div>
      </div>
    </>
  );
}
