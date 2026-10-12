"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bell, ChevronRight, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ExamRow = {
  id: string;
  title: string;
  isActive: boolean;
  passingScore: number;
  course: { id: string; title: string } | null;
  questionCount: number;
  totalAttempts: number;
  completedAttempts: number;
  pendingReview: number;
  passed: number;
  passRate: number;
  avgScore: number;
  avgDurationMinutes: number;
  // Kişi bazlı (her kişi tek durumda sayılır)
  atanan: number;
  gectiKisi: number;
  kaldiKisi: number;
  devamKisi: number;
  baslamadiKisi: number;
  kapsamKisi: number;
  basariOrani: number | null;
};

type SinavKpi = {
  atanan: number;
  gecti: number;
  kaldi: number;
  devam: number;
  baslamadi: number;
  kapsam: number;
  basariOrani: number | null;
  ortPuan: number | null;
  toplamDeneme: number;
};

/** Durum renkleri — tabloda ve grafikte aynı. */
const DURUM_RENK: Record<string, string> = {
  "Geçti": "#15803d",
  "Kaldı": "#b91c1c",
  "Devam": "#b45309",
  "Başlamadı": "#94a3b8",
};

type QuestionStat = {
  id: string;
  order: number;
  question: string;
  type: string;
  points: number;
  isManualGraded: boolean;
  totalAnswers: number;
  correctCount: number | null;
  correctRate: number | null;
  difficulty: "easy" | "medium" | "hard" | "manual";
};

