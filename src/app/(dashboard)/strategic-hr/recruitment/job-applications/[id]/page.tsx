"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Briefcase,
  GraduationCap,
  Shield,
  Globe,
  Monitor,
  Users,
  CheckCircle2,
  Trash2,
  Printer,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

const jobAppStatusLabels: Record<string, string> = {
  PENDING: "Beklemede",
  REVIEWING: "Inceleniyor",
  SHORTLISTED: "On Eleme",
  INTERVIEW: "Mulakat",
  ACCEPTED: "Kabul Edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri Cekildi",
}

const jobAppStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  SHORTLISTED: "bg-purple-100 text-purple-800",
  INTERVIEW: "bg-indigo-100 text-indigo-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-800",
}

const educationLevelLabels: Record<string, string> = {
  PRIMARY_SCHOOL: "Ilkogretim",
  HIGH_SCHOOL: "Lise",
  ASSOCIATE: "Onlisans",
  BACHELOR: "Lisans",
  MASTER: "Yuksek Lisans",
  DOCTORATE: "Doktora",
}

const genderLabels: Record<string, string> = {
  MALE: "Bay",
  FEMALE: "Bayan",
}

const referralSourceLabels: Record<string, string> = {
  AGENCY: "Araci Kurum",
  ISKUR: "IS-KUR",
  WEBSITE: "Web Sitesi",
  REFERENCE: "Referans",
  OTHER: "Diger",
}

const militaryStatusLabels: Record<string, string> = {
  COMPLETED: "Tamamlandi",
  DEFERRED: "Tecilli",
  EXEMPT: "Muaf",
  NOT_APPLICABLE: "Uygulanamaz",
}

const maritalStatusLabels: Record<string, string> = {
  SINGLE: "Bekar",
  MARRIED: "Evli",
  DIVORCED: "Bosanmis",
  WIDOWED: "Dul",
}

const bloodTypeLabels: Record<string, string> = {
  A_POSITIVE: "A Rh+",
  A_NEGATIVE: "A Rh-",
  B_POSITIVE: "B Rh+",
  B_NEGATIVE: "B Rh-",
  AB_POSITIVE: "AB Rh+",
  AB_NEGATIVE: "AB Rh-",
  O_POSITIVE: "0 Rh+",
  O_NEGATIVE: "0 Rh-",
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null
  return (
    <tr className="border-b border-gray-200 print:border-gray-300">
      <td className="py-1.5 pr-4 text-sm text-muted-foreground print:text-gray-500 whitespace-nowrap align-top" style={{ width: "180px" }}>{label}</td>
      <td className="py-1.5 text-sm font-medium print:text-black">{value}</td>
    </tr>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold border-b-2 border-primary print:border-black pb-1 mb-3 print:text-black">
      <Icon className="h-4 w-4" />
      {title}
    </h2>
  )
}

