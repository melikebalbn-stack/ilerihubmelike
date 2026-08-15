"use client"

// Faz 6 — "Personele Dönüştür" formu.
//
// Ekran KURAL YÜRÜTMEZ: ön-dolu değerler, otomatik aktarılacak alanlar, bölüm listesi,
// bölüm hiyerarşisi ve mükerrer TC kararı SUNUCUDAN gelir (GET .../personele-donustur).
// Buradaki tek mantık "hangi alan zorunlu" görselleştirmesidir; sunucu hepsini yeniden doğrular.

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, UserCheck, Loader2, ArrowRight } from "lucide-react"

type Hiyerarsi = {
  bolumMuduru: string | null
  birimSorumlusu: string | null
  sorumlu2: string | null
  sorumlu3: string | null
}
type BolumSecenek = { name: string; hiyerarsi: Hiyerarsi; pasifKoltuk: boolean }
type TcKontrol =
  | { durum: "TEMIZ" }
  | { durum: "AKTIF_VAR"; personnelId: string; adSoyad: string; sicilNo: string | null; mesaj: string }
  | {
      durum: "PASIF_VAR"
      adaylar: { personnelId: string; adSoyad: string; sicilNo: string | null; sonCikis: string | null }[]
      mesaj: string
    }
type Onizleme = {
  basvuru: { id: string; applicationNumber: string; status: string; fullName: string }
  onDolu: {
    gorev: string
    iseGirisTarihi: string
    egitimYeri: string | null
    egitimAlani: string | null
    mezuniyetYili: number | null
    cinsiyetEksik: boolean
  }
  otomatik: Record<string, unknown> & {
    beden: { ustBeden: string | null; altBeden: string | null; ayakkabiNo: string | null } | null
    egitimKaynagi: string | null
  }
  bolumler: BolumSecenek[]
  tcKontrol: TcKontrol
}

const YAKA = ["MAVI", "BEYAZ", "GRI"]
const DIREKT = ["DIREKT", "ENDIREKT", "A_DIREKT", "B_ENDIREKT"]
const ASANSOR = ["ASANSOR", "MEKANIK", "YOK"]
const CINSIYET = [
  { v: "MALE", l: "Bay" },
  { v: "FEMALE", l: "Bayan" },
]

// Önizleme satırı etiketleri — 13 otomatik alan İV'ye AÇIKÇA gösterilir.
const OTOMATIK_ETIKET: [string, string][] = [
  ["adSoyad", "Ad Soyad"],
  ["cinsiyet", "Cinsiyet"],
  ["kanGrubu", "Kan Grubu"],
  ["mailAdresi", "E-posta"],
  ["telefon", "Telefon"],
  ["ikametAdresi", "İkamet Adresi"],
  ["tcKimlikNoMaskeli", "TC Kimlik No (maskeli)"],
  ["dogumTarihi", "Doğum Tarihi"],
  ["egitimTipi", "Eğitim Tipi"],
  ["egitimYeri", "Eğitim Yeri"],
  ["egitimAlani", "Eğitim Alanı"],
  ["mezuniyetYili", "Mezuniyet Yılı"],
]

