"use client";

// IFS Değerlendirme Raporu — bölüm + kişi bazında grafik.
// METRİK: görev tamamlanma = ornekStatus===BASARILI (eğitmen onayı), ders
// tamamlanma = seviye===BASARILI. Matris self-mark'ı (completionPct) KULLANILMAZ.

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ILERI = "#1B4F72";
const COLOR = {
  BASARILI: "#16a34a",
  EGITIM_GEREKLI: "#d97706",
  TEKRAR_GEREKLI: "#d97706",
  BASARISIZ: "#dc2626",
  PENDING: "#9ca3af",
  DEGERLENDIRILMEDI: "#9ca3af",
} as const;
const SEVIYE_LABEL: Record<string, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitime İhtiyacı Var",
  BASARISIZ: "Başarısız",
  DEGERLENDIRILMEDI: "Değerlendirilmedi",
};

interface CourseOpt {
  id: string;
  title: string;
  isIfs: boolean;
}
type SeviyeDist = {
  BASARILI: number;
  EGITIM_GEREKLI: number;
  BASARISIZ: number;
  DEGERLENDIRILMEDI: number;
};
type StatusDist = { BASARILI: number; TEKRAR_GEREKLI: number; PENDING: number };
interface BolumRow {
  bolum: string;
  userCount: number;
  seviyeDist: SeviyeDist;
  ornekStatusDist: StatusDist;
  avgPct: number;
}
interface KisiRow {
  userId: string;
  ad: string;
  basariliGorev: number;
  gorevCount: number;
  pct: number;
  seviye: string | null;
  not: string | null;
}
interface BolumData {
  mode: "bolum";
  courseTitle: string;
  gorevCount: number;
  bolums: BolumRow[];
  totals: {
    userCount: number;
    seviyeDist: SeviyeDist;
    ornekStatusDist: StatusDist;
    avgPct: number;
  };
}
interface KisiData {
  mode: "kisi";
  bolum: string;
  courseTitle: string;
  gorevCount: number;
  users: KisiRow[];
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ak-card-static p-4">
      <div className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1" style={{ color: ILERI }}>
        {value}
      </div>
    </div>
  );
}

function SeviyeBadge({ seviye }: { seviye: string | null }) {
  if (!seviye)
    return (
      <Badge variant="secondary">{SEVIYE_LABEL.DEGERLENDIRILMEDI}</Badge>
    );
  const variant =
    seviye === "BASARILI"
      ? "default"
      : seviye === "BASARISIZ"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{SEVIYE_LABEL[seviye] ?? seviye}</Badge>;
}

