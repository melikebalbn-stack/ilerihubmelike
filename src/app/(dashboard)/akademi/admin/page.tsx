"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  Users,
  Award,
  FileQuestion,
  Clock,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
  Download,
  type LucideIcon,
} from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";

type Stats = {
  courses: { total: number; active: number };
  assignments: { total: number };
  users: { active: number };
  xp: { totalGranted: number };
  exams: {
    total: number;
    active: number;
    totalAttempts: number;
    completedAttempts: number;
    pendingReview: number;
    passRate: number;
    avgScore: number;
  };
  certificates: {
    total: number;
    last30Days: number;
    totalVerifications: number;
  };
  trends: Array<{ month: string; attempts: number; certificates: number }>;
};

type Activity = {
  type: "exam_attempt" | "certificate" | "course_complete";
  timestamp: string;
  userName: string;
  title: string;
  detail: string;
};

export default function AdminAkademiDashboard() {
  useAkademiAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/akademi/admin/stats").then((r) => r.json()),
      fetch("/api/akademi/admin/reports/recent-activity").then((r) => r.json()),
    ])
      .then(([s, a]) => {
        setStats(s);
        setActivity(a.events ?? []);
      })
      .catch(() => {
        /* sessizce yut */
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="ak-animate-in space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Akademi Yönetim Paneli
        </h1>
        <a
          href="/api/akademi/admin/reports/export?type=all"
          className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 inline-flex items-center gap-2 text-sm font-medium"
        >
          <FileSpreadsheet size={14} />
          Tüm Raporları Excel İndir
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={BookOpen}
          label="Aktif Kurs"
          value={stats.courses.active}
          sub={`/ ${stats.courses.total} toplam`}
          color="blue"
        />
        <StatCard
          icon={FileQuestion}
          label="Aktif Sınav"
          value={stats.exams.active}
          sub={`/ ${stats.exams.total} toplam`}
          color="indigo"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Atama"
          value={stats.assignments.total}
          color="cyan"
        />
        <StatCard
          icon={Users}
          label="Aktif Kullanıcı"
          value={stats.users.active}
          color="emerald"
        />
        <StatCard
          icon={Award}
          label="Sertifika"
          value={stats.certificates.total}
          sub={`+${stats.certificates.last30Days} son 30 gün`}
          color="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="Sınav Denemesi"
          value={stats.exams.totalAttempts}
          sub={`${stats.exams.completedAttempts} tamamlandı`}
          color="violet"
        />
        <StatCard
          icon={Clock}
          label="Bekleyen Değerlendirme"
          value={stats.exams.pendingReview}
          color="orange"
        />
        <StatCard
          icon={BarChart3}
          label="Geçme Oranı"
          value={`%${stats.exams.passRate}`}
          color="green"
        />
        <StatCard
          icon={BarChart3}
          label="Ort. Puan"
          value={`%${stats.exams.avgScore}`}
          color="teal"
        />
        <StatCard
          icon={Download}
          label="Sertifika Doğrulama"
          value={stats.certificates.totalVerifications}
          color="purple"
        />
      </div>

      <div
        className="border rounded-lg p-4 bg-white"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        <h3
          className="font-semibold mb-3"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Son 12 Ay Trend
        </h3>
        <TrendChart data={stats.trends} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="border rounded-lg p-4 bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3
              className="font-semibold"
              style={{ color: "var(--ak-text-primary)" }}
            >
              Son Aktiviteler
            </h3>
            <Link
              href="/akademi/admin/reports"
              className="text-xs text-blue-600 hover:underline"
            >
              Detaylı Raporlar →
            </Link>
          </div>
          <div className="space-y-2">
            {activity.length === 0 && (
              <div
                className="text-sm"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                Henüz aktivite yok
              </div>
            )}
            {activity.map((e, idx) => (
              <ActivityRow key={idx} event={e} />
            ))}
          </div>
        </div>

        <div
          className="border rounded-lg p-4 bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <h3
            className="font-semibold mb-3"
            style={{ color: "var(--ak-text-primary)" }}
          >
            Hızlı Erişim
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickLink
              href="/akademi/admin/courses"
              icon={BookOpen}
              label="Kurslar"
            />
            <QuickLink
              href="/akademi/admin/exams"
              icon={FileQuestion}
              label="Sınavlar"
            />
            <QuickLink
              href="/akademi/admin/grading"
              icon={Clock}
              label="Bekleyen Değerlendirme"
              badge={stats.exams.pendingReview}
            />
            <QuickLink
              href="/akademi/admin/certificates"
              icon={Award}
              label="Sertifikalar"
            />
            <QuickLink
              href="/akademi/admin/certificate-templates"
              icon={Award}
              label="Şablonlar"
            />
            <QuickLink
              href="/akademi/admin/reports"
              icon={BarChart3}
              label="Raporlar"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  cyan: "bg-cyan-100 text-cyan-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  orange: "bg-orange-100 text-orange-700",
  green: "bg-green-100 text-green-700",
  teal: "bg-teal-100 text-teal-700",
  purple: "bg-purple-100 text-purple-700",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  color: keyof typeof COLOR_MAP | string;
}) {
  return (
    <div
      className="border rounded-lg p-3 bg-white"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <div
        className={`inline-flex items-center justify-center w-8 h-8 rounded ${
          COLOR_MAP[color] ?? "bg-slate-100 text-slate-700"
        } mb-2`}
      >
        <Icon size={16} />
      </div>
      <div
        className="text-2xl font-bold"
        style={{ color: "var(--ak-text-primary)" }}
      >
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
        {label}
      </div>
      {sub && (
        <div
          className="text-xs mt-0.5"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function TrendChart({
  data,
}: {
  data: Array<{ month: string; attempts: number; certificates: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Veri yok
      </div>
    );
  }
  const max = Math.max(
    ...data.map((d) => d.attempts),
    ...data.map((d) => d.certificates),
    1
  );
  const width = 600;
  const height = 120;
  const barWidth = (width - 40) / data.length;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 30} className="text-xs">
        {data.map((d, idx) => {
          const x = 30 + idx * barWidth;
          const ah = max > 0 ? (d.attempts / max) * height : 0;
          const ch = max > 0 ? (d.certificates / max) * height : 0;
          return (
            <g key={idx}>
              <rect
                x={x}
                y={height - ah}
                width={barWidth * 0.4}
                height={ah}
                fill="#3b82f6"
                opacity="0.7"
              />
              <rect
                x={x + barWidth * 0.45}
                y={height - ch}
                width={barWidth * 0.4}
                height={ch}
                fill="#f59e0b"
                opacity="0.7"
              />
              <text
                x={x + barWidth / 2}
                y={height + 15}
                textAnchor="middle"
                fill="#64748b"
                fontSize="10"
              >
                {d.month.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-xs mt-2">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-500 opacity-70 inline-block" /> Sınav
          Denemesi
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 bg-amber-500 opacity-70 inline-block" />
          Sertifika
        </span>
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: Activity }) {
  const date = new Date(event.timestamp).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const icons: Record<Activity["type"], LucideIcon> = {
    exam_attempt: FileQuestion,
    certificate: Award,
    course_complete: BookOpen,
  };
  const Icon = icons[event.type];
  return (
    <div className="flex items-start gap-2 text-sm border-b border-slate-100 pb-2 last:border-0">
      <Icon size={14} className="text-slate-400 mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <div>
          <span className="font-medium">{event.userName}</span>
          <span style={{ color: "var(--ak-text-secondary)" }}>
            {" "}
            — {event.title}
          </span>
        </div>
        <div className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
          {event.detail} · {date}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="border rounded-md p-3 hover:bg-slate-50 flex items-center gap-2 text-sm"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <Icon size={16} className="text-slate-600 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-medium">
          {badge}
        </span>
      )}
    </Link>
  );
}
