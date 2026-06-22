"use client";

import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  title: string;
  description: string;
  expectedSprint: string;
  features: string[];
}

export function PlaceholderPage({
  title,
  description,
  expectedSprint,
  features,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 py-12">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "var(--ak-accent-glow)" }}
      >
        <Sparkles
          className="w-8 h-8"
          style={{ color: "var(--ak-accent)" }}
        />
      </div>
      <h1
        className="text-2xl font-bold mb-3"
        style={{ color: "var(--ak-text-primary)" }}
      >
        {title}
      </h1>
      <p
        className="text-base mb-6 max-w-md"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        {description}
      </p>
      <div className="ak-card-static p-5 text-left max-w-md w-full mb-6">
        <div
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: "var(--ak-accent)" }}
        >
          {expectedSprint} — Planlanan özellikler
        </div>
        <ul className="space-y-2">
          {features.map((f, i) => (
            <li
              key={i}
              className="text-sm flex items-start gap-2"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              <span style={{ color: "var(--ak-accent)" }}>•</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
      <Link
        href="/akademi"
        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[10px] transition-colors"
        style={{ color: "var(--ak-accent)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Akademi Ana Sayfasına Dön
      </Link>
    </div>
  );
}
