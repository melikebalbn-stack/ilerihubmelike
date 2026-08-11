'use client'

// Başvuru İK DÜZELTMESİ — düzenleme modu.
//
// Yalnız `basvuru-duzeltme-alanlari.ts` beyaz listesindeki alanlar burada düzenlenir;
// geri kalan her şey (KVKK, sağlık beyanı, imza, TC, adli sicil, beden, statü…) detay
// sayfasında OLDUĞU GİBİ salt okunur kalır — bu bileşen onlara hiç dokunmaz.
//
// Desen: RmaFormClient / UygunsuzlukImportDialog — elle useState + shadcn Dialog,
// react-hook-form YOK (portalda diğer İK/kalite formları da böyle).
//
// GÖNDERİM KURALI: yalnız DEĞİŞEN alanlar PATCH gövdesine konur. Sunucu da aynı
// karşılaştırmayı tekrar yapar (degisiklikleriCikar) — client'a güvenilmez; buradaki
// filtre yalnız gereksiz denetim satırı üretmemek için.

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ALAN_ETIKETLERI } from '@/lib/recruitment/basvuru-duzeltme-alanlari'

// ── Alan tanımları ────────────────────────────────────────────────────────────
// Etiketler ALAN_ETIKETLERI'nden gelir (TEK KAYNAK — denetim geçmişi aynı adı gösterir).
type AlanTipi = 'metin' | 'uzunMetin' | 'tarih' | 'sayi' | 'bool' | 'enum'
type Alan = { key: keyof typeof ALAN_ETIKETLERI; tip: AlanTipi; secenekler?: Record<string, string>; ipucu?: string }
type Grup = { baslik: string; alanlar: Alan[] }

const maritalStatusLabels: Record<string, string> = {
  SINGLE: 'Bekar',
  MARRIED: 'Evli',
  DIVORCED: 'Boşanmış',
  WIDOWED: 'Dul',
}
const educationLevelLabels: Record<string, string> = {
  PRIMARY_SCHOOL: 'İlköğretim',
  HIGH_SCHOOL: 'Lise',
  ASSOCIATE: 'Önlisans',
  BACHELOR: 'Lisans',
  MASTER: 'Yüksek Lisans',
  DOCTORATE: 'Doktora',
}

const GRUPLAR: Grup[] = [
  {
    baslik: 'Kimlik',
    alanlar: [
      { key: 'fullName', tip: 'metin' },
      { key: 'birthPlace', tip: 'metin' },
      { key: 'birthDate', tip: 'tarih' },
      { key: 'nationality', tip: 'metin' },
    ],
  },
  {
    baslik: 'İletişim',
    alanlar: [
      { key: 'mobilePhone', tip: 'metin', ipucu: 'Örn. 0532 000 00 00' },
      { key: 'email', tip: 'metin' },
      { key: 'workPhone', tip: 'metin' },
      { key: 'homePhone', tip: 'metin' },
      { key: 'homeAddress', tip: 'uzunMetin' },
      { key: 'preferredContactGsm', tip: 'bool' },
      { key: 'preferredContactEmail', tip: 'bool' },
      { key: 'preferredContactOther', tip: 'metin' },
    ],
  },
  {
    baslik: 'Aile',
    alanlar: [
      { key: 'maritalStatus', tip: 'enum', secenekler: maritalStatusLabels },
      { key: 'numberOfChildren', tip: 'sayi' },
      { key: 'spouseWorking', tip: 'bool' },
      { key: 'spouseOccupation', tip: 'metin' },
      { key: 'dependents', tip: 'uzunMetin' },
    ],
  },
  {
    baslik: 'İş Tercihleri',
    alanlar: [
      { key: 'requestedPosition', tip: 'metin' },
      { key: 'expectedSalary', tip: 'sayi', ipucu: 'Aylık brüt, tam TL (örn. 45000)' },
      { key: 'availableStartDate', tip: 'tarih' },
      { key: 'previouslyWorkedHere', tip: 'bool' },
      { key: 'canContactLastEmployer', tip: 'bool' },
      { key: 'hasTravelRestriction', tip: 'bool' },
      { key: 'canWorkShifts', tip: 'bool' },
    ],
  },
  {
    baslik: 'Sürücü Belgesi',
    alanlar: [
      { key: 'hasDriverLicense', tip: 'bool' },
      { key: 'driverLicenseClass', tip: 'metin' },
      { key: 'driverLicenseDate', tip: 'tarih' },
    ],
  },
  {
    baslik: 'Öğrenim ve Diğer',
    alanlar: [
      { key: 'educationLevel', tip: 'enum', secenekler: educationLevelLabels },
      { key: 'hobbies', tip: 'uzunMetin' },
      { key: 'hasRelativesInCompany', tip: 'bool' },
      { key: 'relativeName', tip: 'metin' },
    ],
  },
]