export default function JobApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [app, setApp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const id = params.id as string

  useEffect(() => {
    if (id) fetchDetail()
  }, [id])

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`)
      if (res.ok) {
        const data = await res.json()
        setApp(data)
      } else {
        toast.error("Basvuru bulunamadi")
        router.push("/strategic-hr/recruitment")
      }
    } catch {
      toast.error("Basvuru yuklenirken hata olustu")
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setApp({ ...app, status: newStatus })
        toast.success("Durum guncellendi")
      } else {
        const err = await res.json()
        toast.error(err.error || "Durum guncellenemedi")
      }
    } catch {
      toast.error("Bir hata olustu")
    }
  }

  const handleNotesUpdate = async (notes: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) toast.success("Notlar kaydedildi")
    } catch {
      toast.error("Notlar kaydedilemedi")
    }
  }

  const handleDelete = async () => {
    if (!confirm("Bu basvuruyu silmek istediginizden emin misiniz?")) return
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Basvuru silindi")
        router.push("/strategic-hr/recruitment")
      } else {
        const err = await res.json()
        toast.error(err.error || "Silinemedi")
      }
    } catch {
      toast.error("Bir hata olustu")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!app) return null

  const educationHistory = app.educationHistory as any[] | null
  const workExperience = app.workExperience as any[] | null
  const foreignLanguages = app.foreignLanguages as any[] | null
  const computerSkills = app.computerSkills as any[] | null
  const coursesAndSeminars = app.coursesAndSeminars as any[] | null
  const references = app.references as any[] | null

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except print content */
          body > * { visibility: hidden !important; }

          /* Layout resets */
          nav, header, aside, footer,
          [data-sidebar], .sidebar,
          [class*="BottomNav"], [class*="bottom-nav"] {
            display: none !important;
          }

          /* Make main content full width */
          .flex.h-screen { display: block !important; height: auto !important; overflow: visible !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          main { overflow: visible !important; padding: 0 !important; height: auto !important; }

          /* Show print area */
          #cv-print-area, #cv-print-area * { visibility: visible !important; }
          #cv-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
          }

          /* Page setup */
          @page {
            size: A4;
            margin: 12mm 15mm;
          }

          /* Section breaks */
          .cv-section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 8px !important;
          }

          /* Table styling for print */
          .cv-section table {
            width: 100% !important;
          }

          /* Colors */
          .print\\:text-black { color: black !important; }
          .print\\:text-gray-500 { color: #666 !important; }
          .print\\:border-black { border-color: black !important; }
          .print\\:border-gray-300 { border-color: #ccc !important; }

          /* Hide no-print elements */
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Screen-only header with buttons */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/strategic-hr/recruitment")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{app.fullName}</h1>
              <Badge className={jobAppStatusColors[app.status] || "bg-gray-100 text-gray-800"}>
                {jobAppStatusLabels[app.status] || app.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Basvuru No: {app.applicationNumber} | {format(new Date(app.createdAt), "d MMMM yyyy HH:mm", { locale: tr })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Yazdir
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Sil
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - printable */}
        <div className="lg:col-span-2" id="cv-print-area">
          {/* Print header - only visible when printing */}
          <div className="hidden print:block mb-4" style={{ borderBottom: "2px solid black", paddingBottom: "8px" }}>
            <div className="flex items-start justify-between">
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "2px" }}>{app.fullName}</h1>
                <p style={{ fontSize: "11px", color: "#666" }}>
                  Basvuru No: {app.applicationNumber} | Tarih: {format(new Date(app.createdAt), "d MMMM yyyy", { locale: tr })}
                </p>
                {app.requestedPosition && (
                  <p style={{ fontSize: "12px", fontWeight: "600", marginTop: "2px" }}>
                    Pozisyon: {app.requestedPosition}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right", fontSize: "11px", color: "#666" }}>
                {app.mobilePhone && <div>Tel: {app.mobilePhone}</div>}
                {app.email && <div>{app.email}</div>}
                <div style={{ marginTop: "4px" }}>
                  <strong>Durum: {jobAppStatusLabels[app.status] || app.status}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 print:space-y-2">
            {/* Kisisel Bilgiler */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={User} title="Kisisel Bilgiler" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Ad Soyad" value={app.fullName} />
                      <InfoRow label="Dogum Yeri" value={app.birthPlace} />
                      <InfoRow label="Dogum Tarihi" value={app.birthDate ? format(new Date(app.birthDate), "d MMMM yyyy", { locale: tr }) : null} />
                      <InfoRow label="T.C. Kimlik No" value={app.tcKimlikNo} />
                      <InfoRow label="Uyruk" value={app.nationality} />
                      <InfoRow label="Cinsiyet" value={app.gender ? genderLabels[app.gender] || app.gender : null} />
                      <InfoRow label="Kan Grubu" value={app.bloodType ? bloodTypeLabels[app.bloodType] || app.bloodType : null} />
                      <InfoRow label="Medeni Durum" value={app.maritalStatus ? maritalStatusLabels[app.maritalStatus] || app.maritalStatus : null} />
                      <InfoRow label="Cocuk Sayisi" value={app.numberOfChildren} />
                      <InfoRow label="Es Calisiyor mu?" value={app.spouseWorking === true ? "Evet" : app.spouseWorking === false ? "Hayir" : null} />
                      <InfoRow label="Esin Meslegi" value={app.spouseOccupation} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Iletisim */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Phone} title="Iletisim Bilgileri" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Cep Telefonu" value={app.mobilePhone} />
                      <InfoRow label="Is Telefonu" value={app.workPhone} />
                      <InfoRow label="Ev Telefonu" value={app.homePhone} />
                      <InfoRow label="E-posta" value={app.email} />
                      <InfoRow label="Ev Adresi" value={app.homeAddress} />
                      <InfoRow label="Bakmakla Yukumlu" value={app.dependents} />
                      <InfoRow label="Bize Nasil Ulasti" value={app.referralSource ? referralSourceLabels[app.referralSource] || app.referralSource : null} />
                      {app.referralSourceOther && <InfoRow label="Kaynak Detay" value={app.referralSourceOther} />}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Askerlik ve Ehliyet */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Shield} title="Askerlik ve Ehliyet" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Askerlik Durumu" value={app.militaryStatus ? militaryStatusLabels[app.militaryStatus] || app.militaryStatus : null} />
                      <InfoRow label="Tecil Tarihi" value={app.militaryPostponeDate ? format(new Date(app.militaryPostponeDate), "d MMMM yyyy", { locale: tr }) : null} />
                      <InfoRow label="Surucu Belgesi" value={app.hasDriverLicense === true ? "Var" : app.hasDriverLicense === false ? "Yok" : null} />
                      <InfoRow label="Ehliyet Sinifi" value={app.driverLicenseClass} />
                      <InfoRow label="Ehliyet Tarihi" value={app.driverLicenseDate ? format(new Date(app.driverLicenseDate), "d MMMM yyyy", { locale: tr }) : null} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Is Tercihleri */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Briefcase} title="Is Tercihleri" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Talep Edilen Pozisyon" value={app.requestedPosition} />
                      <InfoRow label="Beklenen Maas" value={app.expectedSalary ? `${app.expectedSalary.toLocaleString()} TL` : null} />
                      <InfoRow label="Ise Baslama Tarihi" value={app.availableStartDate ? format(new Date(app.availableStartDate), "d MMMM yyyy", { locale: tr }) : null} />
                      <InfoRow label="Daha Once Calisti mi?" value={app.previouslyWorkedHere === true ? "Evet" : app.previouslyWorkedHere === false ? "Hayir" : null} />
                      <InfoRow label="Seyahat Engeli" value={app.hasTravelRestriction === true ? "Var" : app.hasTravelRestriction === false ? "Yok" : null} />
                      <InfoRow label="Vardiyali Calisabilir" value={app.canWorkShifts === true ? "Evet" : app.canWorkShifts === false ? "Hayir" : null} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Egitim Durumu */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={GraduationCap} title="Egitim Durumu" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="En Yuksek Egitim" value={app.educationLevel ? educationLevelLabels[app.educationLevel] || app.educationLevel : null} />
                    </tbody>
                  </table>
                  {educationHistory && educationHistory.length > 0 && (
                    <div className="mt-3 print:mt-1">
                      <h4 className="text-sm font-semibold mb-2 print:text-black">Egitim Gecmisi</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 font-semibold print:text-black">Okul</th>
                            <th className="text-left py-1 font-semibold print:text-black">Bolum</th>
                            <th className="text-left py-1 font-semibold print:text-black">Seviye</th>
                            <th className="text-left py-1 font-semibold print:text-black">Mezuniyet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {educationHistory.map((edu: any, i: number) => (
                            <tr key={i} className="border-b border-gray-200">
                              <td className="py-1 print:text-black">{edu.schoolName || edu.institution}</td>
                              <td className="py-1 print:text-black">{edu.department || "-"}</td>
                              <td className="py-1 print:text-black">{edu.level ? educationLevelLabels[edu.level] || edu.level : "-"}</td>
                              <td className="py-1 print:text-black">{edu.graduationYear || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Is Tecrubesi */}
            {workExperience && workExperience.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Briefcase} title="Is Tecrubesi" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Firma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Pozisyon</th>
                          <th className="text-left py-1 font-semibold print:text-black">Baslangic</th>
                          <th className="text-left py-1 font-semibold print:text-black">Bitis</th>
                          <th className="text-left py-1 font-semibold print:text-black">Ayrilma Nedeni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workExperience.map((exp: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{exp.company}</td>
                            <td className="py-1 print:text-black">{exp.position}</td>
                            <td className="py-1 print:text-black">{exp.startDate || "-"}</td>
                            <td className="py-1 print:text-black">{exp.endDate || "-"}</td>
                            <td className="py-1 print:text-black">{exp.leavingReason || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Yabanci Dil */}
            {foreignLanguages && foreignLanguages.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Globe} title="Yabanci Dil Bilgisi" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Dil</th>
                          <th className="text-left py-1 font-semibold print:text-black">Okuma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Yazma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Konusma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Ogrendigi Yer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foreignLanguages.map((lang: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{lang.language}</td>
                            <td className="py-1 print:text-black">{lang.reading || "-"}</td>
                            <td className="py-1 print:text-black">{lang.writing || "-"}</td>
                            <td className="py-1 print:text-black">{lang.speaking || "-"}</td>
                            <td className="py-1 print:text-black">{lang.learnedAt || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Bilgisayar Bilgisi */}
            {computerSkills && computerSkills.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Monitor} title="Bilgisayar Bilgisi" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Program</th>
                          <th className="text-left py-1 font-semibold print:text-black">Seviye</th>
                          <th className="text-left py-1 font-semibold print:text-black">Ogrendigi Yer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computerSkills.map((skill: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{skill.program}</td>
                            <td className="py-1 print:text-black">{skill.level || "-"}</td>
                            <td className="py-1 print:text-black">{skill.learnedAt || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Kurslar ve Seminerler */}
            {coursesAndSeminars && coursesAndSeminars.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={GraduationCap} title="Kurslar ve Seminerler" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Kurum</th>
                          <th className="text-left py-1 font-semibold print:text-black">Konu</th>
                          <th className="text-left py-1 font-semibold print:text-black">Sure</th>
                          <th className="text-left py-1 font-semibold print:text-black">Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coursesAndSeminars.map((course: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{course.institution}</td>
                            <td className="py-1 print:text-black">{course.subject}</td>
                            <td className="py-1 print:text-black">{course.duration || "-"}</td>
                            <td className="py-1 print:text-black">{course.attendanceDate || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Referanslar */}
            {references && references.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Users} title="Referanslar" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Ad Soyad</th>
                          <th className="text-left py-1 font-semibold print:text-black">Firma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Pozisyon</th>
                          <th className="text-left py-1 font-semibold print:text-black">Telefon</th>
                        </tr>
                      </thead>
                      <tbody>
                        {references.map((ref: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{ref.name}</td>
                            <td className="py-1 print:text-black">{ref.company || "-"}</td>
                            <td className="py-1 print:text-black">{ref.position || "-"}</td>
                            <td className="py-1 print:text-black">{ref.phone || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Diger Bilgiler */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Shield} title="Diger Bilgiler" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Adli Sicil Kaydi" value={app.hasCriminalRecord === true ? "Var" : app.hasCriminalRecord === false ? "Yok" : null} />
                      <InfoRow label="Hukum Giydi mi?" value={app.hasConviction === true ? "Evet" : app.hasConviction === false ? "Hayir" : null} />
                      <InfoRow label="Dava Detayi" value={app.convictionDetails} />
                      <InfoRow label="Devam Eden Dava" value={app.hasOngoingCase === true ? "Var" : app.hasOngoingCase === false ? "Yok" : null} />
                      <InfoRow label="Boy (cm)" value={app.height} />
                      <InfoRow label="Kilo (kg)" value={app.weight} />
                      <InfoRow label="Ayakkabi No" value={app.shoeSize} />
                      <InfoRow label="Ust Beden" value={app.clothingSizeUpper} />
                      <InfoRow label="Alt Beden" value={app.clothingSizeLower} />
                      <InfoRow label="Hobiler" value={app.hobbies} />
                      <InfoRow label="Uyelikler" value={app.memberships} />
                      <InfoRow label="Firmada Akraba/Tanidik" value={app.hasRelativesInCompany === true ? `Evet - ${app.relativeName || ""}` : app.hasRelativesInCompany === false ? "Hayir" : null} />
                      <InfoRow label="Son Isveren Temasi" value={app.canContactLastEmployer === true ? "Evet" : app.canContactLastEmployer === false ? "Hayir" : null} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Dijital Imza — PR-JOBAPP-ADMIN-SIGNATURE: backward-compat */}
            {app.digitalSignature && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardContent className="pt-6 print:p-0 print:pt-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 print:bg-transparent print:border-gray-400 print:p-2">
                      <div className="flex items-center gap-2 text-green-700 print:text-black">
                        <CheckCircle2 className="w-5 h-5 print:w-4 print:h-4" />
                        <span className="font-medium">Dijital Imza</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1 print:text-black">
                        {app.fullName} tarafindan {app.signatureDate} tarihinde dijital olarak imzalanmistir.
                      </p>
                      {/* PR-JOBAPP-RENDERER sonrası canvas pad PNG; öncesinde "Name|date|ts" string */}
                      {app.digitalSignature.startsWith('data:image') ? (
                        <div className="mt-3 inline-block bg-white border border-slate-200 rounded p-2 print:border-gray-400">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={app.digitalSignature}
                            alt="Dijital imza"
                            className="max-w-[400px] max-h-[150px] object-contain"
                          />
                        </div>
                      ) : (
                        <div className="mt-3 text-xs font-mono text-slate-600 border border-slate-200 rounded p-2 bg-slate-50 print:bg-transparent print:border-gray-400 print:text-black break-all">
                          {app.digitalSignature}
                          <div className="text-[10px] text-slate-400 mt-1 print:text-gray-500">
                            (eski format başvuru)
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Right column - screen only */}
        <div className="space-y-6 no-print">
          {/* Fotograf */}
          {app.photoUrl && (
            <Card>
              <CardContent className="pt-6 flex justify-center">
                <img
                  src={app.photoUrl}
                  alt={app.fullName}
                  className="w-48 h-48 object-cover rounded-lg border"
                />
              </CardContent>
            </Card>
          )}

          {/* Durum ve Notlar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Durum Yonetimi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Durum Degistir</Label>
                <Select value={app.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Beklemede</SelectItem>
                    <SelectItem value="REVIEWING">Inceleniyor</SelectItem>
                    <SelectItem value="SHORTLISTED">On Eleme</SelectItem>
                    <SelectItem value="INTERVIEW">Mulakat</SelectItem>
                    <SelectItem value="ACCEPTED">Kabul Edildi</SelectItem>
                    <SelectItem value="REJECTED">Reddedildi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>IK Notlari</Label>
                <Textarea
                  defaultValue={app.notes || ""}
                  placeholder="Bu basvuru hakkinda notlariniz..."
                  rows={5}
                  onBlur={(e) => handleNotesUpdate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ozet Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hizli Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {app.mobilePhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${app.mobilePhone}`} className="text-blue-600 hover:underline">{app.mobilePhone}</a>
                </div>
              )}
              {app.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${app.email}`} className="text-blue-600 hover:underline">{app.email}</a>
                </div>
              )}
              {app.requestedPosition && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{app.requestedPosition}</span>
                </div>
              )}
              {app.educationLevel && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span>{educationLevelLabels[app.educationLevel] || app.educationLevel}</span>
                </div>
              )}
              {app.expectedSalary && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">TL</span>
                  <span>{app.expectedSalary.toLocaleString()} TL</span>
                </div>
              )}
              {app.referralSource && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Kaynak:</span>
                  <span>{referralSourceLabels[app.referralSource] || app.referralSource}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
