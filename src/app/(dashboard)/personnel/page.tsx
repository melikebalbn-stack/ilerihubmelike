"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { canAccessPersonnel } from "@/lib/auth/personnel-access"
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
import { Search, Plus, Download, Upload, Users, ChevronLeft, ChevronRight, Loader2, GraduationCap, Briefcase, ArrowUpDown, ArrowUp, ArrowDown, BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { BOLUMLER, YAKA_DETAYI_LABELS } from "@/lib/personnel-constants"

type Personnel = {
  id: string
  sicilNo: string
  sinif: string | null
  cinsiyet: string | null
  adSoyad: string
  yakaRengi: string | null
  yakaDetayi: string | null
  direktEndirekt: string | null
  asansorMekanik: string | null
  iseGirisTarihi: string | null
  denemeDegerlendirme: string | null
  altiAyDegerlendirme: string | null
  gorev: string | null
  bolumDetay: string | null
  bolum: string | null
  birimSorumlusu: string | null
  sorumlu2: string | null
  sorumlu3: string | null
  bolumMuduru: string | null
  telefon: string | null
  kanGrubu: string | null
  masrafMerkezi: string | null
  interKepMail: string | null
  mailAdresi: string | null
  ikametAdresi: string | null
  serviceRoute: string | null
  serviceStop: string | null
  emekli: boolean | null
  engelli: boolean | null
  egitimYeri: string | null
  egitimTipi: string | null
  egitimAlani: string | null
  mezuniyetYili: string | null
  ilkYardimciBelgesi: string | null
  kalfalikBelgesi: string | null
  ustalikBelgesi: string | null
  forkliftEhliyeti: boolean | null
  eTrans: boolean | null
  yanginSertifikasi: string | null
  ustaOgreticiBelgesi: boolean | null
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

// Erişim: src/lib/auth/personnel-access.ts (canAccessPersonnel) — tek kaynak.

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
  const [sortBy, setSortBy] = useState("adSoyad")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortDir("asc")
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
  }

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
      params.set("limit", String(pagination.limit))
      params.set("sortBy", sortBy)
      params.set("sortDir", sortDir)
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (bolum) params.set("bolum", bolum)
      if (yaka) params.set("yaka", yaka)
      if (durum) params.set("durum", durum)

      const res = await fetch(`/api/personnel?${params.toString()}`)
      if (!res.ok) throw new Error("Veriler yüklenemedi")
      const data = await res.json()
      setPersonnel(data.personnel || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
    } catch (err: any) {
      toast.error(err.message || "Personel listesi yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, debouncedSearch, bolum, yaka, durum, sortBy, sortDir])

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
              <option value="GRI">Gri Yaka</option>
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
              <Table className="text-[10px] [&_td]:py-1">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky left-0 bg-background z-10">#</TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("sicilNo")}><span className="flex items-center">Sicil No<SortIcon field="sicilNo" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("sinif")}><span className="flex items-center">Sınıf<SortIcon field="sinif" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("cinsiyet")}><span className="flex items-center">Cinsiyet<SortIcon field="cinsiyet" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("adSoyad")}><span className="flex items-center">Ad Soyad<SortIcon field="adSoyad" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("yakaRengi")}><span className="flex items-center">Yaka<SortIcon field="yakaRengi" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("direktEndirekt")}><span className="flex items-center">D/E<SortIcon field="direktEndirekt" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("asansorMekanik")}><span className="flex items-center">A/M<SortIcon field="asansorMekanik" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("iseGirisTarihi")}><span className="flex items-center">İşe Giriş<SortIcon field="iseGirisTarihi" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("denemeDegerlendirme")}><span className="flex items-center">Deneme Değ.<SortIcon field="denemeDegerlendirme" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("altiAyDegerlendirme")}><span className="flex items-center">6 Ay Değ.<SortIcon field="altiAyDegerlendirme" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("gorev")}><span className="flex items-center">Görev<SortIcon field="gorev" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("bolumDetay")}><span className="flex items-center">Bölüm/Detay<SortIcon field="bolumDetay" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("bolum")}><span className="flex items-center">Bölüm<SortIcon field="bolum" /></span></TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("birimSorumlusu")}><span className="flex items-center">1. Sorumlu<SortIcon field="birimSorumlusu" /></span></TableHead>
                    <TableHead className="whitespace-nowrap">2. Sorumlu</TableHead>
                    <TableHead className="whitespace-nowrap">3. Sorumlu</TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("bolumMuduru")}><span className="flex items-center">Bölüm Müdürü<SortIcon field="bolumMuduru" /></span></TableHead>
                    <TableHead className="whitespace-nowrap">Telefon</TableHead>
                    <TableHead className="whitespace-nowrap">Emekli</TableHead>
                    <TableHead className="whitespace-nowrap">Engelli</TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("egitimYeri")}><span className="flex items-center">Eğitim Yeri<SortIcon field="egitimYeri" /></span></TableHead>
                    <TableHead className="whitespace-nowrap">Eğitim Tipi</TableHead>
                    <TableHead className="whitespace-nowrap">Eğitim Alanı</TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("mezuniyetYili")}><span className="flex items-center">Mezuniyet Yılı<SortIcon field="mezuniyetYili" /></span></TableHead>
                    <TableHead className="whitespace-nowrap">KEP Adresi</TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("masrafMerkezi")}><span className="flex items-center">Masraf Merkezi<SortIcon field="masrafMerkezi" /></span></TableHead>
                    <TableHead className="whitespace-nowrap">Kan Grubu</TableHead>
                    <TableHead className="whitespace-nowrap">İkamet Adresi</TableHead>
                    <TableHead className="whitespace-nowrap">Mail Adresi</TableHead>
                    <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("serviceRoute")}><span className="flex items-center">Servis<SortIcon field="serviceRoute" /></span></TableHead>
                    <TableHead className="whitespace-nowrap">Durak Adı</TableHead>
                    <TableHead className="whitespace-nowrap">İlk Yardımcı</TableHead>
                    <TableHead className="whitespace-nowrap">Kalfalık</TableHead>
                    <TableHead className="whitespace-nowrap">Ustalık</TableHead>
                    <TableHead className="whitespace-nowrap">Forklift</TableHead>
                    <TableHead className="whitespace-nowrap">E.Transpalet</TableHead>
                    <TableHead className="whitespace-nowrap">Yangın Sert.</TableHead>
                    <TableHead className="whitespace-nowrap">Usta Öğretici</TableHead>
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
                        {(pagination.page - 1) * pagination.limit + idx + 1}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap ${!p.aktif ? "line-through" : ""}`}>
                        {p.sicilNo}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{p.sinif || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.cinsiyet === "MALE" ? "Erkek" : p.cinsiyet === "FEMALE" ? "Kadın" : "-"}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{p.adSoyad}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {p.yakaRengi === "MAVI" && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px]">Mavi</Badge>}
                          {p.yakaRengi === "BEYAZ" && <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px]">Beyaz</Badge>}
                          {p.yakaRengi === "GRI" && <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-[10px]">Gri</Badge>}
                          {!p.yakaRengi && "-"}
                          {p.yakaDetayi && p.yakaDetayi !== p.yakaRengi && (
                            <span className="text-[10px] text-muted-foreground">{YAKA_DETAYI_LABELS[p.yakaDetayi] ?? p.yakaDetayi}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.direktEndirekt === "DIREKT" && <Badge variant="outline" className="text-[10px]">D</Badge>}
                        {p.direktEndirekt === "ENDIREKT" && <Badge variant="secondary" className="text-[10px]">E</Badge>}
                        {!p.direktEndirekt && "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{p.asansorMekanik || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.iseGirisTarihi)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.denemeDegerlendirme)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.altiAyDegerlendirme)}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.gorev || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.bolumDetay || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.bolum || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.birimSorumlusu || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.sorumlu2 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.sorumlu3 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.bolumMuduru || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.telefon || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.emekli ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.engelli ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.egitimYeri || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.egitimTipi || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.egitimAlani || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.mezuniyetYili || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.interKepMail || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.masrafMerkezi || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.kanGrubu || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[200px] truncate" title={p.ikametAdresi || ""}>{p.ikametAdresi || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.mailAdresi || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.serviceRoute || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.serviceStop || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.ilkYardimciBelgesi ? new Date(p.ilkYardimciBelgesi).toLocaleDateString("tr-TR") : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.kalfalikBelgesi ? "Var" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.ustalikBelgesi ? "Var" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.forkliftEhliyeti ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.eTrans ? "Evet" : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.yanginSertifikasi ? new Date(p.yanginSertifikasi).toLocaleDateString("tr-TR") : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.ustaOgreticiBelgesi ? "Evet" : "-"}</TableCell>
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Toplam <strong>{pagination.total}</strong> kayıt
            {pagination.totalPages > 1 && <>, Sayfa {pagination.page} / {pagination.totalPages}</>}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Göster:</span>
            <Select
              value={String(pagination.limit)}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value)
                setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
              }}
              className="w-20 h-8 text-sm"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
            >
              İlk
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
              Önceki
            </Button>
            <span className="text-sm font-medium px-2">{pagination.page} / {pagination.totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.totalPages }))}
            >
              Son
            </Button>
          </div>
        )}
      </div>
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
  const isAdmin = canAccessPersonnel(userRole, userDept)

  const initialTab = searchParams.get("tab") || "personel"
  const [activeTab, setActiveTab] = useState(initialTab)

  // Tab counts
  const [personnelCount, setPersonnelCount] = useState<number>(0)
  const [internCount, setInternCount] = useState<number>(0)
  const [consultantCount, setConsultantCount] = useState<number>(0)

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [pRes, iRes, cRes] = await Promise.all([
          fetch("/api/personnel?limit=1&durum=AKTIF"),
          fetch("/api/interns/count"),
          fetch("/api/consultants/count"),
        ])
        if (pRes.ok) {
          const pData = await pRes.json()
          setPersonnelCount(pData.pagination?.total || pData.total || 0)
        }
        if (iRes.ok) {
          const iData = await iRes.json()
          setInternCount(iData.count ?? iData.total ?? 0)
        }
        if (cRes.ok) {
          const cData = await cRes.json()
          setConsultantCount(cData.count ?? cData.total ?? 0)
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
        <div className="flex items-center gap-2">
          <Link href="/personnel/reports">
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
          </Link>
          {isAdmin && (
            <Link href={currentNew.href}>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>{currentNew.label}</span>
              </Button>
            </Link>
          )}
        </div>
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
