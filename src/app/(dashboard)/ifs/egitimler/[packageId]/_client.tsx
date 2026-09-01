"use client";

// IFS departman (paket) yönetimi — iki sekme.
//
//   Görevler : sol alan listesi → sağ görev listesi (sürükle-sırala, ekle,
//              düzenle, sil). Ekrandan eklenen görev MANUEL işaretlenir.
//   Kişiler  : bireysel atamalar + bölüm ataması.
//
// Bileşenler akademi tarafından KOPYALANMADI, import edildi: aynı görevi iki
// yerde ayrı ayrı sürdürmek ayrışma üretir. Gerekli farklar prop ile geçiliyor
// (AdminContentFormModal → ifsKaynak).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ListChecks, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminContentsTable } from "@/components/akademi/admin/AdminContentsTable";
import { AdminContentFormModal } from "@/components/akademi/admin/AdminContentFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import { AdminPackageUserPicker } from "@/components/akademi/admin/AdminPackageUserPicker";
import { AdminPackageBolumPicker } from "@/components/akademi/admin/AdminPackageBolumPicker";
import { stripDeptPrefix } from "@/lib/akademi-ifs";
import type { AdminContentItem } from "@/types/akademi-admin";
import type { AdminPackageDetail } from "@/types/akademi-package";

// DELETE ucu değerlendirme varsa 409 + sayılarla döner.
interface CakismaBilgisi {
  degerlendirmeSayisi: number;
  etkilenenKisi: number;
}

