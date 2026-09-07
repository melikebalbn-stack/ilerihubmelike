"use client";

// IFS Sınavlar — İSKELET.
//
// DURUM: IFS'te bugün sınav YOK — `exams` tablosunda IFS kursuna bağlı kayıt 0
// (tek kayıt IFS-dışı BGYS kursuna ait). Bu ekran o boşluğu görünür kılar ve
// sınav tanımlama akışına kapı açar; kendi başına sınav oluşturmaz.
//
// UÇ KARARI: yeni uç YAZILMADI, mevcut ikisi yetiyor —
//   · /api/akademi/admin/courses?type=ifs   → IFS alanları (isIfs filtresi zaten var)
//   · /api/akademi/admin/exams?courseId=..  → o alana bağlı sınavlar (courseId filtresi zaten var)
// İkisi de `akademi.kurs.edit` istiyor.
//
// AÇIK KARAR (kod yazmadan önce netleşmeli): sınav sonucu
// `ifs_course_evaluations.seviye` ile nasıl ilişkilenecek? Bugün ders seviyesini
// eğitmen elle giriyor. Sınav geldiğinde ya seviyeyi otomatik belirleyecek ya da
// eğitmen/key user'ın yanında ÜÇÜNCÜ bir kanaat olarak duracak.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface IfsKurs {
  id: string;
  title: string;
}
interface SinavRow {
  id: string;
  title: string;
  passingScore: number;
  isActive: boolean;
  _count?: { questions: number; attempts: number };
}

export default function IfsSinavlarPage() {
  const router = useRouter();
  const [kurslar, setKurslar] = useState<IfsKurs[]>([]);
  const [courseId, setCourseId] = useState("");
  const [sinavlar, setSinavlar] = useState<SinavRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // page=1 ZORUNLU: uç `page` yoksa legacy dala düşüp type/status/pageSize'ı
    // TAMAMEN yok sayıyor ve TÜM aktif kursları döndürüyor (ölçüldü: type=ifs
    // ile 25 kayıt geliyordu — 24 IFS + 1 IFS-dışı BGYS kursu). `page` ile
    // paginated dal çalışır, süzgeçler uygulanır, yanıt anahtarı `items` olur.
    // Eski `limit=200` şemada olmayan bir parametreydi, zod sessizce atıyordu.
    fetch("/api/akademi/admin/courses?page=1&pageSize=100&type=ifs&status=all")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: IfsKurs[] = d?.courses ?? d?.items ?? [];
        setKurslar(list);
        if (list.length) setCourseId(list[0].id);
      })
      .catch(() => setKurslar([]));
  }, []);

  const load = useCallback(() => {
    if (!courseId) return;
    setLoading(true);
    fetch(`/api/akademi/admin/exams?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSinavlar(d?.exams ?? []))
      .catch(() => setSinavlar([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectCls = "px-3 py-2 text-sm rounded-md border bg-white min-w-[260px]";

  return (
    <div className="ak-animate-in space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">IFS Sınavları</h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Eğitim alanına bağlı sınavlar.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="text-xs font-medium block"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            IFS Eğitim Alanı
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {kurslar.length === 0 && <option value="">IFS alanı yok</option>}
            {kurslar.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={!courseId}
          onClick={() => router.push(`/akademi/admin/exams/new?courseId=${encodeURIComponent(courseId)}`)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md font-medium text-white disabled:opacity-50"
          style={{ background: "#1B4F72" }}
        >
          <Plus size={14} />
          Sınav Oluştur
        </button>
      </div>

      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Yükleniyor…
        </div>
      )}

      {!loading && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ak-surface-secondary)" }}>
                <th className="px-3 py-2 text-left font-medium">Sınav</th>
                <th className="px-3 py-2 text-right font-medium">Soru</th>
                <th className="px-3 py-2 text-right font-medium">Deneme</th>
                <th className="px-3 py-2 text-right font-medium">Geçme Notu</th>
                <th className="px-3 py-2 text-left font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {sinavlar.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    Bu alan için henüz sınav tanımlanmamış.
                  </td>
                </tr>
              )}
              {sinavlar.map((s) => (
                <tr
                  key={s.id}
                  className="border-t cursor-pointer"
                  style={{ borderColor: "var(--ak-border-default)" }}
                  onClick={() => router.push(`/akademi/admin/exams/${s.id}`)}
                >
                  <td className="px-3 py-2 font-medium">{s.title}</td>
                  <td className="px-3 py-2 text-right">{s._count?.questions ?? 0}</td>
                  <td className="px-3 py-2 text-right">{s._count?.attempts ?? 0}</td>
                  <td className="px-3 py-2 text-right">%{s.passingScore}</td>
                  <td className="px-3 py-2">{s.isActive ? "Aktif" : "Pasif"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
