"use client";

import { Search, X } from "lucide-react";

export type CourseFilter = "all" | "in_progress" | "completed" | "not_started";

interface Props {
  filter: CourseFilter;
  onFilterChange: (f: CourseFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
  counts: {
    all: number;
    inProgress: number;
    completed: number;
    notStarted: number;
  };
}

const FILTERS: {
  value: CourseFilter;
  label: string;
  countKey: keyof Props["counts"];
}[] = [
  { value: "all", label: "Tümü", countKey: "all" },
  { value: "in_progress", label: "Devam Eden", countKey: "inProgress" },
  { value: "completed", label: "Tamamlanan", countKey: "completed" },
  { value: "not_started", label: "Başlamadı", countKey: "notStarted" },
];

export function CourseFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  counts,
}: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
      <div className="relative flex-1 max-w-md">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--ak-text-tertiary)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Eğitim ara..."
          className="w-full pl-10 pr-10 py-2.5 text-sm rounded-[10px] outline-none"
          style={{
            background: "var(--ak-bg-search)",
            border: "1px solid var(--ak-border-search)",
            color: "var(--ak-text-primary)",
          }}
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X
              className="w-4 h-4"
              style={{ color: "var(--ak-text-tertiary)" }}
            />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors"
              style={{
                background: isActive
                  ? "var(--ak-accent)"
                  : "var(--ak-bg-search)",
                color: isActive ? "#fff" : "var(--ak-text-secondary)",
                border: `1px solid ${
                  isActive ? "var(--ak-accent)" : "var(--ak-border-search)"
                }`,
              }}
            >
              {f.label} ({counts[f.countKey]})
            </button>
          );
        })}
      </div>
    </div>
  );
}