// ── Satır tabanlı (JSON) alanlar ──────────────────────────────────────────────
// Sütun şekilleri aday formundaki tiplerle AYNI (components/job-application/types.ts).
type Sutun = { key: string; label: string; genis?: boolean }
type DiziAlan = { key: keyof typeof ALAN_ETIKETLERI; sutunlar: Sutun[] }

const DIZI_ALANLARI: DiziAlan[] = [
  {
    key: 'workExperience',
    sutunlar: [
      { key: 'company', label: 'Firma' },
      { key: 'position', label: 'Görev' },
      { key: 'startDate', label: 'Başlangıç' },
      { key: 'endDate', label: 'Bitiş' },
      { key: 'leavingReason', label: 'Ayrılma Nedeni', genis: true },
      { key: 'lastSalary', label: 'Son Ücret' },
    ],
  },
  {
    key: 'references',
    sutunlar: [
      { key: 'name', label: 'Ad Soyad' },
      { key: 'company', label: 'Firma' },
      { key: 'position', label: 'Görev' },
      { key: 'phone', label: 'Telefon' },
    ],
  },
  {
    key: 'foreignLanguages',
    sutunlar: [
      { key: 'language', label: 'Dil' },
      { key: 'reading', label: 'Okuma' },
      { key: 'writing', label: 'Yazma' },
      { key: 'speaking', label: 'Konuşma' },
      { key: 'learnedAt', label: 'Öğrenildiği Yer' },
    ],
  },
  {
    key: 'computerSkills',
    sutunlar: [
      { key: 'program', label: 'Program' },
      { key: 'level', label: 'Seviye' },
      { key: 'learnedAt', label: 'Öğrenildiği Yer' },
    ],
  },
  {
    key: 'coursesAndSeminars',
    sutunlar: [
      { key: 'institution', label: 'Kurum' },
      { key: 'subject', label: 'Konu' },
      { key: 'duration', label: 'Süre' },
      { key: 'attendanceDate', label: 'Tarih' },
    ],
  },
]

// educationHistory dizi DEĞİL: öğrenim kademesine göre anahtarlı nesne.
const EGITIM_SUTUNLARI: Sutun[] = [
  { key: 'institution', label: 'Kurum' },
  { key: 'department', label: 'Bölüm' },
  { key: 'startDate', label: 'Başlangıç' },
  { key: 'endDate', label: 'Bitiş' },
  { key: 'gpa', label: 'Not Ort.' },
]

