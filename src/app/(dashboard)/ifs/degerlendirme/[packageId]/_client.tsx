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
import { ArrowLeft, ListChecks, Pencil, Plus, Settings2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminContentsTable } from "@/components/akademi/admin/AdminContentsTable";
import { AdminContentFormModal } from "@/components/akademi/admin/AdminContentFormModal";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import { AdminPackageUserPicker } from "@/components/akademi/admin/AdminPackageUserPicker";
import { AdminPackageBolumPicker } from "@/components/akademi/admin/AdminPackageBolumPicker";
import { AdminCourseFormModal } from "@/components/akademi/admin/AdminCourseFormModal";
import { AdminPackageCoursesPicker } from "@/components/akademi/admin/AdminPackageCoursesPicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { stripDeptPrefix } from "@/lib/akademi-ifs";
import type { AdminContentItem, AdminCourseListItem } from "@/types/akademi-admin";
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

  // ── Alan (kurs) yönetimi ──
  // Alan adı/aktiflik AdminCourseFormModal'da, sıra ve paket bağı
  // AdminPackageCoursesPicker'da. İkisi de akademi'den, KOPYALANMADI.
  const [alanModalAcik, setAlanModalAcik] = useState(false);
  const [alanModu, setAlanModu] = useState<"create" | "edit">("create");
  const [duzenlenenAlan, setDuzenlenenAlan] = useState<AdminCourseListItem | null>(null);
  const [alanlariDuzenle, setAlanlariDuzenle] = useState(false);

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

  // Düzenleme için TAM kurs kaydı gerekiyor: modal edit'te description,
  // thumbnail, category, duration, isActive alanlarının HEPSİNİ PATCH ediyor.
  // Paket detayından uydurma bir kayıt beslemek bu alanları sessizce silerdi —
  // o yüzden gerçek kaydı listeden alıyoruz (courses/[id] üzerinde GET yok).
  //
  // page=1 ZORUNLU: uç `page` yoksa legacy dala düşüp type/status/pageSize'ı
  // yok sayıyor — status=all da uygulanmıyordu, yani PASİF bir alan bulunamıyordu.
  // `page` ile paginated dal çalışır; yanıt `items` anahtarıyla döner.
  //   status=all   → pasif alan da düzenlenebilsin
  //   pageSize=100 → şemadaki üst sınır (bugün 24 IFS alanı var)
  // 100'ü aşarsa kurs bulunamaz; aşağıdaki toast ile AÇIKÇA durulur, sessiz
  // başarısızlık yok.
  const alanDuzenle = useCallback(async (courseId: string) => {
    const d = await fetch(
      "/api/akademi/admin/courses?page=1&pageSize=100&type=ifs&status=all"
    )
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .catch(() => ({ items: [] }));
    const kurs = (d.items ?? d.courses ?? []).find(
      (c: AdminCourseListItem) => c.id === courseId
    );
    if (!kurs) {
      toast.error("Alan bilgisi okunamadı");
      return;
    }
    setDuzenlenenAlan(kurs);
    setAlanModu("edit");
    setAlanModalAcik(true);
  }, []);

  // "Yeni alan": kurs oluşturulur, sonra AYRI bir PUT ile pakete bağlanır
  // (uç set-replace çalışıyor: mevcut liste + yeni kurs gönderilir).
  // Bağlama başarısızsa kurs ortada kalır — kullanıcıya "Alanları düzenle"den
  // elle ekleyebileceği söylenir, sessizce yutulmaz.
  const yeniAlaniBagla = useCallback(
    async (created: { id: string }) => {
      if (!pkg) return;
      const courses = [
        ...pkg.courses.map((c) => ({
          courseId: c.courseId,
          order: c.order,
          isRequired: c.isRequired,
        })),
        { courseId: created.id, order: pkg.courses.length, isRequired: true },
      ];
      try {
        const res = await fetch(`/api/akademi/admin/packages/${packageId}/courses`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courses }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(
            `Alan oluştu ama departmana bağlanamadı: ${err.error || "bilinmeyen hata"}. "Alanları düzenle"den elle ekleyebilirsiniz.`
          );
          return;
        }
        toast.success("Alan oluşturuldu ve departmana bağlandı");
      } catch {
        toast.error(
          'Alan oluştu ama bağlama sırasında hata oluştu. "Alanları düzenle"den elle ekleyin.'
        );
      } finally {
        paketiYukle();
      }
    },
    [pkg, packageId, paketiYukle]
  );

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
        <Button variant="outline" onClick={() => router.push("/ifs/degerlendirme")}>
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
          onClick={() => router.push("/ifs/degerlendirme")}
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
            {/* Sol: alan listesi. Alan yönetimi İKİNCİL — görev listesi ana iş,
                bu yüzden kalem yalnız hover'da, sıra/bağ ayrı bir modalda. */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1 pb-1">
                <span
                  className="text-[11px] uppercase tracking-wide font-medium"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  Alanlar
                </span>
                <button
                  type="button"
                  title="Yeni alan"
                  onClick={() => {
                    setDuzenlenenAlan(null);
                    setAlanModu("create");
                    setAlanModalAcik(true);
                  }}
                  className="p-1 rounded"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {pkg.courses.length === 0 && (
                <p className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
                  Bu departmanda alan yok.
                </p>
              )}
              {pkg.courses.map((c) => {
                const secili = c.courseId === seciliCourseId;
                return (
                  // Satırın kendisi button DEĞİL: içine kalem düğmesi giriyor,
                  // iç içe button geçersiz HTML olurdu.
                  <div
                    key={c.id}
                    className="group w-full px-3 py-2 rounded-md text-sm flex items-center gap-2"
                    style={{
                      background: secili ? "var(--ak-accent-glow)" : "transparent",
                      color: secili ? "var(--ak-accent)" : "var(--ak-text-primary)",
                      fontWeight: secili ? 600 : 400,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSeciliCourseId(c.courseId)}
                      className="flex-1 min-w-0 text-left truncate"
                    >
                      {stripDeptPrefix(c.courseTitle)}
                    </button>
                    <button
                      type="button"
                      title="Alanı düzenle"
                      onClick={() => alanDuzenle(c.courseId)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                      style={{ color: "var(--ak-text-secondary)" }}
                    >
                      <Pencil size={12} />
                    </button>
                    <span
                      className="text-xs shrink-0"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {c.gorevSayisi ?? 0}
                    </span>
                  </div>
                );
              })}

              {pkg.courses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAlanlariDuzenle(true)}
                  className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded border"
                  style={{
                    borderColor: "var(--ak-border-default)",
                    color: "var(--ak-text-secondary)",
                  }}
                >
                  <Settings2 size={12} />
                  Alanları düzenle
                </button>
              )}
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

      {/* Alan formu — ad, açıklama, aktif/pasif. create'te isIfs + oluştur-bağla.
          SİLME BU EKRANDA YOK: kurs silmek görev ve alan değerlendirmelerini
          cascade ile götürüyor (409 koruması var ama ?force=1 ile aşılabiliyor);
          bu karar yönetim ekranında verilmemeli, akademi tarafında kalıyor. */}
      <AdminCourseFormModal
        open={alanModalAcik}
        onOpenChange={setAlanModalAcik}
        mode={alanModu}
        course={duzenlenenAlan}
        categories={[]}
        isIfs
        onCreated={alanModu === "create" ? yeniAlaniBagla : undefined}
        onSaved={() => {
          setAlanModalAcik(false);
          setDuzenlenenAlan(null);
          tazele();
        }}
      />

      {/* Alan sırası + departmandan çıkarma. */}
      <Dialog open={alanlariDuzenle} onOpenChange={setAlanlariDuzenle}>
        <DialogContent className="max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Alanları düzenle — {departmanAdi}</DialogTitle>
            <DialogDescription>
              Sırayı sürükleyerek değiştirin, alan ekleyin ya da çıkarın.
              <strong> Çıkarmak silmek değildir:</strong> alan bu departmandan
              kopar, kursun kendisi ve içindeki görevler/değerlendirmeler
              olduğu gibi kalır — başka bir departmana bağlanabilir.
            </DialogDescription>
          </DialogHeader>
          {pkg.courses.length > 0 && (
            <AdminPackageCoursesPicker
              packageId={packageId}
              initialCourses={pkg.courses}
              isIfs
              onSaved={() => {
                paketiYukle();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
