"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

// Şema yönetim işlemleri: üye taşıma, birim ekle/sil, üst birim değiştirme,
// raporlama hattı. Mevcut PozisyonYonetimPanel deseniyle aynı kabuk
// (daraltılabilir bölümler, hasFullAccess kapısı, onRefresh).
//
// NOT: raporlama hattı OrgUnit'te değil OrgEmployee'de tutuluyor
// (OrgEmployee.reportsToId) — bu yüzden seçiciler KOLTUK listesinden besleniyor.

interface Koltuk {
  id: string
  displayName: string
  employmentStatus?: string
  reportsToId?: string | null
}

interface Birim {
  id: string
  code?: string
  name: string
  unitType: string
  parentId?: string | null
  positionStatus?: "AKTIF" | "DONDURULDU" | "PLANLANAN"
  children?: Birim[]
  employees?: Koltuk[]
}

interface Props {
  departmanUnitlari: Birim[]
  hasFullAccess?: boolean
  onRefresh?: () => void
}

function duzlestir(liste: Birim[], derinlik = 0): { b: Birim; derinlik: number }[] {
  const out: { b: Birim; derinlik: number }[] = []
  for (const b of liste ?? []) {
    out.push({ b, derinlik })
    if (b.children?.length) out.push(...duzlestir(b.children, derinlik + 1))
  }
  return out
}

