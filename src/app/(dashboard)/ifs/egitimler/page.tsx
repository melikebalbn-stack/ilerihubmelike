"use client";

// IFS EĞİTİMLER — departman → KİŞİ listesi.
//
// Departman satırına tıklanınca ALANLAR değil KİŞİLER açılır (alan kırılımı
// kişinin açılır panelinde duruyor). Kişiye tıklanınca o kişinin görevleri
// (eğitim istenenler önde) + key user değerlendirme formu açılır.
//
// Uçlar: ifs-egitim-yapisi (departman listesi)
//        ifs-paket-kisiler?packageId=   (kişi satırları)
//        ifs-kisi-gorevler?userId=&packageId=  (görev dökümü)
//        ifs-keyuser-degerlendirme (PATCH — yalnız keyUserYetkim true iken)

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Seviye = "BASARILI" | "EGITIM_GEREKLI" | "BASARISIZ";

const SEVIYE_LABEL: Record<Seviye, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitim gerekli",
  BASARISIZ: "Başarısız",
};
// Üç seviye + boş. Uzatma yok.
const SEVIYE_STIL: Record<Seviye, React.CSSProperties> = {
  BASARILI: { background: "rgba(16,185,129,0.15)", color: "rgb(6,120,90)" },
  EGITIM_GEREKLI: { background: "rgba(245,158,11,0.15)", color: "rgb(180,120,10)" },
  BASARISIZ: { background: "rgba(239,68,68,0.15)", color: "rgb(180,40,40)" },
};
const AMBER = "rgb(180,120,10)";

interface Kanaat {
  seviye: Seviye | null;
  not: string | null;
  girenAd: string | null;
  girenAt: string | null;
}
interface KursSatir {
  courseId: string;
  egitimAdi: string;
  toplamGorev: number;
  tamamlananGorev: number;
  ilerlemePct: number;
  egitimIstenenSayisi: number;
  egitmen: Kanaat;
  keyUser: Kanaat;
  ayrisiyor: boolean;
}
interface KisiSatir {
  userId: string;
  ad: string;
  bolum: string | null;
  atamaVar: boolean;
  toplamGorev: number;
  tamamlananGorev: number;
  ilerlemePct: number;
  egitimIstenenSayisi: number;
  degerlendirilenKursSayisi: number;
  kursSayisi: number;
  egitmen: Kanaat;
  keyUser: Kanaat;
  ayrisiyor: boolean;
  keyUserYetkim: boolean;
  kurslar: KursSatir[];
}
interface KisilerVeri {
  packageId: string;
  ad: string;
  satirlar: KisiSatir[];
}
interface Gorev {
  contentId: string;
  courseId: string;
  egitimAdi: string;
  konu: string;
  modul: string | null;
  ifsEkran: string | null;
  kursiyerDurum: string;
  ornekStatus: string;
  ornekAciklama: string | null;
  degerlendirildiAt: string | null;
  degerlendirenAd: string | null;
}
interface GorevlerVeri {
  ad: string;
  gorevler: Gorev[];
}
interface Departman {
  packageId: string;
  ad: string;
  alanSayisi: number;
  gorevSayisi: number;
  atanmisKisi: number;
  ilerlemePct: number;
  egitimTalebi: number;
  degerlendirilmisSatir: number;
  kayitSayisi: number;
  pasif: boolean;
}
interface Yapi {
  /** Sunucuda hesaplanır: "tumu" (yönetici) | "kendi-bolumum" (key user). */
  kapsam?: "tumu" | "kendi-bolumum";
  ozet: { departmanSayisi: number; alanSayisi: number; gorevSayisi: number };
  departmanlar: Departman[];
}

type Filtre = "tumu" | "atanmamis" | "pasif";

const fmtTarih = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("tr-TR") : null;