export function ExamsReportTab() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  // Kişi listesi penceresi: hangi sınav + hangi durum.
  const [kisiPenceresi, setKisiPenceresi] = useState<{
    examId: string;
    examTitle: string;
    durum: "GECTI" | "KALDI" | "DEVAM" | "BASLAMADI";
  } | null>(null);

  useEffect(() => {
    fetch("/api/akademi/admin/reports/exams")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div
        className="text-center py-12 text-sm border border-dashed rounded-lg"
        style={{
          borderColor: "var(--ak-border-default)",
          color: "var(--ak-text-tertiary)",
        }}
      >
        Henüz sınav yok
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ExamKpiRow
        exams={exams}
        onDurumTikla={(durum) => {
          // Tek sınav varsa doğrudan onun listesi; birden çoksa tablodaki
          // hücreden seçilmesi gerekir (hangi sınav olduğu belirsiz kalmasın).
          if (exams.length === 1) {
            setKisiPenceresi({
              examId: exams[0].id,
              examTitle: exams[0].title,
              durum,
            });
          }
        }}
        tiklanabilir={exams.length === 1}
      />

      <div
        className="rounded-lg overflow-hidden border bg-white"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        <table className="w-full text-xs">
          <thead style={{ background: "var(--ak-surface-secondary)" }}>
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                Sınav
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                Kurs
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Soru
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Atanan
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Geçti
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Kaldı
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Devam
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Başlamadı
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Başarı %
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Ort. Puan
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => (
              <tr
                key={e.id}
                className="border-t hover:bg-slate-50"
                style={{ borderColor: "var(--ak-border-divider)" }}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.title}</span>
                    {!e.isActive && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        Pasif
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className="px-4 py-2"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {e.course?.title ?? "—"}
                </td>
                <td className="px-4 py-2 text-center">{e.questionCount}</td>
                <td className="px-4 py-2 text-center font-medium">
                  {e.atanan}
                </td>
                <td className="px-4 py-2 text-center text-green-700 font-medium">
                  {e.gectiKisi > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setKisiPenceresi({
                          examId: e.id,
                          examTitle: e.title,
                          durum: "GECTI",
                        })
                      }
                      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title="Kişileri gör"
                    >
                      {e.gectiKisi}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-center text-red-700 font-medium">
                  {e.kaldiKisi > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setKisiPenceresi({
                          examId: e.id,
                          examTitle: e.title,
                          durum: "KALDI",
                        })
                      }
                      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title="Kişileri gör"
                    >
                      {e.kaldiKisi}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-center text-amber-700">
                  {e.devamKisi > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setKisiPenceresi({
                          examId: e.id,
                          examTitle: e.title,
                          durum: "DEVAM",
                        })
                      }
                      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title="Kişileri gör"
                    >
                      {e.devamKisi}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-center text-slate-500">
                  {e.baslamadiKisi > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setKisiPenceresi({
                          examId: e.id,
                          examTitle: e.title,
                          durum: "BASLAMADI",
                        })
                      }
                      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title="Kişileri gör"
                    >
                      {e.baslamadiKisi}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {e.basariOrani !== null ? `%${e.basariOrani}` : "—"}
                </td>
                <td className="px-4 py-2 text-center">
                  {e.completedAttempts > 0 ? `%${e.avgScore}` : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setSelectedExamId(e.id)}
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    Detay
                    <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {kisiPenceresi && (
        <KisiListesiDialog
          examId={kisiPenceresi.examId}
          examTitle={kisiPenceresi.examTitle}
          durum={kisiPenceresi.durum}
          onClose={() => setKisiPenceresi(null)}
        />
      )}

      {selectedExamId && (
        <QuestionDifficultyPanel
          examId={selectedExamId}
          onClose={() => setSelectedExamId(null)}
        />
      )}
    </div>
  );
}

/** Tüm sınavların kişi bazlı toplamı. Bir kişi iki sınavda da sayılabilir —
 *  kart "sınav × kişi" adedini gösterir, tekil insan sayısını değil. */
function ExamKpiRow({
  exams,
  onDurumTikla,
  tiklanabilir,
}: {
  exams: ExamRow[];
  onDurumTikla: (durum: "GECTI" | "KALDI" | "DEVAM" | "BASLAMADI") => void;
  tiklanabilir: boolean;
}) {
  const t = useMemo(
    () =>
      exams.reduce(
        (acc, e) => ({
          atanan: acc.atanan + e.atanan,
          gecti: acc.gecti + e.gectiKisi,
          kaldi: acc.kaldi + e.kaldiKisi,
          devam: acc.devam + e.devamKisi,
          baslamadi: acc.baslamadi + e.baslamadiKisi,
        }),
        { atanan: 0, gecti: 0, kaldi: 0, devam: 0, baslamadi: 0 }
      ),
    [exams]
  );
  const tamamlayan = t.gecti + t.kaldi;
  const oran = tamamlayan > 0 ? Math.round((t.gecti / tamamlayan) * 100) : null;

  const kartlar: {
    etiket: string;
    deger: string;
    renk?: string;
    durum?: "GECTI" | "KALDI" | "DEVAM" | "BASLAMADI";
  }[] = [
    { etiket: "Atanan", deger: String(t.atanan) },
    {
      etiket: "Geçti",
      deger: String(t.gecti),
      renk: DURUM_RENK["Geçti"],
      durum: "GECTI",
    },
    {
      etiket: "Kaldı",
      deger: String(t.kaldi),
      renk: DURUM_RENK["Kaldı"],
      durum: "KALDI",
    },
    {
      etiket: "Devam eden",
      deger: String(t.devam),
      renk: DURUM_RENK["Devam"],
      durum: "DEVAM",
    },
    {
      etiket: "Hiç girmedi",
      deger: String(t.baslamadi),
      renk: DURUM_RENK["Başlamadı"],
      durum: "BASLAMADI",
    },
    { etiket: "Başarı", deger: oran !== null ? `%${oran}` : "—" },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {kartlar.map((k) => {
        const acilabilir =
          tiklanabilir && !!k.durum && k.deger !== "0" && k.deger !== "—";
        return (
        <div
          key={k.etiket}
          onClick={() => acilabilir && k.durum && onDurumTikla(k.durum)}
          role={acilabilir ? "button" : undefined}
          tabIndex={acilabilir ? 0 : undefined}
          onKeyDown={(e) => {
            if (acilabilir && k.durum && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onDurumTikla(k.durum);
            }
          }}
          title={acilabilir ? "Kişileri gör" : undefined}
          className={`rounded-lg border bg-white px-4 py-3 ${
            acilabilir ? "cursor-pointer hover:bg-slate-50" : ""
          }`}
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <div
            className="text-2xl font-semibold tabular-nums"
            style={k.renk ? { color: k.renk } : undefined}
          >
            {k.deger}
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            {k.etiket}
          </div>
        </div>
        );
      })}
    </div>
  );
}

const DIFFICULTY_LABELS: Record<QuestionStat["difficulty"], string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
  manual: "Manuel",
};
const DIFFICULTY_COLORS: Record<QuestionStat["difficulty"], string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-red-100 text-red-800",
  manual: "bg-slate-100 text-slate-600",
};