// ── Değer dönüşümleri ─────────────────────────────────────────────────────────
// Form içi gösterim daima string; gönderirken alanın tipine göre çevrilir.
function formaCevir(v: unknown, tip: AlanTipi): string {
  if (v === null || v === undefined) return ''
  if (tip === 'tarih') {
    const d = new Date(v as string)
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  if (tip === 'bool') return v === true ? 'true' : v === false ? 'false' : ''
  return String(v)
}

function gondermeyeCevir(s: string, tip: AlanTipi): unknown {
  const t = s.trim()
  if (tip === 'bool') return t === '' ? null : t === 'true'
  if (tip === 'sayi') return t === '' ? null : Number(t)
  if (tip === 'tarih') return t === '' ? null : new Date(t).toISOString()
  return t // metin/uzunMetin/enum — sunucu '' → null çeviriyor
}

type Satir = Record<string, string>

export function BasvuruDuzeltmeDialog({
  open,
  onOpenChange,
  applicationId,
  app,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  applicationId: string
  app: Record<string, unknown>
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [degerler, setDegerler] = useState<Record<string, string>>({})
  const [diziler, setDiziler] = useState<Record<string, Satir[]>>({})
  const [egitim, setEgitim] = useState<Record<string, Satir>>({})
  const [alanHatalari, setAlanHatalari] = useState<{ alan: string; mesaj: string }[]>([])

  const duzAlanlar = useMemo(() => GRUPLAR.flatMap((g) => g.alanlar), [])

  // Dialog her açılışta kaydın GÜNCEL hâlinden doldurulur (kapatıp açmak = değişiklikleri at).
  useEffect(() => {
    if (!open) return
    const d: Record<string, string> = {}
    for (const a of duzAlanlar) d[a.key] = formaCevir(app[a.key], a.tip)
    setDegerler(d)

    const dz: Record<string, Satir[]> = {}
    for (const da of DIZI_ALANLARI) {
      const ham = app[da.key]
      dz[da.key] = Array.isArray(ham) ? (ham as Satir[]).map((r) => ({ ...r })) : []
    }
    setDiziler(dz)

    const eh = app.educationHistory
    setEgitim(
      eh && typeof eh === 'object' && !Array.isArray(eh)
        ? Object.fromEntries(
            Object.entries(eh as Record<string, Satir>).map(([k, v]) => [k, { ...v }]),
          )
        : {},
    )
    setAlanHatalari([])
  }, [open, app, duzAlanlar])

  function hataMesaji(alan: string): string | undefined {
    return alanHatalari.find((h) => h.alan === alan)?.mesaj
  }

  async function kaydet() {
    setBusy(true)
    setAlanHatalari([])
    try {
      // Yalnız DEĞİŞENLER — gövde küçük kalsın, denetimde gürültü olmasın.
      const govde: Record<string, unknown> = {}
      for (const a of duzAlanlar) {
        const simdi = degerler[a.key] ?? ''
        if (simdi === formaCevir(app[a.key], a.tip)) continue
        govde[a.key] = gondermeyeCevir(simdi, a.tip)
      }
      for (const da of DIZI_ALANLARI) {
        const simdi = diziler[da.key] ?? []
        const onceki = Array.isArray(app[da.key]) ? app[da.key] : []
        if (JSON.stringify(simdi) !== JSON.stringify(onceki)) govde[da.key] = simdi
      }
      if (JSON.stringify(egitim) !== JSON.stringify(app.educationHistory ?? {})) {
        govde.educationHistory = egitim
      }

      if (Object.keys(govde).length === 0) {
        toast.info('Değişiklik yok')
        setBusy(false)
        return
      }

      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        if (Array.isArray(json?.alanHatalari)) setAlanHatalari(json.alanHatalari)
        throw new Error(json?.error || 'Kaydedilemedi')
      }
      toast.success(`${Object.keys(govde).length} alan güncellendi`)
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Başvuruyu Düzelt</DialogTitle>
          <DialogDescription>
            Yalnız aşağıdaki alanlar düzeltilebilir. KVKK onayı, sağlık beyanı, dijital imza,
            TC kimlik no ve başvuru durumu bu ekrandan DEĞİŞTİRİLEMEZ. Her değişiklik kim/ne
            zaman/eski-yeni değer olarak kaydedilir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {GRUPLAR.map((g) => (
            <div key={g.baslik}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {g.baslik}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {g.alanlar.map((a) => {
                  const hata = hataMesaji(a.key)
                  const ortak = {
                    value: degerler[a.key] ?? '',
                    onChange: (e: { target: { value: string } }) =>
                      setDegerler((p) => ({ ...p, [a.key]: e.target.value })),
                  }
                  return (
                    <div key={a.key} className={a.tip === 'uzunMetin' ? 'sm:col-span-2' : undefined}>
                      <Label className="text-xs">{ALAN_ETIKETLERI[a.key]}</Label>
                      {a.tip === 'uzunMetin' ? (
                        <Textarea {...ortak} rows={3} className="mt-1" />
                      ) : a.tip === 'bool' ? (
                        <select
                          {...ortak}
                          className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        >
                          <option value="">Belirtilmemiş</option>
                          <option value="true">Evet</option>
                          <option value="false">Hayır</option>
                        </select>
                      ) : a.tip === 'enum' ? (
                        <select
                          {...ortak}
                          className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        >
                          <option value="">Belirtilmemiş</option>
                          {Object.entries(a.secenekler ?? {}).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          {...ortak}
                          type={a.tip === 'tarih' ? 'date' : a.tip === 'sayi' ? 'number' : 'text'}
                          className="mt-1"
                        />
                      )}
                      {a.ipucu && !hata && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{a.ipucu}</p>
                      )}
                      {hata && <p className="text-[11px] text-red-600 mt-0.5">{hata}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Öğrenim geçmişi — kademeye göre anahtarlı; yeni kademe EKLENMEZ, mevcutlar düzeltilir */}
          {Object.keys(egitim).length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {ALAN_ETIKETLERI.educationHistory}
              </div>
              <div className="space-y-3">
                {Object.entries(egitim).map(([kademe, satir]) => (
                  <div key={kademe} className="rounded-md border p-3">
                    <div className="text-xs font-medium text-slate-600 mb-2">
                      {educationLevelLabels[kademe] ?? kademe}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {EGITIM_SUTUNLARI.map((s) => (
                        <div key={s.key}>
                          <Label className="text-[11px]">{s.label}</Label>
                          <Input
                            value={satir[s.key] ?? ''}
                            onChange={(e) =>
                              setEgitim((p) => ({
                                ...p,
                                [kademe]: { ...p[kademe], [s.key]: e.target.value },
                              }))
                            }
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Satır tabanlı alanlar — satır ekle/sil, sütunlar aday formuyla aynı */}
          {DIZI_ALANLARI.map((da) => (
            <div key={da.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {ALAN_ETIKETLERI[da.key]}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDiziler((p) => ({
                      ...p,
                      [da.key]: [
                        ...(p[da.key] ?? []),
                        Object.fromEntries(da.sutunlar.map((s) => [s.key, ''])),
                      ],
                    }))
                  }
                >
                  Satır ekle
                </Button>
              </div>
              {(diziler[da.key] ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">Kayıt yok</p>
              ) : (
                <div className="space-y-2">
                  {(diziler[da.key] ?? []).map((satir, i) => (
                    <div key={i} className="rounded-md border p-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {da.sutunlar.map((s) => (
                          <div key={s.key} className={s.genis ? 'sm:col-span-3' : undefined}>
                            <Label className="text-[11px]">{s.label}</Label>
                            <Input
                              value={satir[s.key] ?? ''}
                              onChange={(e) =>
                                setDiziler((p) => {
                                  const kopya = [...(p[da.key] ?? [])]
                                  kopya[i] = { ...kopya[i], [s.key]: e.target.value }
                                  return { ...p, [da.key]: kopya }
                                })
                              }
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 h-7"
                          onClick={() =>
                            setDiziler((p) => ({
                              ...p,
                              [da.key]: (p[da.key] ?? []).filter((_, j) => j !== i),
                            }))
                          }
                        >
                          Satırı sil
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={kaydet} disabled={busy} className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