export function PersoneleDonusturDialog({
  open,
  onOpenChange,
  applicationId,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  applicationId: string
  onDone: () => void
}) {
  const [veri, setVeri] = useState<Onizleme | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const [sicilNo, setSicilNo] = useState("")
  const [yakaRengi, setYakaRengi] = useState("")
  const [bolum, setBolum] = useState("")
  const [gorev, setGorev] = useState("")
  const [iseGirisTarihi, setIseGirisTarihi] = useState("")
  const [direktEndirekt, setDirektEndirekt] = useState("")
  const [cinsiyet, setCinsiyet] = useState("")
  const [sinif, setSinif] = useState("")
  const [masrafMerkezi, setMasrafMerkezi] = useState("")
  const [asansorMekanik, setAsansorMekanik] = useState("")
  const [bolumDetay, setBolumDetay] = useState("")
  // Mükerrer TC kararı: "" = seçilmedi, "YENI" = yeni kart, aksi hâlde hedef personnelId
  const [karar, setKarar] = useState("")

  useEffect(() => {
    if (!open) return
    setYukleniyor(true)
    fetch(`/api/recruitment/applications/${applicationId}/personele-donustur`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) {
          toast.error(d.error || "Form verisi alinamadi")
          onOpenChange(false)
          return
        }
        setVeri(d)
        setGorev(d.onDolu?.gorev ?? "")
        setIseGirisTarihi(d.onDolu?.iseGirisTarihi ?? "")
        setKarar(d.tcKontrol?.durum === "PASIF_VAR" ? "" : "YENI")
      })
      .catch(() => {
        toast.error("Form verisi alinamadi")
        onOpenChange(false)
      })
      .finally(() => setYukleniyor(false))
  }, [open, applicationId, onOpenChange])

  const secilenBolum = veri?.bolumler.find((b) => b.name === bolum)
  const aktifCakisma = veri?.tcKontrol.durum === "AKTIF_VAR"
  const pasifCakisma = veri?.tcKontrol.durum === "PASIF_VAR"
  const cinsiyetGerekli = veri?.onDolu.cinsiyetEksik ?? false

  const eksik =
    !sicilNo.trim() ||
    !yakaRengi ||
    !bolum ||
    !gorev.trim() ||
    !iseGirisTarihi ||
    !direktEndirekt ||
    (cinsiyetGerekli && !cinsiyet) ||
    (pasifCakisma && !karar)

  const gonder = async () => {
    if (!veri) return
    setGonderiliyor(true)
    try {
      const body: Record<string, unknown> = {
        sicilNo: sicilNo.trim(),
        yakaRengi,
        bolum,
        gorev: gorev.trim(),
        iseGirisTarihi,
        direktEndirekt,
      }
      if (cinsiyetGerekli && cinsiyet) body.cinsiyet = cinsiyet
      if (sinif.trim()) body.sinif = sinif.trim()
      if (masrafMerkezi.trim()) body.masrafMerkezi = masrafMerkezi.trim()
      if (asansorMekanik) body.asansorMekanik = asansorMekanik
      if (bolumDetay.trim()) body.bolumDetay = bolumDetay.trim()
      if (pasifCakisma) {
        if (karar === "YENI") body.mukerrerOnaylandi = true
        else body.hedefPersonnelId = karar
      }
      const res = await fetch(`/api/recruitment/applications/${applicationId}/personele-donustur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(d.error || "Donusum basarisiz")
        return
      }
      toast.success(
        d.yenidenIseAlim
          ? "Mevcut personel kartina baglandi (yeniden ise alim)"
          : "Personel kaydi olusturuldu",
      )
      onOpenChange(false)
      onDone()
    } catch {
      toast.error("Bir hata olustu")
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!gonderiliyor) onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personele Donustur</DialogTitle>
          <DialogDescription>
            Basvuru personel kartina donusturulur ve statu &quot;Ise Basladi&quot; olur. Kayit ve
            statu AYNI islemde yazilir — biri olmazsa hicbiri olmaz.
          </DialogDescription>
        </DialogHeader>

        {yukleniyor || !veri ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Form hazirlaniyor...
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Mükerrer TC ───────────────────────────────────────────── */}
            {aktifCakisma && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Donusum yapilamaz.</strong> {(veri.tcKontrol as { mesaj: string }).mesaj}
                </span>
              </div>
            )}
            {pasifCakisma && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{(veri.tcKontrol as { mesaj: string }).mesaj}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {(veri.tcKontrol as { adaylar: { personnelId: string; adSoyad: string; sicilNo: string | null; sonCikis: string | null }[] }).adaylar.map((a) => (
                    <label key={a.personnelId} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="mukerrer-karar"
                        checked={karar === a.personnelId}
                        onChange={() => setKarar(a.personnelId)}
                      />
                      <span>
                        Mevcut karta bagla (yeniden ise alim): <strong>{a.adSoyad}</strong>
                        {a.sicilNo ? ` · sicil ${a.sicilNo}` : ""}
                        {a.sonCikis ? ` · cikis ${new Date(a.sonCikis).toLocaleDateString("tr-TR")}` : ""}
                      </span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="mukerrer-karar"
                      checked={karar === "YENI"}
                      onChange={() => setKarar("YENI")}
                    />
                    <span>Yeni personel karti olustur</span>
                  </label>
                </div>
              </div>
            )}

            {/* ── İV'nin gireceği zorunlu alanlar ───────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sicil No *</Label>
                <Input value={sicilNo} onChange={(e) => setSicilNo(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Yaka Rengi *</Label>
                <Select value={yakaRengi} onValueChange={setYakaRengi}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Secin" /></SelectTrigger>
                  <SelectContent>{YAKA.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bolum *</Label>
                <Select value={bolum} onValueChange={setBolum}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Bolum secin" /></SelectTrigger>
                  <SelectContent>
                    {veri.bolumler.map((b) => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gorev *</Label>
                <Input value={gorev} onChange={(e) => setGorev(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Ise Giris Tarihi *</Label>
                <Input type="date" value={iseGirisTarihi} onChange={(e) => setIseGirisTarihi(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Direkt / Endirekt *</Label>
                <Select value={direktEndirekt} onValueChange={setDirektEndirekt}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Secin" /></SelectTrigger>
                  <SelectContent>{DIREKT.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {cinsiyetGerekli && (
                <div>
                  <Label>Cinsiyet * <span className="text-xs font-normal text-muted-foreground">(basvuruda yok)</span></Label>
                  <Select value={cinsiyet} onValueChange={setCinsiyet}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Secin" /></SelectTrigger>
                    <SelectContent>{CINSIYET.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* ── Bölüm seçilince FK'dan gelen hiyerarşi ────────────────── */}
            {secilenBolum && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <div className="flex items-start gap-2">
                  <UserCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Bolum hiyerarsisi (tanimdan otomatik gelir, elle yazilmaz)</div>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span>Bolum Muduru: <strong>{secilenBolum.hiyerarsi.bolumMuduru ?? "—"}</strong></span>
                      <span>Birim Sorumlusu: <strong>{secilenBolum.hiyerarsi.birimSorumlusu ?? "—"}</strong></span>
                      <span>Sorumlu 2: <strong>{secilenBolum.hiyerarsi.sorumlu2 ?? "—"}</strong></span>
                      <span>Sorumlu 3: <strong>{secilenBolum.hiyerarsi.sorumlu3 ?? "—"}</strong></span>
                    </div>
                    {secilenBolum.pasifKoltuk && (
                      <div className="mt-1 text-amber-800">
                        Uyari: bu bolumdeki koltuk sahiplerinden en az biri PASIF personel. Bolum
                        tanimi guncellenmeli.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Opsiyoneller ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sinif</Label><Input value={sinif} onChange={(e) => setSinif(e.target.value)} className="mt-1" /></div>
              <div><Label>Masraf Merkezi</Label><Input value={masrafMerkezi} onChange={(e) => setMasrafMerkezi(e.target.value)} className="mt-1" /></div>
              <div><Label>Bolum Detay</Label><Input value={bolumDetay} onChange={(e) => setBolumDetay(e.target.value)} className="mt-1" /></div>
              <div>
                <Label>Asansor / Mekanik</Label>
                <Select value={asansorMekanik} onValueChange={setAsansorMekanik}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Secin" /></SelectTrigger>
                  <SelectContent>{ASANSOR.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Otomatik aktarilacak alanlar (ONIZLEME) ───────────────── */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">
                Basvurudan otomatik aktarilacak alanlar
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                {OTOMATIK_ETIKET.map(([k, l]) => {
                  const v = veri.otomatik[k]
                  const g =
                    v === null || v === undefined || v === ""
                      ? "—"
                      : k === "dogumTarihi"
                        ? new Date(String(v)).toLocaleDateString("tr-TR")
                        : String(v)
                  return (
                    <span key={k} className="flex items-center gap-1">
                      <span className="text-slate-500">{l}:</span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <strong className="truncate">{g}</strong>
                    </span>
                  )
                })}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Beden profili:{" "}
                {veri.otomatik.beden
                  ? `ust ${veri.otomatik.beden.ustBeden ?? "—"} · alt ${veri.otomatik.beden.altBeden ?? "—"} · ayakkabi ${veri.otomatik.beden.ayakkabiNo ?? "—"}`
                  : "olusturulmayacak (basvuruda beden bilgisi yok)"}
                {veri.otomatik.egitimKaynagi && (
                  <> · egitim satiri kaynagi: <strong>{veri.otomatik.egitimKaynagi}</strong></>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gonderiliyor}>
            Vazgec
          </Button>
          <Button onClick={gonder} disabled={gonderiliyor || yukleniyor || !veri || aktifCakisma || eksik}>
            {gonderiliyor ? "Kaydediliyor..." : "Personele Donustur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