export default function BirimYonetimPanel({ departmanUnitlari, hasFullAccess = false, onRefresh }: Props) {
  const [acik, setAcik] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // taşıma
  const [tasiKoltuk, setTasiKoltuk] = useState("")
  const [tasiHedef, setTasiHedef] = useState("")
  // birim ekleme
  const [yeniAd, setYeniAd] = useState("")
  const [yeniTip, setYeniTip] = useState("DEPARTMENT")
  const [yeniParent, setYeniParent] = useState("")
  // parent değiştirme
  const [parentBirim, setParentBirim] = useState("")
  const [parentHedef, setParentHedef] = useState("")
  // silme
  const [silBirim, setSilBirim] = useState("")
  // raporlama
  const [rapKoltuk, setRapKoltuk] = useState("")
  const [rapHedef, setRapHedef] = useState("")

  const duz = useMemo(() => duzlestir(departmanUnitlari), [departmanUnitlari])
  const pozisyonlar = useMemo(() => duz.filter((x) => x.b.unitType === "POSITION"), [duz])
  const bosPozisyonlar = useMemo(
    () => pozisyonlar.filter((x) => (x.b.employees ?? []).filter((e) => e.employmentStatus !== "VACANT").length === 0),
    [pozisyonlar],
  )
  const koltuklar = useMemo(
    () =>
      duz.flatMap((x) =>
        (x.b.employees ?? [])
          .filter((e) => e.employmentStatus !== "VACANT")
          .map((e) => ({ ...e, kutu: x.b.name, kutuKod: x.b.code })),
      ),
    [duz],
  )

  if (!hasFullAccess) return null

  const cagir = async (url: string, method: string, body?: unknown, basari = "İşlem tamam") => {
    setSaving(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.status === 403) { toast.error("Bu işlem için yetkiniz yok"); return false }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) { toast.error(data.error || "İşlem başarısız"); return false }
      toast.success(data.message || basari)
      onRefresh?.()
      return true
    } catch {
      toast.error("İşlem başarısız")
      return false
    } finally {
      setSaving(false)
    }
  }

  const Bolum = ({ id, baslik, children }: { id: string; baslik: string; children: React.ReactNode }) => (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setAcik(acik === id ? null : id)}
        className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-muted/50"
      >
        {baslik}
        <span className="text-muted-foreground">{acik === id ? "−" : "+"}</span>
      </button>
      {acik === id && <div className="border-t p-3 space-y-2">{children}</div>}
    </div>
  )

  const sec = "w-full rounded border px-2 py-1.5 text-xs"
  const btn = "w-full rounded bg-teal-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"

  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Şema Yönetimi
      </div>

      <Bolum id="tasi" baslik="Üye taşı">
        <select className={sec} value={tasiKoltuk} onChange={(e) => setTasiKoltuk(e.target.value)}>
          <option value="">Taşınacak kişi…</option>
          {koltuklar.map((k) => (
            <option key={k.id} value={k.id}>{k.displayName} — {k.kutu}</option>
          ))}
        </select>
        <select className={sec} value={tasiHedef} onChange={(e) => setTasiHedef(e.target.value)}>
          <option value="">Hedef kutu (yalnız BOŞ)…</option>
          {bosPozisyonlar.map((x) => (
            <option key={x.b.id} value={x.b.id}>{"— ".repeat(x.derinlik)}{x.b.name}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          Kayıt silinmez, taşınır — geçmiş korunur. Hedef kutu dolu olamaz.
        </p>
        <button
          type="button" className={btn} disabled={saving || !tasiKoltuk || !tasiHedef}
          onClick={async () => {
            if (await cagir("/api/strategic-hr/org-chart/uye-tasi", "POST",
              { orgEmployeeId: tasiKoltuk, hedefOrgUnitId: tasiHedef }, "Üye taşındı")) {
              setTasiKoltuk(""); setTasiHedef("")
            }
          }}
        >{saving ? "Taşınıyor…" : "Taşı"}</button>
      </Bolum>

      <Bolum id="ekle" baslik="Birim ekle">
        <input className={sec} placeholder="Birim adı" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
        <select className={sec} value={yeniTip} onChange={(e) => setYeniTip(e.target.value)}>
          <option value="DEPARTMENT">Departman</option>
          <option value="POSITION">Pozisyon</option>
          <option value="GROUP">Grup</option>
        </select>
        <select className={sec} value={yeniParent} onChange={(e) => setYeniParent(e.target.value)}>
          <option value="">Üst birim yok (kök)</option>
          {duz.map((x) => (
            <option key={x.b.id} value={x.b.id}>{"— ".repeat(x.derinlik)}{x.b.name}</option>
          ))}
        </select>
        <button
          type="button" className={btn} disabled={saving || !yeniAd.trim()}
          onClick={async () => {
            if (await cagir("/api/strategic-hr/org-chart/birim", "POST",
              { name: yeniAd.trim(), unitType: yeniTip, parentId: yeniParent || null }, "Birim eklendi")) {
              setYeniAd(""); setYeniParent("")
            }
          }}
        >{saving ? "Ekleniyor…" : "Ekle"}</button>
      </Bolum>

      <Bolum id="parent" baslik="Üst birim değiştir">
        <select className={sec} value={parentBirim} onChange={(e) => setParentBirim(e.target.value)}>
          <option value="">Taşınacak birim…</option>
          {duz.map((x) => (
            <option key={x.b.id} value={x.b.id}>{"— ".repeat(x.derinlik)}{x.b.name}</option>
          ))}
        </select>
        <select className={sec} value={parentHedef} onChange={(e) => setParentHedef(e.target.value)}>
          <option value="">Yeni üst birim (boş = kök yap)</option>
          {duz.filter((x) => x.b.id !== parentBirim).map((x) => (
            <option key={x.b.id} value={x.b.id}>{"— ".repeat(x.derinlik)}{x.b.name}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          Bir birim kendi alt ağacına taşınamaz — sunucu reddeder.
        </p>
        <button
          type="button" className={btn} disabled={saving || !parentBirim}
          onClick={async () => {
            if (await cagir(`/api/strategic-hr/org-chart/birim/${parentBirim}`, "PATCH",
              { parentId: parentHedef || null }, "Üst birim değişti")) {
              setParentBirim(""); setParentHedef("")
            }
          }}
        >{saving ? "Taşınıyor…" : "Taşı"}</button>
      </Bolum>

      <Bolum id="raporlama" baslik="Raporlama hattı">
        <select className={sec} value={rapKoltuk} onChange={(e) => setRapKoltuk(e.target.value)}>
          <option value="">Kişi…</option>
          {koltuklar.map((k) => (
            <option key={k.id} value={k.id}>{k.displayName} — {k.kutu}</option>
          ))}
        </select>
        <select className={sec} value={rapHedef} onChange={(e) => setRapHedef(e.target.value)}>
          <option value="">Kime rapor veriyor (boş = tanımsız)</option>
          {koltuklar.filter((k) => k.id !== rapKoltuk).map((k) => (
            <option key={k.id} value={k.id}>{k.displayName} — {k.kutu}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          Raporlama kutular arasında değil KİŞİLER arasında kurulur. A→B→A döngüsü reddedilir.
        </p>
        <button
          type="button" className={btn} disabled={saving || !rapKoltuk}
          onClick={async () => {
            if (await cagir(`/api/strategic-hr/org-chart/uye/${rapKoltuk}`, "PATCH",
              { reportsToId: rapHedef || null }, "Raporlama hattı güncellendi")) {
              setRapKoltuk(""); setRapHedef("")
            }
          }}
        >{saving ? "Kaydediliyor…" : "Kaydet"}</button>
      </Bolum>

      <Bolum id="sil" baslik="Birim sil">
        <select className={sec} value={silBirim} onChange={(e) => setSilBirim(e.target.value)}>
          <option value="">Silinecek birim…</option>
          {duz.map((x) => (
            <option key={x.b.id} value={x.b.id}>{"— ".repeat(x.derinlik)}{x.b.name}</option>
          ))}
        </select>
        <p className="text-[10px] text-amber-700">
          Üyesi veya alt birimi olan kutu silinemez — önce taşıyın. Silme geri alınamaz.
        </p>
        <button
          type="button"
          className="w-full rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          disabled={saving || !silBirim}
          onClick={async () => {
            const ad = duz.find((x) => x.b.id === silBirim)?.b.name ?? ""
            if (!window.confirm(`"${ad}" birimi kalıcı olarak silinsin mi?`)) return
            if (await cagir(`/api/strategic-hr/org-chart/birim/${silBirim}`, "DELETE", undefined, "Birim silindi")) {
              setSilBirim("")
            }
          }}
        >{saving ? "Siliniyor…" : "Sil"}</button>
      </Bolum>
    </div>
  )
}