export function IfsEvaluationReportTab() {
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [bolums, setBolums] = useState<string[]>([]);
  const [courseId, setCourseId] = useState("");
  const [bolum, setBolum] = useState<string>(""); // "" = bölüm bazında
  const [data, setData] = useState<BolumData | KisiData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/akademi/admin/courses?includeInactive=true")
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => {
        const ifs: CourseOpt[] = (d.courses ?? []).filter(
          (c: CourseOpt) => c.isIfs
        );
        setCourses(ifs);
        if (ifs.length) setCourseId(ifs[0].id);
      })
      .catch(() => setCourses([]));
    fetch("/api/akademi/admin/reports/department-board")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setBolums(m?.bolums ?? []))
      .catch(() => setBolums([]));
  }, []);

  const load = useCallback(() => {
    if (!courseId) return;
    setLoading(true);
    const qs = new URLSearchParams({ courseId });
    if (bolum) qs.set("bolum", bolum);
    fetch(`/api/akademi/admin/reports/ifs-aggregate?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [courseId, bolum]);

  useEffect(() => {
    load();
  }, [load]);

  const filters = (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      <div className="space-y-1">
        <label
          className="text-xs font-medium block"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          IFS Eğitim Alanı
        </label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Kurs seçin" />
          </SelectTrigger>
          <SelectContent>
            {courses.length === 0 && (
              <SelectItem value="__none" disabled>
                IFS kursu yok
              </SelectItem>
            )}
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label
          className="text-xs font-medium block"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Bölüm (ops.)
        </label>
        <Select
          value={bolum || "__all"}
          onValueChange={(v) => setBolum(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Tüm Bölümler</SelectItem>
            {bolums.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="ak-animate-in">
      {filters}

      {loading ? (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      ) : !data ? (
        <Empty />
      ) : data.mode === "bolum" ? (
        <BolumView data={data} onDrill={(b) => setBolum(b)} />
      ) : (
        <KisiView data={data} onBack={() => setBolum("")} />
      )}
    </div>
  );
}

function Empty() {
  return (
    <div
      className="text-center py-12 text-sm border border-dashed rounded-lg"
      style={{
        borderColor: "var(--ak-border-default)",
        color: "var(--ak-text-tertiary)",
      }}
    >
      Henüz değerlendirme yok.
    </div>
  );
}

function BolumView({
  data,
  onDrill,
}: {
  data: BolumData;
  onDrill: (b: string) => void;
}) {
  const t = data.totals;
  if (data.bolums.length === 0) return <Empty />;

  const barData = data.bolums.map((b) => ({
    bolum: b.bolum,
    Başarılı: b.seviyeDist.BASARILI,
    "Eğitime İhtiyacı Var": b.seviyeDist.EGITIM_GEREKLI,
    Başarısız: b.seviyeDist.BASARISIZ,
    Değerlendirilmedi: b.seviyeDist.DEGERLENDIRILMEDI,
  }));
  const pieData = (
    ["BASARILI", "EGITIM_GEREKLI", "BASARISIZ", "DEGERLENDIRILMEDI"] as const
  )
    .map((k) => ({ name: SEVIYE_LABEL[k], key: k, value: t.seviyeDist[k] }))
    .filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Toplam personel" value={t.userCount} />
        <Card
          label="Değerlendirilen"
          value={
            t.seviyeDist.BASARILI +
            t.seviyeDist.EGITIM_GEREKLI +
            t.seviyeDist.BASARISIZ
          }
        />
        <Card label="Ortalama Başarılı %" value={`%${t.avgPct}`} />
        <Card label="Tamamlayan (Başarılı)" value={t.seviyeDist.BASARILI} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="ak-card-static p-4 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">
            Bölüm bazında seviye dağılımı{" "}
            <span
              className="text-xs font-normal"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              (bara tıkla → kişi detayı)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={barData}
              onClick={(e: { activeLabel?: string }) =>
                e?.activeLabel && onDrill(e.activeLabel)
              }
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bolum" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Başarılı" stackId="a" fill={COLOR.BASARILI} cursor="pointer" />
              <Bar dataKey="Eğitime İhtiyacı Var" stackId="a" fill={COLOR.EGITIM_GEREKLI} cursor="pointer" />
              <Bar dataKey="Başarısız" stackId="a" fill={COLOR.BASARISIZ} cursor="pointer" />
              <Bar dataKey="Değerlendirilmedi" stackId="a" fill={COLOR.DEGERLENDIRILMEDI} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ak-card-static p-4">
          <div className="text-sm font-semibold mb-3">Genel seviye dağılımı</div>
          {pieData.length === 0 ? (
            <div className="text-sm text-center py-12" style={{ color: "var(--ak-text-tertiary)" }}>
              Veri yok
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={COLOR[d.key]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function KisiView({
  data,
  onBack,
}: {
  data: KisiData;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Tüm bölümler
        </button>
        <span className="text-sm font-semibold">
          {data.bolum} · {data.courseTitle} ({data.gorevCount} görev)
        </span>
      </div>

      {data.users.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="ak-card-static p-4">
            <div className="text-sm font-semibold mb-3">
              Kişi bazında Başarılı oranı (%)
            </div>
            <ResponsiveContainer width="100%" height={Math.max(220, data.users.length * 28)}>
              <BarChart data={data.users} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="ad" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `%${v}`} />
                <Bar dataKey="pct" fill={ILERI} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="ak-card-static overflow-hidden" style={{ padding: 0 }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--ak-surface-2)" }}>
                <tr className="text-xs uppercase tracking-wide" style={{ color: "var(--ak-text-tertiary)" }}>
                  <th className="text-left px-4 py-3">Kişi</th>
                  <th className="text-left px-4 py-3">Başarılı / Toplam</th>
                  <th className="text-left px-4 py-3">%</th>
                  <th className="text-left px-4 py-3">Ders Seviyesi</th>
                  <th className="text-left px-4 py-3">Not</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr
                    key={u.userId}
                    className="border-t"
                    style={{ borderColor: "var(--ak-border-divider)" }}
                  >
                    <td className="px-4 py-3 font-medium">{u.ad}</td>
                    <td className="px-4 py-3">
                      {u.basariliGorev} / {u.gorevCount}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: ILERI }}>
                      %{u.pct}
                    </td>
                    <td className="px-4 py-3">
                      <SeviyeBadge seviye={u.seviye} />
                    </td>
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: "var(--ak-text-secondary)" }}
                    >
                      {u.not || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