export function PaketYonetim({ packageId }: { packageId: string }) {
  const router = useRouter();

  const [pkg, setPkg] = useState<AdminPackageDetail | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [seciliCourseId, setSeciliCourseId] = useState<string | null>(null);

  const [gorevler, setGorevler] = useState<AdminContentItem[]>([]);
  const [gorevYukleniyor, setGorevYukleniyor] = useState(false);

  const [formAcik, setFormAcik] = useState(false);
  const [formMod, setFormMod] = useState<"create" | "edit">("create");
  const [duzenlenen, setDuzenlenen] = useState<AdminContentItem | null>(null);

  const [silinecek, setSilinecek] = useState<AdminContentItem | null>(null);
  const [cakisma, setCakisma] = useState<CakismaBilgisi | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);

  const paketiYukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/akademi/admin/packages/${packageId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPkg(d?.package ?? null))
      .catch(() => setPkg(null))
      .finally(() => setYukleniyor(false));
  }, [packageId]);

  useEffect(() => {
    paketiYukle();
  }, [paketiYukle]);

  // İlk alan kendiliğinden seçilsin; paket yeniden yüklendiğinde seçim korunur.
  useEffect(() => {
    if (!pkg?.courses.length) return;
    setSeciliCourseId((mevcut) =>
      mevcut && pkg.courses.some((c) => c.courseId === mevcut)
        ? mevcut
        : pkg.courses[0].courseId
    );
  }, [pkg]);

  const gorevleriYukle = useCallback((courseId: string) => {
    setGorevYukleniyor(true);
    fetch(`/api/akademi/admin/contents?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => (r.ok ? r.json() : { contents: [] }))
      .then((d) => setGorevler(d.contents ?? []))
      .catch(() => setGorevler([]))
      .finally(() => setGorevYukleniyor(false));
  }, []);

  useEffect(() => {
    if (seciliCourseId) gorevleriYukle(seciliCourseId);
    else setGorevler([]);
  }, [seciliCourseId, gorevleriYukle]);

  const tazele = useCallback(() => {
    paketiYukle();
    if (seciliCourseId) gorevleriYukle(seciliCourseId);
  }, [paketiYukle, gorevleriYukle, seciliCourseId]);

  const siralamaKaydet = useCallback(
    async (orderedIds: string[]) => {
      const res = await fetch("/api/akademi/admin/contents/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentIds: orderedIds }),
      });
      if (!res.ok) throw new Error("reorder");
      toast.success("Sıralama kaydedildi");
    },
    []
  );

  // ── SİLME ─────────────────────────────────────────────────────────────
  // İki kademe. Birinci onay normal silme uyarısı; uç 409 dönerse ikinci
  // kademeye geçilir (kaç değerlendirme / kaç kişi) ve ancak orada ?force=1
  // gönderilir. Böylece değerlendirmesi olmayan görev de onaysız silinmiyor,
  // olan görev ise ne kaybedileceği söylenmeden silinmiyor.
  const silmeyiCalistir = useCallback(
    async (force: boolean) => {
      if (!silinecek) return;
      setSiliniyor(true);
      try {
        const res = await fetch(
          `/api/akademi/admin/contents/${silinecek.id}${force ? "?force=1" : ""}`,
          { method: "DELETE" }
        );
        if (res.status === 409) {
          const g = await res.json().catch(() => ({}));
          setCakisma({
            degerlendirmeSayisi: g.degerlendirmeSayisi ?? 0,
            etkilenenKisi: g.etkilenenKisi ?? 0,
          });
          return;
        }
        if (!res.ok) {
          const g = await res.json().catch(() => ({}));
          toast.error(g.error || "Görev silinemedi");
          return;
        }
        toast.success("Görev silindi");
        setSilinecek(null);
        setCakisma(null);
        tazele();
      } catch {
        toast.error("Görev silinemedi");
      } finally {
        setSiliniyor(false);
      }
    },
    [silinecek, tazele]
  );

  const departmanAdi = pkg ? stripDeptPrefix(pkg.name) : "";
  const gorevToplam = useMemo(
    () => (pkg?.courses ?? []).reduce((s, c) => s + (c.gorevSayisi ?? 0), 0),
    [pkg]
  );
  const paketBolumleri = useMemo(
    () => new Set((pkg?.bolums ?? []).map((b) => b.bolum)),
    [pkg]
  );

  if (yukleniyor) {
    return (
      <div className="px-8 py-7 text-sm" style={{ color: "var(--ak-text-secondary)" }}>
        Yükleniyor…
      </div>
    );
  }
  if (!pkg) {
    return (
      <div className="px-8 py-7 space-y-3">
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Departman bulunamadı.
        </p>
        <Button variant="outline" onClick={() => router.push("/ifs/egitimler")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Eğitimlere dön
        </Button>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto ak-animate-in space-y-5">
      {/* ── Üst: geri + ad + özet ── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => router.push("/ifs/egitimler")}
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          IFS Eğitimleri
        </button>
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--ak-text-primary)" }}>
            {departmanAdi}
          </h1>
          <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
            {pkg.courses.length} alan · {gorevToplam} görev ·{" "}
            {pkg.userAssignments.length} kişi
            {pkg.bolums.length > 0 && ` · ${pkg.bolums.length} bölüm ataması`}
          </p>
        </div>
      </div>

      <Tabs defaultValue="gorevler">
        <TabsList>
          <TabsTrigger value="gorevler">
            <ListChecks className="w-4 h-4 mr-2" />
            Görevler
          </TabsTrigger>
          <TabsTrigger value="kisiler">
            <Users className="w-4 h-4 mr-2" />
            Kişiler
          </TabsTrigger>
        </TabsList>

        {/* ══ GÖREVLER ══ */}
        <TabsContent value="gorevler" className="mt-4">
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            {/* Sol: alan listesi */}
            <div className="space-y-1">
              {pkg.courses.length === 0 && (
                <p className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
                  Bu departmanda alan yok.
                </p>
              )}
              {pkg.courses.map((c) => {
                const secili = c.courseId === seciliCourseId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSeciliCourseId(c.courseId)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2"
                    style={{
                      background: secili ? "var(--ak-accent-glow)" : "transparent",
                      color: secili ? "var(--ak-accent)" : "var(--ak-text-primary)",
                      fontWeight: secili ? 600 : 400,
                    }}
                  >
                    <span className="truncate">{stripDeptPrefix(c.courseTitle)}</span>
                    <span
                      className="text-xs shrink-0"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {c.gorevSayisi ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sağ: seçili alanın görevleri */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--ak-text-primary)" }}>
                  {seciliCourseId
                    ? stripDeptPrefix(
                        pkg.courses.find((c) => c.courseId === seciliCourseId)
                          ?.courseTitle ?? ""
                      )
                    : "Alan seçin"}
                </h2>
                <Button
                  size="sm"
                  disabled={!seciliCourseId}
                  onClick={() => {
                    setFormMod("create");
                    setDuzenlenen(null);
                    setFormAcik(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Yeni görev
                </Button>
              </div>

              {gorevYukleniyor ? (
                <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
                  Yükleniyor…
                </p>
              ) : gorevler.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
                  Bu alanda görev yok.
                </p>
              ) : (
                <AdminContentsTable
                  contents={gorevler}
                  onEdit={(c) => {
                    setFormMod("edit");
                    setDuzenlenen(c);
                    setFormAcik(true);
                  }}
                  onDelete={(c) => {
                    setCakisma(null);
                    setSilinecek(c);
                  }}
                  onReorder={siralamaKaydet}
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══ KİŞİLER ══ */}
        <TabsContent value="kisiler" className="mt-4 space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ak-text-primary)" }}>
              Atanmış kişiler ({pkg.userAssignments.length})
            </h2>
            {pkg.userAssignments.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
                Bu departmana atanmış kişi yok.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: "var(--ak-text-tertiary)" }}>
                      <th className="text-left font-medium px-3 py-2">Kişi</th>
                      <th className="text-left font-medium px-3 py-2">Bölüm</th>
                      <th className="text-left font-medium px-3 py-2">Atama türü</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.userAssignments.map((a) => {
                      // Atama satırı kaynağını taşımıyor; kişinin bölümü paketin
                      // bölüm listesindeyse atama oradan gelmiş kabul edilir.
                      const bolumden =
                        !!a.userBolum && paketBolumleri.has(a.userBolum);
                      return (
                        <tr key={a.id} style={{ borderTop: "1px solid var(--ak-border-default)" }}>
                          <td className="px-3 py-2">
                            <div style={{ color: "var(--ak-text-primary)" }}>
                              {a.userName ?? a.userEmail ?? a.userId}
                            </div>
                            {a.userName && a.userEmail && (
                              <div className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
                                {a.userEmail}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2" style={{ color: "var(--ak-text-secondary)" }}>
                            {a.userBolum ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: bolumden
                                  ? "var(--ak-teal-glow)"
                                  : "var(--ak-accent-glow)",
                                color: bolumden ? "var(--ak-teal)" : "var(--ak-accent)",
                              }}
                            >
                              {bolumden ? "Bölüm" : "Bireysel"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Kişi ekle/çıkar — akademi picker'ı olduğu gibi */}
          <AdminPackageUserPicker
            packageId={packageId}
            assignments={pkg.userAssignments}
            onSaved={paketiYukle}
          />

          {/* Bölüm ataması ayrı blok */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ak-text-primary)" }}>
              Bölüm ataması
            </h2>
            <AdminPackageBolumPicker
              packageId={packageId}
              initialBolums={pkg.bolums.map((b) => b.bolum)}
              initialDueDate={pkg.bolums[0]?.dueDate ?? null}
              onSaved={paketiYukle}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Görev formu — create'te kaynak MANUEL yazılır. */}
      {seciliCourseId && (
        <AdminContentFormModal
          open={formAcik}
          onOpenChange={setFormAcik}
          mode={formMod}
          courseId={seciliCourseId}
          content={duzenlenen}
          ifsKaynak="MANUEL"
          onSaved={() => {
            setFormAcik(false);
            tazele();
          }}
        />
      )}

      {/* Birinci kademe onay */}
      <AdminDeleteConfirm
        open={!!silinecek && !cakisma}
        onOpenChange={(o) => {
          if (!o) setSilinecek(null);
        }}
        title="Görevi sil"
        description={
          silinecek
            ? `"${silinecek.title}" kalıcı olarak silinecek.` +
              (silinecek.degerlendirmeSayisi
                ? ` Bu görevde ${silinecek.degerlendirmeSayisi} değerlendirme var.`
                : "")
            : ""
        }
        loading={siliniyor}
        onConfirm={() => silmeyiCalistir(false)}
      />

      {/* İkinci kademe — yalnız uç 409 dönerse açılır */}
      <AdminDeleteConfirm
        open={!!silinecek && !!cakisma}
        onOpenChange={(o) => {
          if (!o) {
            setSilinecek(null);
            setCakisma(null);
          }
        }}
        title="Değerlendirmeler silinecek"
        description={
          cakisma
            ? `${cakisma.degerlendirmeSayisi} değerlendirme, ${cakisma.etkilenenKisi} kişi etkilenecek. Silinen değerlendirmeler geri gelmez.`
            : ""
        }
        confirmLabel="Yine de sil"
        loading={siliniyor}
        onConfirm={() => silmeyiCalistir(true)}
      />
    </div>
  );
}
