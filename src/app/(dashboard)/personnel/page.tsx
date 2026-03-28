"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { NativeSelect as Select } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Plus, Download, Upload, Users, ChevronLeft, ChevronRight, Loader2, GraduationCap, Briefcase } from "lucide-react"
import { toast } from "sonner"
import { BOLUMLER } from "@/lib/personnel-constants"

type Personnel = {
  id: string
  sicilNo: string
  sinif: string | null
  cinsiyet: string | null
  adSoyad: string
  yakaRengi: string | null
  direktEndirekt: string | null
  asansorMekanik: string | null
  iseGirisTarihi: string | null
  gorev: string | null
  bolumDetay: string | null
  bolum: string | null
  birimSorumlusu: string | null
  bolumMuduru: string | null
  masrafMerkezi: string | null
  interKepMail: string | null
  telefon: string | null
  kanGrubu: string | null
  egitimYeri: string | null
  egitimTipi: string | null
  egitimAlani: string | null
  mezuniyetYili: string | null
  mykUstalikKalfalik: boolean | null
  ilkYardimci: boolean | null
  emekli: boolean | null
  engelli: boolean | null
  serviceRoute: string | null
  serviceStop: string | null
  denemeDegerlendirme: string | null
  altiAyDegerlendirme: string | null
  aktif: boolean
}

type Intern = {
  id: string
  adSoyad: string
  telefon: string | null
  bolum: string
  stajSorumlusu: string | null
  baslangicTarihi: string | null
  bitisTarihi: string | null
  okul: string | null
  aktif: boolean
}

type Consultant = {
  id: string
  adSoyad: string
  telefon: string | null
  email: string | null
  bolum: string | null
  uzmanlikAlani: string | null
  sozlesmeBaslangic: string | null
  sozlesmeBitis: string | null
  aktif: boolean
}

type PaginationInfo = {
  page: number
  limit: number
  total: number
  totalPages: number
}

const ADMIN_ROLES = ["ADMIN", "HR_MANAGER", "SUPER_ADMIN"]

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-"
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR")
  } catch {
    return "-"
  }
}