/** Seviye rozeti + altında giren adı/tarihi. */
function KanaatHucre({
  k,
  bosMetin = "—",
  onDegerlendir,
}: {
  k: Kanaat;
  bosMetin?: string;
  onDegerlendir?: () => void;
}) {
  if (!k.seviye && !k.girenAd) {
    if (onDegerlendir) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDegerlendir();
          }}
          className="text-xs underline underline-offset-2"
          style={{ color: "#1B4F72" }}
        >
          Değerlendir
        </button>
      );
    }
    return (
      <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
        {bosMetin}
      </span>
    );
  }
  return (
    <div className="space-y-0.5">
      {k.seviye && (
        <span
          className="inline-block text-[11px] px-1.5 py-0.5 rounded"
          style={SEVIYE_STIL[k.seviye]}
          title={k.not ?? undefined}
        >
          {SEVIYE_LABEL[k.seviye]}
        </span>
      )}
      {(k.girenAd || k.girenAt) && (
        <div className="text-[11px]" style={{ color: "var(--ak-text-tertiary)" }}>
          {[k.girenAd, fmtTarih(k.girenAt)].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function IlerlemeCubuk({ pct }: { pct: number }) {
  return (
    <div className="space-y-1 min-w-[110px]">
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--ak-surface-secondary)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "#1B4F72" }}
        />
      </div>
      <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
        %{pct}
      </div>
    </div>
  );
}

export default function IfsEgitimlerPage() {
  const router = useRouter();
  const [veri, setVeri] = useState<Yapi | null>(null);
  const [loading, setLoading] = useState(true);
  const [acikDept, setAcikDept] = useState<string | null>(null);
  const [kisiler, setKisiler] = useState<Record<string, KisilerVeri | "yukleniyor">>({});
  const [acikKisi, setAcikKisi] = useState<string | null>(null);
  const [gorevler, setGorevler] = useState<Record<string, GorevlerVeri | "yukleniyor">>({});
  const [taslak, setTaslak] = useState<Record<string, { seviye: Seviye | ""; not: string }>>({});
  const [kaydediliyor, setKaydediliyor] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tumu");

  useEffect(() => {
    fetch("/api/akademi/admin/reports/ifs-egitim-yapisi")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Yapi | null) => setVeri(d))
      .catch(() => setVeri(null))
      .finally(() => setLoading(false));
  }, []);

  const deptAc = useCallback(
    (packageId: string) => {
      if (acikDept === packageId) {
        setAcikDept(null);
        return;
      }
      setAcikDept(packageId);
      setAcikKisi(null);
      if (kisiler[packageId]) return;
      setKisiler((p) => ({ ...p, [packageId]: "yukleniyor" }));
      fetch(
        `/api/akademi/admin/reports/ifs-paket-kisiler?packageId=${encodeURIComponent(packageId)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d: KisilerVeri | null) =>
          setKisiler((p) => ({
            ...p,
            [packageId]: d ?? { packageId, ad: "", satirlar: [] },
          }))
        )
        .catch(() =>
          setKisiler((p) => ({
            ...p,
            [packageId]: { packageId, ad: "", satirlar: [] },
          }))
        );
    },
    [acikDept, kisiler]
  );

  const kisiAc = useCallback(
    (packageId: string, userId: string) => {
      const k = `${packageId}|${userId}`;
      if (acikKisi === k) {
        setAcikKisi(null);
        return;
      }
      setAcikKisi(k);
      if (gorevler[k]) return;
      setGorevler((p) => ({ ...p, [k]: "yukleniyor" }));
      fetch(
        `/api/akademi/admin/reports/ifs-kisi-gorevler?userId=${encodeURIComponent(
          userId
        )}&packageId=${encodeURIComponent(packageId)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d: GorevlerVeri | null) =>
          setGorevler((p) => ({ ...p, [k]: d ?? { ad: "", gorevler: [] } }))
        )
        .catch(() =>
          setGorevler((p) => ({ ...p, [k]: { ad: "", gorevler: [] } }))
        );
    },
    [acikKisi, gorevler]
  );

  const kaydet = useCallback(
    async (packageId: string, s: KisiSatir, courseId: string) => {
      const tk = `${s.userId}|${courseId}`;
      const t = taslak[tk] ?? { seviye: "", not: "" };
      setKaydediliyor(tk);
      try {
        const res = await fetch(
          "/api/akademi/admin/reports/ifs-keyuser-degerlendirme",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: s.userId,
              courseId,
              keyUserSeviye: t.seviye === "" ? null : t.seviye,
              keyUserNot: t.not.trim() || null,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          toast.error(err?.error || "Kaydedilemedi");
          return;
        }
        toast.success("Key user değerlendirmesi kaydedildi");
        // Sunucudan taze oku — keyUserAt/giren ad sunucuda doluyor.
        setKisiler((p) => {
          const n = { ...p };
          delete n[packageId];
          return n;
        });
        setAcikKisi(null);
        setAcikDept(null);
        setTaslak((p) => {
          const n = { ...p };
          delete n[tk];
          return n;
        });
      } finally {
        setKaydediliyor(null);
      }
    },
    [taslak]
  );

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return (veri?.departmanlar ?? []).filter((d) => {
      if (filtre === "atanmamis" && d.atanmisKisi > 0) return false;
      if (filtre === "pasif" && !d.pasif) return false;
      if (!q) return true;
      return d.ad.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [veri, arama, filtre]);

  const inputCls = "px-3 py-2 text-sm rounded-md border bg-white";

  return (
    <div className="ak-animate-in space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">IFS Eğitimleri</h1>
          <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
            {veri
              ? `${veri.ozet.departmanSayisi} departman · ${veri.ozet.alanSayisi} alan · ${veri.ozet.gorevSayisi} görev`
              : "—"}
            {/* Key user'da sayılar kendi bölümüne göre hesaplanır; aynı ekranı
                yönetici farklı sayılarla görür. Kapsam "tumu" ise hiçbir şey
                yazılmaz. */}
            {veri?.kapsam === "kendi-bolumum" && (
              <span style={{ color: "var(--ak-text-tertiary)" }}>
                {" · "}Yalnız kendi bölümünüz
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/akademi/admin/packages")}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md font-medium text-white"
          style={{ background: "#1B4F72" }}
        >
          <Plus size={14} />
          Yeni departman
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ak-text-tertiary)" }}
          />
          <input
            className={`${inputCls} pl-9 min-w-[240px]`}
            style={{ borderColor: "var(--ak-border-default)" }}
            placeholder="Departman ara"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(
            [
              ["tumu", "Tümü"],
              ["atanmamis", "Atanmamış"],
              ["pasif", "Pasif"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltre(id)}
              className="px-3 py-1.5 text-xs rounded-md border"
              style={
                filtre === id
                  ? { background: "var(--ak-surface-secondary)", borderColor: "var(--ak-border-default)" }
                  : { borderColor: "transparent", color: "var(--ak-text-secondary)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ak-surface-secondary)" }}>
                  <th className="px-2 py-2 w-8" />
                  <th className="px-3 py-2 text-left font-medium">Departman</th>
                  <th className="px-3 py-2 text-right font-medium">Alan</th>
                  <th className="px-3 py-2 text-right font-medium">Görev</th>
                  <th className="px-3 py-2 text-left font-medium">İlerleme</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {gorunen.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-sm"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {arama || filtre !== "tumu"
                        ? "Eşleşen departman yok."
                        : "Henüz IFS departmanı yok."}
                    </td>
                  </tr>
                )}
                {gorunen.map((d) => {
                  const open = acikDept === d.packageId;
                  const kv = kisiler[d.packageId];
                  return (
                    <Fragment key={d.packageId}>
                      <tr
                        className="border-t cursor-pointer"
                        style={{ borderColor: "var(--ak-border-default)" }}
                        onClick={() => deptAc(d.packageId)}
                      >
                        <td className="px-2 py-2 align-top">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium flex items-center gap-2">
                            {d.ad}
                            {d.pasif && (
                              <span
                                className="text-[11px] px-1.5 py-0.5 rounded"
                                style={{
                                  background: "var(--ak-surface-secondary)",
                                  color: "var(--ak-text-tertiary)",
                                }}
                              >
                                Pasif
                              </span>
                            )}
                          </div>
                          <div
                            className="text-xs"
                            style={{
                              color: d.atanmisKisi === 0 ? AMBER : "var(--ak-text-tertiary)",
                            }}
                          >
                            {d.atanmisKisi === 0
                              ? "Kimse atanmamış"
                              : `${d.atanmisKisi} kişi atanmış`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-top">{d.alanSayisi}</td>
                        <td className="px-3 py-2 text-right align-top">{d.gorevSayisi}</td>
                        <td className="px-3 py-2 align-top">
                          {d.kayitSayisi === 0 ? (
                            <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
                              —
                            </span>
                          ) : d.degerlendirilmisSatir === 0 ? (
                            <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
                              Değerlendirilmedi
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <IlerlemeCubuk pct={d.ilerlemePct} />
                              {d.egitimTalebi > 0 && (
                                <div className="text-[11px]" style={{ color: AMBER }}>
                                  {d.egitimTalebi} eğitim talebi
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <button
                            type="button"
                            title="Departmanı düzenle"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              router.push(`/ifs/egitimler/${d.packageId}`);
                            }}
                            className="p-1 rounded"
                            style={{ color: "var(--ak-text-secondary)" }}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>

                      {open && (
                        <tr style={{ background: "var(--ak-surface-secondary)" }}>
                          <td />
                          <td colSpan={5} className="px-3 py-3">
                            {kv === "yukleniyor" && (
                              <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
                                Yükleniyor…
                              </div>
                            )}
                            {kv && kv !== "yukleniyor" && (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ color: "var(--ak-text-secondary)" }}>
                                    <th className="px-2 py-1 text-left font-medium">Kişi</th>
                                    <th className="px-2 py-1 text-right font-medium">Görev</th>
                                    <th className="px-2 py-1 text-left font-medium">İlerleme</th>
                                    <th className="px-2 py-1 text-left font-medium">Eğitmen</th>
                                    <th className="px-2 py-1 text-left font-medium">Key user</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {kv.satirlar.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="px-2 py-3 text-center"
                                          style={{ color: "var(--ak-text-tertiary)" }}>
                                        Bu departmanda kişi kaydı yok.
                                      </td>
                                    </tr>
                                  )}
                                  {kv.satirlar.map((s) => {
                                    const kk = `${d.packageId}|${s.userId}`;
                                    const acik = acikKisi === kk;
                                    const gv = gorevler[kk];
                                    return (
                                      <Fragment key={s.userId}>
                                        <tr
                                          className="border-t cursor-pointer"
                                          style={{
                                            borderColor: "var(--ak-border-default)",
                                            borderLeft: s.ayrisiyor
                                              ? `3px solid ${AMBER}`
                                              : "3px solid transparent",
                                          }}
                                          onClick={() => kisiAc(d.packageId, s.userId)}
                                        >
                                          <td className="px-2 py-1.5 align-top">
                                            <div className="font-medium">{s.ad}</div>
                                            <div style={{ color: "var(--ak-text-tertiary)" }}>
                                              {s.bolum ?? "—"}
                                            </div>
                                            {!s.atamaVar && (
                                              <div style={{ color: AMBER }}>Atama kaydı yok</div>
                                            )}
                                            {s.ayrisiyor && (
                                              <div style={{ color: AMBER }}>
                                                Değerlendirmeler ayrışıyor
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-2 py-1.5 text-right align-top">
                                            {s.tamamlananGorev}/{s.toplamGorev}
                                          </td>
                                          <td className="px-2 py-1.5 align-top">
                                            <IlerlemeCubuk pct={s.ilerlemePct} />
                                          </td>
                                          <td className="px-2 py-1.5 align-top">
                                            <KanaatHucre k={s.egitmen} />
                                          </td>
                                          <td className="px-2 py-1.5 align-top">
                                            <KanaatHucre
                                              k={s.keyUser}
                                              onDegerlendir={
                                                s.keyUserYetkim
                                                  ? () => kisiAc(d.packageId, s.userId)
                                                  : undefined
                                              }
                                            />
                                          </td>
                                        </tr>

                                        {acik && (
                                          <tr style={{ background: "var(--ak-surface-primary)" }}>
                                            <td colSpan={5} className="px-2 py-3">
                                              {gv === "yukleniyor" && (
                                                <div style={{ color: "var(--ak-text-secondary)" }}>
                                                  Yükleniyor…
                                                </div>
                                              )}
                                              {gv && gv !== "yukleniyor" && (
                                                <div className="space-y-3">
                                                  {/* Görev dökümü — eğitim istenenler uçtan önde geliyor */}
                                                  <div className="space-y-1">
                                                    {gv.gorevler.length === 0 && (
                                                      <div style={{ color: "var(--ak-text-tertiary)" }}>
                                                        Kayıtlı görev yok.
                                                      </div>
                                                    )}
                                                    {gv.gorevler.slice(0, 20).map((g) => {
                                                      const talep = g.kursiyerDurum === "EGITIM_GEREKLI";
                                                      return (
                                                        <div
                                                          key={g.contentId}
                                                          className="pl-2 py-0.5"
                                                          style={{
                                                            borderLeft: `2px solid ${
                                                              talep ? AMBER : "var(--ak-border-default)"
                                                            }`,
                                                          }}
                                                        >
                                                          <div className="font-medium">
                                                            {g.konu}
                                                            {talep && (
                                                              <span style={{ color: AMBER }}>
                                                                {" "}· eğitim istendi
                                                              </span>
                                                            )}
                                                          </div>
                                                          <div style={{ color: "var(--ak-text-tertiary)" }}>
                                                            {[g.egitimAdi, g.modul, g.ifsEkran]
                                                              .filter(Boolean)
                                                              .join(" / ")}
                                                          </div>
                                                          {g.ornekAciklama && (
                                                            <div
                                                              className="whitespace-pre-wrap break-words"
                                                              style={{ color: "var(--ak-text-secondary)" }}
                                                            >
                                                              {g.ornekAciklama}
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                    {gv.gorevler.length > 20 && (
                                                      <div style={{ color: "var(--ak-text-tertiary)" }}>
                                                        … {gv.gorevler.length - 20} görev daha
                                                      </div>
                                                    )}
                                                  </div>

                                                  {/* Key user formu — yalnız yetkiliye */}
                                                  {s.keyUserYetkim && (
                                                    <div
                                                      className="pt-2 border-t space-y-2"
                                                      style={{ borderColor: "var(--ak-border-default)" }}
                                                    >
                                                      <div className="font-medium">
                                                        Key user değerlendirmesi
                                                      </div>
                                                      {s.kurslar.map((c) => {
                                                        const tk = `${s.userId}|${c.courseId}`;
                                                        const t =
                                                          taslak[tk] ?? {
                                                            seviye: (c.keyUser.seviye ?? "") as Seviye | "",
                                                            not: c.keyUser.not ?? "",
                                                          };
                                                        return (
                                                          <div
                                                            key={c.courseId}
                                                            className="flex flex-wrap items-start gap-2"
                                                          >
                                                            <div className="w-[150px] pt-1.5">{c.egitimAdi}</div>
                                                            <select
                                                              className="px-2 py-1 rounded border bg-white"
                                                              style={{ borderColor: "var(--ak-border-default)" }}
                                                              value={t.seviye}
                                                              onChange={(e) =>
                                                                setTaslak((p) => ({
                                                                  ...p,
                                                                  [tk]: {
                                                                    ...t,
                                                                    seviye: e.target.value as Seviye | "",
                                                                  },
                                                                }))
                                                              }
                                                            >
                                                              <option value="">— seçilmedi —</option>
                                                              <option value="BASARILI">Başarılı</option>
                                                              <option value="EGITIM_GEREKLI">Eğitim gerekli</option>
                                                              <option value="BASARISIZ">Başarısız</option>
                                                            </select>
                                                            <Textarea
                                                              rows={1}
                                                              className="text-xs min-h-[30px] flex-1 min-w-[200px]"
                                                              placeholder="Not"
                                                              value={t.not}
                                                              onChange={(e) =>
                                                                setTaslak((p) => ({
                                                                  ...p,
                                                                  [tk]: { ...t, not: e.target.value },
                                                                }))
                                                              }
                                                            />
                                                            <button
                                                              type="button"
                                                              disabled={kaydediliyor === tk}
                                                              onClick={() =>
                                                                kaydet(d.packageId, s, c.courseId)
                                                              }
                                                              className="px-3 py-1 rounded border disabled:opacity-50"
                                                              style={{ borderColor: "var(--ak-border-default)" }}
                                                            >
                                                              {kaydediliyor === tk ? "Kaydediliyor…" : "Kaydet"}
                                                            </button>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