function QuestionDifficultyPanel({
  examId,
  onClose,
}: {
  examId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    exam: { id: string; title: string };
    kpi?: SinavKpi;
    durumDagilimi?: { durum: string; adet: number }[];
    puanDagilimi?: { aralik: string; adet: number }[];
    questions: QuestionStat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/akademi/admin/reports/exams?examId=${examId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [examId]);

  return (
    <div
      className="border rounded-lg p-4 bg-white"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold inline-flex items-center gap-2">
          <BarChart3 size={16} className="text-slate-400" />
          {data?.exam.title ?? <span className="text-slate-400">—</span>}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100"
          title="Kapat"
        >
          <X size={16} />
        </button>
      </div>
      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Yükleniyor...
        </div>
      )}
      {!loading && data?.durumDagilimi && data.puanDagilimi && (
        <div className="grid gap-4 lg:grid-cols-2 mb-4">
          <div>
            <div
              className="text-xs font-semibold uppercase mb-1"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Kişi durumu
            </div>
            <div
              className="rounded-md border p-2"
              style={{ borderColor: "var(--ak-border-default)" }}
            >
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={data.durumDagilimi}
                  margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="durum" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip formatter={(v: number) => [`${v} kişi`, "Adet"]} />
                  <Bar dataKey="adet" radius={[2, 2, 0, 0]}>
                    {data.durumDagilimi.map((x) => (
                      <Cell
                        key={x.durum}
                        fill={DURUM_RENK[x.durum] ?? "#64748b"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div
              className="text-xs font-semibold uppercase mb-1"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Puan dağılımı (tamamlanan denemeler)
            </div>
            <div
              className="rounded-md border p-2"
              style={{ borderColor: "var(--ak-border-default)" }}
            >
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={data.puanDagilimi}
                  margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="aralik" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip formatter={(v: number) => [`${v} deneme`, "Adet"]} />
                  <Bar dataKey="adet" fill="#0d9488" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {!loading && data && (
        <>
        <div
          className="text-xs font-semibold uppercase mb-1"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Soru zorluk analizi
        </div>
        <table className="w-full text-xs">
          <thead style={{ background: "var(--ak-surface-secondary)" }}>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                #
              </th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                Soru
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold uppercase">
                Cevap
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold uppercase">
                Doğru %
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold uppercase">
                Zorluk
              </th>
            </tr>
          </thead>
          <tbody>
            {data.questions.map((q) => (
              <tr
                key={q.id}
                className="border-t"
                style={{ borderColor: "var(--ak-border-divider)" }}
              >
                <td className="px-3 py-2 font-mono text-xs">#{q.order}</td>
                <td
                  className="px-3 py-2"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {q.question.slice(0, 100)}
                  {q.question.length > 100 ? "..." : ""}
                </td>
                <td className="px-3 py-2 text-center">{q.totalAnswers}</td>
                <td className="px-3 py-2 text-center">
                  {q.correctRate !== null ? `%${q.correctRate}` : "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      DIFFICULTY_COLORS[q.difficulty]
                    }`}
                  >
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </>
      )}
    </div>
  );
}

type KisiSatir = {
  userId: string;
  ad: string;
  email: string | null;
  sicilNo: string | null;
  bolum: string | null;
  durum: "GECTI" | "KALDI" | "DEVAM" | "BASLAMADI";
  puan: number | null;
};

const DURUM_BASLIK: Record<KisiSatir["durum"], string> = {
  GECTI: "Geçenler",
  KALDI: "Kalanlar",
  DEVAM: "Devam edenler",
  BASLAMADI: "Hiç girmeyenler",
};

/** KPI kartına / hücreye tıklayınca açılan kişi listesi penceresi. */
function KisiListesiDialog({
  examId,
  examTitle,
  durum,
  onClose,
}: {
  examId: string;
  examTitle: string;
  durum: KisiSatir["durum"];
  onClose: () => void;
}) {
  const [kisiler, setKisiler] = useState<KisiSatir[] | null>(null);
  const [hatirlatiliyor, setHatirlatiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<string | null>(null);

  useEffect(() => {
    setKisiler(null);
    fetch(
      `/api/akademi/admin/reports/exams/${examId}/kisiler?durum=${durum}`
    )
      .then((r) => r.json())
      .then((d) => setKisiler(d.kisiler ?? []))
      .catch(() => setKisiler([]));
  }, [examId, durum]);

  const hatirlat = async () => {
    setHatirlatiliyor(true);
    setSonuc(null);
    try {
      const r = await fetch(
        `/api/akademi/admin/reports/exams/${examId}/hatirlat`,
        { method: "POST" }
      );
      const d = await r.json();
      setSonuc(r.ok ? (d.mesaj ?? "Gönderildi.") : (d.error ?? "Gönderilemedi."));
    } catch {
      setSonuc("Gönderilemedi.");
    } finally {
      setHatirlatiliyor(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold">{DURUM_BASLIK[durum]}</h3>
            <p className="text-xs mt-0.5 text-slate-500">{examTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100"
            title="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {kisiler === null && (
            <div className="text-sm text-slate-500">Yükleniyor...</div>
          )}
          {kisiler?.length === 0 && (
            <div className="text-sm text-slate-500 py-6 text-center">
              Bu durumda kimse yok.
            </div>
          )}
          {kisiler && kisiler.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1.5 font-semibold uppercase">Ad Soyad</th>
                  <th className="py-1.5 font-semibold uppercase">Sicil</th>
                  <th className="py-1.5 font-semibold uppercase">Bölüm</th>
                  {durum !== "BASLAMADI" && (
                    <th className="py-1.5 font-semibold uppercase text-center">
                      Puan
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {kisiler.map((k) => (
                  <tr key={k.userId} className="border-t border-slate-100">
                    <td className="py-1.5">{k.ad}</td>
                    <td className="py-1.5 text-slate-500">
                      {k.sicilNo ?? "—"}
                    </td>
                    <td className="py-1.5 text-slate-500">{k.bolum ?? "—"}</td>
                    {durum !== "BASLAMADI" && (
                      <td className="py-1.5 text-center">
                        {k.puan !== null ? `%${Math.round(k.puan)}` : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500">
            {kisiler?.length ?? 0} kişi
          </span>
          {sonuc && (
            <span className="text-xs text-slate-700">{sonuc}</span>
          )}
          <span className="flex-1" />
          {durum === "BASLAMADI" && (kisiler?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={hatirlat}
              disabled={hatirlatiliyor}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "#0d9488" }}
              title="Hub bildirimi ve telefon bildirimi gönderir — mail gönderilmez"
            >
              <Bell size={13} />
              {hatirlatiliyor ? "Gönderiliyor..." : "Hatırlatma gönder"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