// ── Personnel Tab ──
function PersonnelTab({ isAdmin }: { isAdmin: boolean }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [bolum, setBolum] = useState("")
  const [yaka, setYaka] = useState("")
  const [durum, setDurum] = useState("AKTIF")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchPersonnel = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("page", String(pagination.page))
      params.set("limit", "25")
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (bolum) params.set("bolum", bolum)
      if (yaka) params.set("yaka", yaka)
      if (durum && durum !== "TUMU") params.set("durum", durum)

      const res = await fetch(`/api/personnel?${params.toString()}`)
      if (!res.ok) throw new Error("Veriler yüklenemedi")
      const data = await res.json()
      setPersonnel(data.personnel || data.data || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
    } catch (err: any) {
      toast.error(err.message || "Personel listesi yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [pagination.page, debouncedSearch, bolum, yaka, durum])

  useEffect(() => {
    fetchPersonnel()
  }, [fetchPersonnel])

  const handleExport = async () => {
    try {
      const res = await fetch("/api/personnel/export")
      if (!res.ok) throw new Error("Export hatası")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `personel_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Excel dosyası indirildi")
    } catch (err: any) {
      toast.error(err.message || "Export başarısız")
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ad, sicil no, görev ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={bolum} onChange={(e) => { setBolum(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}>
              <option value="">Tüm Bölümler</option>
              {BOLUMLER.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
            <Select value={yaka} onChange={(e) => { setYaka(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}>
              <option value="">Tümü (Yaka)</option>
              <option value="MAVI">Mavi Yaka</option>
              <option value="BEYAZ">Beyaz Yaka</option>
            </Select>
            <Select value={durum} onChange={(e) => { setDurum(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}>
              <option value="AKTIF">Aktif</option>
              <option value="PASIF">Pasif</option>
              <option value="TUMU">Tümü</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      {isAdmin && (
        <div className="flex items-center gap-3 justify-end">
          <Link href="/personnel/import">
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Excel Import</span>
            </Button>
          </Link>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            <span>Excel İndir</span>
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : personnel.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="h-12 w-12 mb-3" />
              <p>Personel bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky left-0 bg-background z-10">#</TableHead>
                    <TableHead className="whitespace-nowrap">Sicil No</TableHead>
                    <TableHead className="whitespace-nowrap">Sınıf</TableHead>
                    <TableHead className="whitespace-nowrap">Cinsiyet</TableHead>
                    <TableHead className="whitespace-nowrap">Ad Soyad</TableHead>
                    <TableHead className="whitespace-nowrap">Yaka</TableHead>
                    <TableHead className="whitespace-nowrap">D/E</TableHead>
                    <TableHead className="whitespace-nowrap">A/M</TableHead>
                    <TableHead className="whitespace-nowrap">Servis</TableHead>
                    <TableHead className="whitespace-nowrap">İşe Giriş</TableHead>
                    <TableHead className="whitespace-nowrap">Servis Durağı</TableHead>
                    <TableHead className="whitespace-nowrap">Görev</TableHead>
                    <TableHead className="whitespace-nowrap">Bölüm Detay</TableHead>
                    <TableHead className="whitespace-nowrap">Bölüm</TableHead>
                    <TableHead className="whitespace-nowrap">Birim Sorumlusu</TableHead>
                    <TableHead className="whitespace-nowrap">Bölüm Müdürü</TableHead>
                    <TableHead className="whitespace-nowrap">Masraf Merkezi</TableHead>
                    <TableHead className="whitespace-nowrap">İnter/Kep Mail</TableHead>
                    <TableHead className="whitespace-nowrap">Telefon</TableHead>
                    <TableHead className="whitespace-nowrap">Kan Grubu</TableHead>
                    <TableHead className="whitespace-nowrap">Eğitim Yeri</TableHead>
                    <TableHead className="whitespace-nowrap">Eğitim Tipi</TableHead>
                    <TableHead className="whitespace-nowrap">Eğitim Alanı</TableHead>
                    <TableHead className="whitespace-nowrap">Mezuniyet Yılı</TableHead>
                    <TableHead className="whitespace-nowrap">MYK</TableHead>
                    <TableHead className="whitespace-nowrap">İlk Yardımcı</TableHead>
                    <TableHead className="whitespace-nowrap">Emekli</TableHead>
                    <TableHead className="whitespace-nowrap">Engelli</TableHead>
                    <TableHead className="whitespace-nowrap">Deneme Değ.</TableHead>
                    <TableHead className="whitespace-nowrap">6 Ay Değ.</TableHead>
                    <TableHead className="text-right whitespace-nowrap sticky right-0 bg-background z-10">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnel.map((p, idx) => (
                    <TableRow
                      key={p.id}
                      className={!p.aktif ? "opacity-60" : undefined}
                    >
                      <TableCell className="text-muted-foreground text-xs sticky left-0 bg-background z-10">
                        {(pagination.page - 1) * 25 + idx + 1}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap ${!p.aktif ? "line-through" : ""}`}>
                        {p.sicilNo}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{p.sinif || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.cinsiyet || "-"}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{p.adSoyad}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.yakaRengi === "MAVI" && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Mavi</Badge>
                        )}
                        {p.yakaRengi === "BEYAZ" && (
                          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Beyaz</Badge>
                        )}
                        {!p.yakaRengi && "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.direktEndirekt === "DIREKT" && (
                          <Badge variant="outline">D</Badge>
                        )}
                        {p.direktEndirekt === "ENDIREKT" && (
                          <Badge variant="secondary">E</Badge>
                        )}
                        {!p.direktEndirekt && "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{p.asansorMekanik || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.serviceRoute || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.iseGirisTarihi)}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.serviceStop || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.gorev || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.bolumDetay || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.bolum || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.birimSorumlusu || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.bolumMuduru || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.masrafMerkezi || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.interKepMail || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.telefon || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.kanGrubu || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.egitimYeri || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.egitimTipi || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.egitimAlani || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.mezuniyetYili || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.mykUstalikKalfalik ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.ilkYardimci ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.emekli ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.engelli ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[150px] truncate" title={p.denemeDegerlendirme || ""}>{p.denemeDegerlendirme || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[150px] truncate" title={p.altiAyDegerlendirme || ""}>{p.altiAyDegerlendirme || "-"}</TableCell>
                      <TableCell className="text-right sticky right-0 bg-background z-10">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/personnel/${p.id}`}>Detay</Link>
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/personnel/${p.id}?edit=true`}>Düzenle</Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Toplam {pagination.total} kayıt, Sayfa {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Intern Tab ──
function InternTab({ isAdmin }: { isAdmin: boolean }) {
  const [interns, setInterns] = useState<Intern[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const fetchInterns = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        params.set("aktif", "true")
        if (debouncedSearch) params.set("search", debouncedSearch)
        const res = await fetch(`/api/interns?${params.toString()}`)
        if (!res.ok) throw new Error("Veriler yüklenemedi")
        const data = await res.json()
        setInterns(data.interns || data.data || [])
      } catch (err: any) {
        toast.error(err.message || "Stajyer listesi yüklenemedi")
      } finally {
        setLoading(false)
      }
    }
    fetchInterns()
  }, [debouncedSearch])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ad, okul, bölüm ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : interns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mb-3" />
              <p>Stajyer bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Bölüm</TableHead>
                    <TableHead>Okul</TableHead>
                    <TableHead>Staj Sorumlusu</TableHead>
                    <TableHead>Başlangıç</TableHead>
                    <TableHead>Bitiş</TableHead>
                    <TableHead>Telefon</TableHead>
                    {isAdmin && <TableHead className="text-right">İşlemler</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interns.map((s, idx) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{s.adSoyad}</TableCell>
                      <TableCell>{s.bolum}</TableCell>
                      <TableCell>{s.okul || "-"}</TableCell>
                      <TableCell>{s.stajSorumlusu || "-"}</TableCell>
                      <TableCell>{formatDate(s.baslangicTarihi)}</TableCell>
                      <TableCell>{formatDate(s.bitisTarihi)}</TableCell>
                      <TableCell>{s.telefon || "-"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/personnel/interns/${s.id}`}>Detay</Link>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Consultant Tab ──
function ConsultantTab({ isAdmin }: { isAdmin: boolean }) {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const fetchConsultants = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        params.set("aktif", "true")
        if (debouncedSearch) params.set("search", debouncedSearch)
        const res = await fetch(`/api/consultants?${params.toString()}`)
        if (!res.ok) throw new Error("Veriler yüklenemedi")
        const data = await res.json()
        setConsultants(data.consultants || data.data || [])
      } catch (err: any) {
        toast.error(err.message || "Danışman listesi yüklenemedi")
      } finally {
        setLoading(false)
      }
    }
    fetchConsultants()
  }, [debouncedSearch])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ad, uzmanlık alanı ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : consultants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Briefcase className="h-12 w-12 mb-3" />
              <p>Danışman bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Bölüm</TableHead>
                    <TableHead>Uzmanlık Alanı</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Sözleşme Başlangıç</TableHead>
                    <TableHead>Sözleşme Bitiş</TableHead>
                    <TableHead>Telefon</TableHead>
                    {isAdmin && <TableHead className="text-right">İşlemler</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consultants.map((d, idx) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{d.adSoyad}</TableCell>
                      <TableCell>{d.bolum || "-"}</TableCell>
                      <TableCell>{d.uzmanlikAlani || "-"}</TableCell>
                      <TableCell>{d.email || "-"}</TableCell>
                      <TableCell>{formatDate(d.sozlesmeBaslangic)}</TableCell>
                      <TableCell>{formatDate(d.sozlesmeBitis)}</TableCell>
                      <TableCell>{d.telefon || "-"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/personnel/consultants/${d.id}`}>Detay</Link>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Page ──
export default function PersonnelPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userRole = session?.user?.role as string
  const userDept = (session?.user as any)?.department as string | undefined
  const isAdmin = ADMIN_ROLES.includes(userRole) || isHRDepartment(userDept)

  const initialTab = searchParams.get("tab") || "personel"
  const [activeTab, setActiveTab] = useState(initialTab)

  // Tab counts
  const [personnelCount, setPersonnelCount] = useState<number>(0)
  const [internCount, setInternCount] = useState<number>(0)
  const [consultantCount, setConsultantCount] = useState<number>(0)

  useEffect(() => {
    // Fetch counts for tab badges
    const fetchCounts = async () => {
      try {
        const [pRes, iRes, cRes] = await Promise.all([
          fetch("/api/personnel?limit=1&durum=AKTIF"),
          fetch("/api/interns/count"),
          fetch("/api/consultants/count"),
        ])
        if (pRes.ok) {
          const pData = await pRes.json()
          setPersonnelCount(pData.pagination?.total || 0)
        }
        if (iRes.ok) {
          const iData = await iRes.json()
          setInternCount(iData.count || 0)
        }
        if (cRes.ok) {
          const cData = await cRes.json()
          setConsultantCount(cData.count || 0)
        }
      } catch {
        // ignore count errors
      }
    }
    fetchCounts()
  }, [])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", value)
    router.replace(url.pathname + url.search, { scroll: false })
  }

  const newButtonConfig: Record<string, { label: string; href: string }> = {
    personel: { label: "Yeni Personel", href: "/personnel/new" },
    stajyer: { label: "Yeni Stajyer", href: "/personnel/interns/new" },
    danisman: { label: "Yeni Danışman", href: "/personnel/consultants/new" },
  }

  const currentNew = newButtonConfig[activeTab] || newButtonConfig.personel

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Personel Yönetimi</h1>
        </div>
        {isAdmin && (
          <Link href={currentNew.href}>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>{currentNew.label}</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="personel" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Personeller</span>
            <Badge variant="secondary" className="ml-1 text-xs">{personnelCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="stajyer" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>Stajyerler</span>
            <Badge variant="secondary" className="ml-1 text-xs">{internCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="danisman" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span>Danışmanlar</span>
            <Badge variant="secondary" className="ml-1 text-xs">{consultantCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personel">
          <PersonnelTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="stajyer">
          <InternTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="danisman">
          <ConsultantTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
