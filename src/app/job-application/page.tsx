"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

// Enum değerleri
const GENDER_OPTIONS = [
  { value: "MALE", label: "Bay" },
  { value: "FEMALE", label: "Bayan" },
]

const BLOOD_TYPE_OPTIONS = [
  { value: "A_POSITIVE", label: "A Rh+" },
  { value: "A_NEGATIVE", label: "A Rh-" },
  { value: "B_POSITIVE", label: "B Rh+" },
  { value: "B_NEGATIVE", label: "B Rh-" },
  { value: "AB_POSITIVE", label: "AB Rh+" },
  { value: "AB_NEGATIVE", label: "AB Rh-" },
  { value: "O_POSITIVE", label: "0 Rh+" },
  { value: "O_NEGATIVE", label: "0 Rh-" },
]

const MILITARY_STATUS_OPTIONS = [
  { value: "COMPLETED", label: "Yaptı" },
  { value: "NOT_DONE", label: "Yapmadı" },
  { value: "EXEMPT", label: "Muaf" },
  { value: "POSTPONED", label: "Tecilli" },
]

const MARITAL_STATUS_OPTIONS = [
  { value: "SINGLE", label: "Bekar" },
  { value: "MARRIED", label: "Evli" },
  { value: "DIVORCED", label: "Boşanmış" },
  { value: "WIDOWED", label: "Dul" },
]

const REFERRAL_SOURCE_OPTIONS = [
  { value: "AGENCY", label: "Aracı Kurum" },
  { value: "ISKUR", label: "İŞ-KUR" },
  { value: "WEBSITE", label: "Web Sitesi" },
  { value: "REFERENCE", label: "Referans" },
  { value: "OTHER", label: "Diğer" },
]

const EDUCATION_LEVEL_OPTIONS = [
  { value: "PRIMARY_SCHOOL", label: "İlköğretim" },
  { value: "HIGH_SCHOOL", label: "Lise" },
  { value: "ASSOCIATE", label: "Önlisans" },
  { value: "BACHELOR", label: "Lisans" },
  { value: "MASTER", label: "Yüksek Lisans / Lüstü" },
  { value: "DOCTORATE", label: "Doktora" },
]

const EDUCATION_TYPES = [
  { key: "primarySchool", label: "İlköğretim" },
  { key: "highSchool", label: "Lise" },
  { key: "vocational", label: "MYO (Meslek Yüksekokulu)" },
  { key: "university", label: "Üniversite" },
  { key: "master", label: "Yüksek Lisans" },
  { key: "other", label: "Diğer" },
]

interface FormData {
  // Kişisel Bilgiler
  fullName: string
  birthPlace: string
  birthDate: string
  nationality: string
  tcKimlikNo: string
  gender: string
  bloodType: string

  // Askerlik Durumu
  militaryStatus: string
  militaryPostponeDate: string

  // Medeni Durum
  maritalStatus: string
  numberOfChildren: string

  // Eş Bilgileri
  spouseWorking: string
  spouseOccupation: string

  // Adres ve İletişim
  homeAddress: string
  dependents: string
  mobilePhone: string
  workPhone: string
  homePhone: string
  email: string

  // Bize Nasıl Ulaştınız
  referralSource: string
  referralSourceOther: string

  // Üyelikler
  memberships: string

  // Sürücü Belgesi
  hasDriverLicense: string
  driverLicenseClass: string
  driverLicenseDate: string

  // Adli Sicil ve Hukuki Durum
  hasCriminalRecord: string
  hasConviction: string
  convictionDetails: string
  hasOngoingCase: string

  // Fiziksel Özellikler
  height: string
  weight: string
  shoeSize: string
  clothingSizeUpper: string
  clothingSizeLower: string

  // Çalışma Koşulları
  hasTravelRestriction: string
  canWorkShifts: string

  // Hobiler
  hobbies: string

  // İş Tercihleri
  availableStartDate: string
  expectedSalary: string
  requestedPosition: string
  previouslyWorkedHere: string

  // Öğrenim Durumu
  educationLevel: string

  // Firma bünyesinde akraba/tanıdık
  hasRelativesInCompany: string
  relativeName: string

  // İletişim Tercihi
  preferredContactGsm: string
  preferredContactEmail: string
  preferredContactOther: string

  // Son işveren ile temasa geçilebilir mi?
  canContactLastEmployer: string

  // Beyan
  declarationAccepted: string

  // Dijital İmza
  digitalSignature: string
  signatureDate: string

  // Fotoğraf
  photo: File | null
}

// Eğitim kayıt tipi
interface EducationEntry {
  level: string
  institution: string
  startDate: string
  endDate: string
  department: string
  gpa: string
}

// Kurs/Seminer kayıt tipi
interface CourseEntry {
  institution: string
  subject: string
  duration: string
  attendanceDate: string
}

// Yabancı Dil kayıt tipi
interface LanguageEntry {
  language: string
  reading: string
  writing: string
  speaking: string
  learnedAt: string
}

// Bilgisayar Bilgisi kayıt tipi
interface ComputerSkillEntry {
  program: string
  level: string
  learnedAt: string
}

// İş Tecrübesi kayıt tipi
interface WorkExperienceEntry {
  company: string
  position: string
  startDate: string
  endDate: string
  leavingReason: string
  lastSalary: string
}

// Referans kayıt tipi
interface ReferenceEntry {
  name: string
  company: string
  position: string
  phone: string
}

// Dil seviye seçenekleri
const LANGUAGE_LEVEL_OPTIONS = [
  { value: "", label: "Seçiniz" },
  { value: "BASIC", label: "Temel" },
  { value: "INTERMEDIATE", label: "Orta" },
  { value: "ADVANCED", label: "İyi" },
]

// Bilgisayar seviye seçenekleri
const COMPUTER_LEVEL_OPTIONS = [
  { value: "", label: "Seçiniz" },
  { value: "POOR", label: "Az" },
  { value: "MEDIUM", label: "Orta" },
  { value: "GOOD", label: "İyi" },
  { value: "VERY_GOOD", label: "Çok İyi" },
]

const initialFormData: FormData = {
  fullName: "",
  birthPlace: "",
  birthDate: "",
  nationality: "T.C.",
  tcKimlikNo: "",
  gender: "",
  bloodType: "",
  militaryStatus: "",
  militaryPostponeDate: "",
  maritalStatus: "",
  numberOfChildren: "",
  spouseWorking: "",
  spouseOccupation: "",
  homeAddress: "",
  dependents: "",
  mobilePhone: "",
  workPhone: "",
  homePhone: "",
  email: "",
  referralSource: "",
  referralSourceOther: "",
  memberships: "",
  hasDriverLicense: "",
  driverLicenseClass: "",
  driverLicenseDate: "",
  hasCriminalRecord: "",
  hasConviction: "",
  convictionDetails: "",
  hasOngoingCase: "",
  height: "",
  weight: "",
  shoeSize: "",
  clothingSizeUpper: "",
  clothingSizeLower: "",
  hasTravelRestriction: "",
  canWorkShifts: "",
  hobbies: "",
  availableStartDate: "",
  expectedSalary: "",
  requestedPosition: "",
  previouslyWorkedHere: "",
  educationLevel: "",
  hasRelativesInCompany: "",
  relativeName: "",
  preferredContactGsm: "",
  preferredContactEmail: "",
  preferredContactOther: "",
  canContactLastEmployer: "",
  declarationAccepted: "",
  digitalSignature: "",
  signatureDate: "",
  photo: null,
}

// Boş eğitim kaydı
const emptyEducation: EducationEntry = {
  level: "",
  institution: "",
  startDate: "",
  endDate: "",
  department: "",
  gpa: "",
}

// Başlangıç eğitim verileri
const initialEducationHistory: Record<string, EducationEntry> = {
  primarySchool: { ...emptyEducation, level: "primarySchool" },
  highSchool: { ...emptyEducation, level: "highSchool" },
  vocational: { ...emptyEducation, level: "vocational" },
  university: { ...emptyEducation, level: "university" },
  master: { ...emptyEducation, level: "master" },
  other: { ...emptyEducation, level: "other" },
}

// Boş kurs/seminer kaydı
const emptyCourse: CourseEntry = {
  institution: "",
  subject: "",
  duration: "",
  attendanceDate: "",
}

// Boş yabancı dil kaydı
const emptyLanguage: LanguageEntry = {
  language: "",
  reading: "",
  writing: "",
  speaking: "",
  learnedAt: "",
}

// Başlangıç kurs verileri (3 satır)
const initialCourses: CourseEntry[] = [
  { ...emptyCourse },
  { ...emptyCourse },
  { ...emptyCourse },
]

// Başlangıç yabancı dil verileri (3 satır)
const initialLanguages: LanguageEntry[] = [
  { ...emptyLanguage },
  { ...emptyLanguage },
  { ...emptyLanguage },
]

// Boş bilgisayar bilgisi kaydı
const emptyComputerSkill: ComputerSkillEntry = {
  program: "",
  level: "",
  learnedAt: "",
}

// Boş iş tecrübesi kaydı
const emptyWorkExperience: WorkExperienceEntry = {
  company: "",
  position: "",
  startDate: "",
  endDate: "",
  leavingReason: "",
  lastSalary: "",
}

// Başlangıç bilgisayar bilgisi verileri (5 satır)
const initialComputerSkills: ComputerSkillEntry[] = [
  { ...emptyComputerSkill },
  { ...emptyComputerSkill },
  { ...emptyComputerSkill },
  { ...emptyComputerSkill },
  { ...emptyComputerSkill },
]

// Başlangıç iş tecrübesi verileri (5 satır)
const initialWorkExperience: WorkExperienceEntry[] = [
  { ...emptyWorkExperience },
  { ...emptyWorkExperience },
  { ...emptyWorkExperience },
  { ...emptyWorkExperience },
  { ...emptyWorkExperience },
]

// Boş referans kaydı
const emptyReference: ReferenceEntry = {
  name: "",
  company: "",
  position: "",
  phone: "",
}

// Başlangıç referans verileri (3 satır)
const initialReferences: ReferenceEntry[] = [
  { ...emptyReference },
  { ...emptyReference },
  { ...emptyReference },
]

export default function JobApplicationPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [educationHistory, setEducationHistory] = useState<Record<string, EducationEntry>>(initialEducationHistory)
  const [courses, setCourses] = useState<CourseEntry[]>(initialCourses)
  const [languages, setLanguages] = useState<LanguageEntry[]>(initialLanguages)
  const [computerSkills, setComputerSkills] = useState<ComputerSkillEntry[]>(initialComputerSkills)
  const [workExperience, setWorkExperience] = useState<WorkExperienceEntry[]>(initialWorkExperience)
  const [references, setReferences] = useState<ReferenceEntry[]>(initialReferences)
  const [currentPage, setCurrentPage] = useState(1) // 1, 2 veya 3

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Dosya boyutu kontrolü (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Fotoğraf boyutu 5MB'dan küçük olmalıdır.")
        return
      }

      setFormData((prev) => ({ ...prev, photo: file }))

      // Preview oluştur
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleEducationChange = (
    level: string,
    field: keyof EducationEntry,
    value: string
  ) => {
    setEducationHistory((prev) => ({
      ...prev,
      [level]: {
        ...prev[level],
        [field]: value,
      },
    }))
  }

  const handleCourseChange = (
    index: number,
    field: keyof CourseEntry,
    value: string
  ) => {
    setCourses((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleLanguageChange = (
    index: number,
    field: keyof LanguageEntry,
    value: string
  ) => {
    setLanguages((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addCourseRow = () => {
    setCourses((prev) => [...prev, { ...emptyCourse }])
  }

  const addLanguageRow = () => {
    setLanguages((prev) => [...prev, { ...emptyLanguage }])
  }

  const handleComputerSkillChange = (
    index: number,
    field: keyof ComputerSkillEntry,
    value: string
  ) => {
    setComputerSkills((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleWorkExperienceChange = (
    index: number,
    field: keyof WorkExperienceEntry,
    value: string
  ) => {
    setWorkExperience((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addComputerSkillRow = () => {
    setComputerSkills((prev) => [...prev, { ...emptyComputerSkill }])
  }

  const addWorkExperienceRow = () => {
    setWorkExperience((prev) => [...prev, { ...emptyWorkExperience }])
  }

  const handleReferenceChange = (
    index: number,
    field: keyof ReferenceEntry,
    value: string
  ) => {
    setReferences((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addReferenceRow = () => {
    setReferences((prev) => [...prev, { ...emptyReference }])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validasyon
    if (!formData.fullName.trim()) {
      alert("Ad Soyad alanı zorunludur.")
      return
    }

    setIsSubmitting(true)
    setSubmitStatus("idle")
    setErrorMessage("")

    try {
      const submitData = new FormData()

      // Form verilerini ekle
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "photo" && value instanceof File) {
          submitData.append("photo", value)
        } else if (value !== null && value !== "") {
          submitData.append(key, String(value))
        }
      })

      // Eğitim geçmişini JSON olarak ekle
      const filledEducation = Object.values(educationHistory).filter(
        (edu) => edu.institution.trim() !== ""
      )
      if (filledEducation.length > 0) {
        submitData.append("educationHistory", JSON.stringify(filledEducation))
      }

      // Kurs ve seminerleri JSON olarak ekle
      const filledCourses = courses.filter(
        (course) => course.institution.trim() !== "" || course.subject.trim() !== ""
      )
      if (filledCourses.length > 0) {
        submitData.append("coursesAndSeminars", JSON.stringify(filledCourses))
      }

      // Yabancı dilleri JSON olarak ekle
      const filledLanguages = languages.filter(
        (lang) => lang.language.trim() !== ""
      )
      if (filledLanguages.length > 0) {
        submitData.append("foreignLanguages", JSON.stringify(filledLanguages))
      }

      // Bilgisayar bilgilerini JSON olarak ekle
      const filledComputerSkills = computerSkills.filter(
        (skill) => skill.program.trim() !== ""
      )
      if (filledComputerSkills.length > 0) {
        submitData.append("computerSkills", JSON.stringify(filledComputerSkills))
      }

      // İş tecrübelerini JSON olarak ekle
      const filledWorkExperience = workExperience.filter(
        (exp) => exp.company.trim() !== "" || exp.position.trim() !== ""
      )
      if (filledWorkExperience.length > 0) {
        submitData.append("workExperience", JSON.stringify(filledWorkExperience))
      }

      // Referansları JSON olarak ekle
      const filledReferences = references.filter(
        (ref) => ref.name.trim() !== ""
      )
      if (filledReferences.length > 0) {
        submitData.append("references", JSON.stringify(filledReferences))
      }

      const response = await fetch("/api/job-application", {
        method: "POST",
        body: submitData,
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitStatus("success")
        setFormData(initialFormData)
        setPhotoPreview(null)
        setEducationHistory(initialEducationHistory)
        setCourses(initialCourses)
        setLanguages(initialLanguages)
        setComputerSkills(initialComputerSkills)
        setWorkExperience(initialWorkExperience)
        setReferences(initialReferences)
      } else {
        setSubmitStatus("error")
        setErrorMessage(result.error || "Bir hata oluştu")
      }
    } catch (error) {
      console.error("Submit error:", error)
      setSubmitStatus("error")
      setErrorMessage("Sunucu ile bağlantı kurulamadı")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitStatus === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Başvurunuz Alındı!
          </h2>
          <p className="text-gray-600 mb-6">
            İş başvurunuz başarıyla kaydedildi. En kısa sürede sizinle iletişime
            geçeceğiz.
          </p>
          <button
            onClick={() => {
              setSubmitStatus("idle")
              router.refresh()
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Yeni Başvuru
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col items-center mb-4">
            <img
              src="/ilerigrouplogo.png"
              alt="İLERİ Group"
              className="h-12 w-auto mb-3"
            />
            <h1 className="text-2xl font-bold text-gray-900 text-center">
              İş Başvuru Formu
            </h1>
            <p className="text-gray-600 text-sm mt-2 text-center">
              Lütfen tüm alanları eksiksiz doldurunuz.
            </p>
          </div>

          {/* Sayfa Göstergesi */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-1 sm:gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentPage === 1
                    ? "bg-blue-600 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {currentPage === 1 ? "1" : "✓"}
              </div>
              <span className={`text-xs sm:text-sm ${currentPage === 1 ? "font-semibold text-blue-600" : "text-gray-500"}`}>
                Kişisel Bilgiler
              </span>
            </div>
            <div className="w-6 sm:w-12 h-0.5 bg-gray-300" />
            <div className="flex items-center gap-1 sm:gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentPage === 2
                    ? "bg-blue-600 text-white"
                    : currentPage > 2
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {currentPage > 2 ? "✓" : "2"}
              </div>
              <span className={`text-xs sm:text-sm ${currentPage === 2 ? "font-semibold text-blue-600" : "text-gray-500"}`}>
                Eğitim Bilgileri
              </span>
            </div>
            <div className="w-6 sm:w-12 h-0.5 bg-gray-300" />
            <div className="flex items-center gap-1 sm:gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentPage === 3
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                3
              </div>
              <span className={`text-xs sm:text-sm ${currentPage === 3 ? "font-semibold text-blue-600" : "text-gray-500"}`}>
                İş Tecrübeleriniz
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SAYFA 1 */}
          {currentPage === 1 && (
            <>
          {/* Kişisel Bilgiler */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Kişisel Bilgiler
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ad Soyad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doğum Yeri
                </label>
                <input
                  type="text"
                  name="birthPlace"
                  value={formData.birthPlace}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doğum Tarihi
                </label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uyruk
                </label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  T.C. Kimlik No
                </label>
                <input
                  type="text"
                  name="tcKimlikNo"
                  value={formData.tcKimlikNo}
                  onChange={handleInputChange}
                  maxLength={11}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cinsiyet
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kan Grubu
                </label>
                <select
                  name="bloodType"
                  value={formData.bloodType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {BLOOD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Askerlik Durumu - Sadece erkekler için göster */}
          {formData.gender !== "FEMALE" && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                Askerlik Durumu
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Askerlik Durumu
                  </label>
                  <select
                    name="militaryStatus"
                    value={formData.militaryStatus}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seçiniz</option>
                    {MILITARY_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.militaryStatus === "POSTPONED" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tecil Tarihi
                    </label>
                    <input
                      type="date"
                      name="militaryPostponeDate"
                      value={formData.militaryPostponeDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medeni Durum */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Medeni Durum
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medeni Durum
                </label>
                <select
                  name="maritalStatus"
                  value={formData.maritalStatus}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {MARITAL_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Çocuk Sayısı
                </label>
                <input
                  type="number"
                  name="numberOfChildren"
                  value={formData.numberOfChildren}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formData.maritalStatus === "MARRIED" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Eşiniz Çalışıyor mu?
                    </label>
                    <select
                      name="spouseWorking"
                      value={formData.spouseWorking}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seçiniz</option>
                      <option value="true">Evet</option>
                      <option value="false">Hayır</option>
                    </select>
                  </div>

                  {formData.spouseWorking === "true" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Eşin Mesleği
                      </label>
                      <input
                        type="text"
                        name="spouseOccupation"
                        value={formData.spouseOccupation}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Adres ve İletişim */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Adres ve İletişim Bilgileri
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ev Adresi
                </label>
                <textarea
                  name="homeAddress"
                  value={formData.homeAddress}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bakmakla Yükümlü Olduğunuz Kişiler
                </label>
                <textarea
                  name="dependents"
                  value={formData.dependents}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Örn: Anne (65 yaş), Baba (70 yaş)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GSM (Cep Telefonu)
                </label>
                <input
                  type="tel"
                  name="mobilePhone"
                  value={formData.mobilePhone}
                  onChange={handleInputChange}
                  placeholder="0532 123 45 67"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  İş Telefonu
                </label>
                <input
                  type="tel"
                  name="workPhone"
                  value={formData.workPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ev Telefonu
                </label>
                <input
                  type="tel"
                  name="homePhone"
                  value={formData.homePhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Bize Nasıl Ulaştınız */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Bize Nasıl Ulaştınız?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kaynak
                </label>
                <select
                  name="referralSource"
                  value={formData.referralSource}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {REFERRAL_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.referralSource === "OTHER" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diğer (Belirtiniz)
                  </label>
                  <input
                    type="text"
                    name="referralSourceOther"
                    value={formData.referralSourceOther}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Üyelikler */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Üyelikler
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dernek / Kulüp / Sendika Üyelikleri
              </label>
              <textarea
                name="memberships"
                value={formData.memberships}
                onChange={handleInputChange}
                rows={2}
                placeholder="Varsa üye olduğunuz kuruluşları belirtiniz"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Sürücü Belgesi */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Sürücü Belgesi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sürücü Belgesi Var mı?
                </label>
                <select
                  name="hasDriverLicense"
                  value={formData.hasDriverLicense}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </select>
              </div>

              {formData.hasDriverLicense === "true" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sürücü Belgesi Sınıfı
                    </label>
                    <input
                      type="text"
                      name="driverLicenseClass"
                      value={formData.driverLicenseClass}
                      onChange={handleInputChange}
                      placeholder="Örn: B, A2, C"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Belge Tarihi
                    </label>
                    <input
                      type="date"
                      name="driverLicenseDate"
                      value={formData.driverLicenseDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Adli Sicil ve Hukuki Durum */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Adli Sicil ve Hukuki Durum
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adli Sicil Kaydınız Var mı?
                </label>
                <select
                  name="hasCriminalRecord"
                  value={formData.hasCriminalRecord}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hiç Hüküm Giydiniz mi?
                </label>
                <select
                  name="hasConviction"
                  value={formData.hasConviction}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </select>
              </div>

              {formData.hasConviction === "true" && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evet ise Dava Konusu
                  </label>
                  <textarea
                    name="convictionDetails"
                    value={formData.convictionDetails}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devam Eden Mahkemeniz Var mı?
                </label>
                <select
                  name="hasOngoingCase"
                  value={formData.hasOngoingCase}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fiziksel Özellikler */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Fiziksel Özellikler
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Boyunuz (cm)
                </label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                  placeholder="175"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kilonuz (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  placeholder="70"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ayakkabı No
                </label>
                <input
                  type="text"
                  name="shoeSize"
                  value={formData.shoeSize}
                  onChange={handleInputChange}
                  placeholder="42"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Üst Beden
                </label>
                <input
                  type="text"
                  name="clothingSizeUpper"
                  value={formData.clothingSizeUpper}
                  onChange={handleInputChange}
                  placeholder="M, L, XL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alt Beden
                </label>
                <input
                  type="text"
                  name="clothingSizeLower"
                  value={formData.clothingSizeLower}
                  onChange={handleInputChange}
                  placeholder="M, L, XL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Çalışma Koşulları */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Çalışma Koşulları
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seyahat Engeliniz Var mı?
                </label>
                <select
                  name="hasTravelRestriction"
                  value={formData.hasTravelRestriction}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vardiyalı ve Mesaili Çalışabilir misiniz?
                </label>
                <select
                  name="canWorkShifts"
                  value={formData.canWorkShifts}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </select>
              </div>
            </div>
          </div>

          {/* Hobiler */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Hobiler
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hobileriniz
              </label>
              <textarea
                name="hobbies"
                value={formData.hobbies}
                onChange={handleInputChange}
                rows={2}
                placeholder="İlgi alanlarınızı ve hobilerinizi belirtiniz"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Sayfa 1 - Sonraki Buton */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <button
              type="button"
              onClick={() => {
                setCurrentPage(2)
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Sonraki Sayfa →
            </button>
          </div>
            </>
          )}

          {/* SAYFA 2 */}
          {currentPage === 2 && (
            <>
          {/* İş Tercihleri */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              İş Tercihleri
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  İşe Başlayabileceğiniz En Yakın Tarih
                </label>
                <input
                  type="date"
                  name="availableStartDate"
                  value={formData.availableStartDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Talep Ettiğiniz Aylık Brüt Ücret (TL)
                </label>
                <input
                  type="number"
                  name="expectedSalary"
                  value={formData.expectedSalary}
                  onChange={handleInputChange}
                  placeholder="25000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Talep Ettiğiniz İş / Bölüm
                </label>
                <input
                  type="text"
                  name="requestedPosition"
                  value={formData.requestedPosition}
                  onChange={handleInputChange}
                  placeholder="Örn: Üretim, Kalite, Mühendislik"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daha Önce İleri Grup'ta Çalıştınız mı?
                </label>
                <select
                  name="previouslyWorkedHere"
                  value={formData.previouslyWorkedHere}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </select>
              </div>
            </div>
          </div>

          {/* Eğitim Bilgileri */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Eğitim Bilgileri
            </h2>

            {/* Öğrenim Durumu */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                En Yüksek Öğrenim Durumunuz
              </label>
              <div className="flex flex-wrap gap-4">
                {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="educationLevel"
                      value={opt.value}
                      checked={formData.educationLevel === opt.value}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Eğitim Tablosu */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Öğrenim
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Kurum Adı ve Yeri
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Giriş Tarihi
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Mezuniyet
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Bölüm
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-20">
                      Not
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {EDUCATION_TYPES.map((eduType) => (
                    <tr key={eduType.key}>
                      <td className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50">
                        {eduType.label}
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={educationHistory[eduType.key]?.institution || ""}
                          onChange={(e) =>
                            handleEducationChange(eduType.key, "institution", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Kurum adı"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={educationHistory[eduType.key]?.startDate || ""}
                          onChange={(e) =>
                            handleEducationChange(eduType.key, "startDate", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="2015"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={educationHistory[eduType.key]?.endDate || ""}
                          onChange={(e) =>
                            handleEducationChange(eduType.key, "endDate", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="2019"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={educationHistory[eduType.key]?.department || ""}
                          onChange={(e) =>
                            handleEducationChange(eduType.key, "department", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Bölüm"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={educationHistory[eduType.key]?.gpa || ""}
                          onChange={(e) =>
                            handleEducationChange(eduType.key, "gpa", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="3.5"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staj, Kurs ve Seminerler */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Staj, Kurs ve Seminerler
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Kurum ve Kuruluşun Adı / Yeri
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Konusu
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-24">
                      Süresi
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-32">
                      Katıldığınız Tarih
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={course.institution}
                          onChange={(e) =>
                            handleCourseChange(index, "institution", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Kurum adı ve yeri"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={course.subject}
                          onChange={(e) =>
                            handleCourseChange(index, "subject", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Kurs konusu"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={course.duration}
                          onChange={(e) =>
                            handleCourseChange(index, "duration", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="3 ay"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={course.attendanceDate}
                          onChange={(e) =>
                            handleCourseChange(index, "attendanceDate", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="2023"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addCourseRow}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Satır Ekle
            </button>
          </div>

          {/* Yabancı Dil Bilgisi */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Yabancı Dil Bilgisi
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Yabancı Dil
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Okuma
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Yazma
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Konuşma
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Öğrenildiği Yer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {languages.map((lang, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={lang.language}
                          onChange={(e) =>
                            handleLanguageChange(index, "language", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="İngilizce"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <select
                          value={lang.reading}
                          onChange={(e) =>
                            handleLanguageChange(index, "reading", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded bg-white"
                        >
                          {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 p-1">
                        <select
                          value={lang.writing}
                          onChange={(e) =>
                            handleLanguageChange(index, "writing", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded bg-white"
                        >
                          {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 p-1">
                        <select
                          value={lang.speaking}
                          onChange={(e) =>
                            handleLanguageChange(index, "speaking", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded bg-white"
                        >
                          {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={lang.learnedAt}
                          onChange={(e) =>
                            handleLanguageChange(index, "learnedAt", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Üniversite, Kurs vb."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addLanguageRow}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Satır Ekle
            </button>
          </div>

          {/* Sayfa 2 - Butonlar */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                ← Önceki Sayfa
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(3)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Sonraki Sayfa →
              </button>
            </div>
          </div>
            </>
          )}

          {/* SAYFA 3 */}
          {currentPage === 3 && (
            <>
          {/* Bilgisayar Bilgisi */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Bilgisayar Bilgisi
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Uygun olanı (X) ile işaretleyiniz - Kullandığınız programları ve seviyenizi belirtiniz.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Program
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-32">
                      Seviye
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Öğrenildiği Yer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {computerSkills.map((skill, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={skill.program}
                          onChange={(e) =>
                            handleComputerSkillChange(index, "program", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Microsoft Office, AutoCAD vb."
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <select
                          value={skill.level}
                          onChange={(e) =>
                            handleComputerSkillChange(index, "level", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded bg-white"
                        >
                          {COMPUTER_LEVEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={skill.learnedAt}
                          onChange={(e) =>
                            handleComputerSkillChange(index, "learnedAt", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Üniversite, Kurs vb."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addComputerSkillRow}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Satır Ekle
            </button>
          </div>

          {/* İş Tecrübeleri */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              İş Tecrübeleriniz
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Geçmişteki iş tecrübelerinizi sondan başlayarak sıralayınız. (En son çalıştığınız yerden başlayarak)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      İşyerinin Unvanı / Tel No
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Görev
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Giriş Tr. Ay/Yıl
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Çıkış Tr. Ay/Yıl
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Ayrılma Nedeni
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      En Son Brüt Ücret
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workExperience.map((exp, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) =>
                            handleWorkExperienceChange(index, "company", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Şirket adı ve tel"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={exp.position}
                          onChange={(e) =>
                            handleWorkExperienceChange(index, "position", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Pozisyon"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={exp.startDate}
                          onChange={(e) =>
                            handleWorkExperienceChange(index, "startDate", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="01/2020"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={exp.endDate}
                          onChange={(e) =>
                            handleWorkExperienceChange(index, "endDate", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="12/2023"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={exp.leavingReason}
                          onChange={(e) =>
                            handleWorkExperienceChange(index, "leavingReason", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="İstifa, Tayin vb."
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={exp.lastSalary}
                          onChange={(e) =>
                            handleWorkExperienceChange(index, "lastSalary", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="25.000 TL"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addWorkExperienceRow}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Satır Ekle
            </button>
          </div>

          {/* Firma Bünyesinde Akraba/Tanıdık */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Firma Bünyesinde Akraba veya Tanıdık
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Firma bünyesinde akrabanız veya tanıdığınız var mı?
                </label>
                <select
                  name="hasRelativesInCompany"
                  value={formData.hasRelativesInCompany}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </select>
              </div>

              {formData.hasRelativesInCompany === "true" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adı Soyadı
                  </label>
                  <input
                    type="text"
                    name="relativeName"
                    value={formData.relativeName}
                    onChange={handleInputChange}
                    placeholder="Akraba/tanıdık adı soyadı"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* İletişim Tercihi */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Size Nasıl Ulaşabiliriz?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="preferredContactGsm"
                  checked={formData.preferredContactGsm === "true"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      preferredContactGsm: e.target.checked ? "true" : "false",
                    }))
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">GSM</span>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="preferredContactEmail"
                  checked={formData.preferredContactEmail === "true"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      preferredContactEmail: e.target.checked ? "true" : "false",
                    }))
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">E-mail</span>
              </label>

              <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg">
                <span className="text-sm text-gray-700">Diğer:</span>
                <input
                  type="text"
                  name="preferredContactOther"
                  value={formData.preferredContactOther}
                  onChange={handleInputChange}
                  placeholder="Belirtiniz"
                  className="flex-1 px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                />
              </div>
            </div>
          </div>

          {/* Son İşveren ile Temas */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Son İşveren ile Temas
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                En son iş yerinizle temasa geçebilir miyiz?
              </label>
              <select
                name="canContactLastEmployer"
                value={formData.canContactLastEmployer}
                onChange={handleInputChange}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </select>
            </div>
          </div>

          {/* Referanslar */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Aradığımızda Referans Verebilecek Kişiler
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Akrabalarınız ve arkadaşlarınız dışında referans verebilecek kişileri belirtiniz.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Adı Soyadı
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700">
                      Çalıştığı Şirketin Adı
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                      Görevi
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-medium text-gray-700 w-32">
                      Telefon
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {references.map((ref, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={ref.name}
                          onChange={(e) =>
                            handleReferenceChange(index, "name", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Ad Soyad"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={ref.company}
                          onChange={(e) =>
                            handleReferenceChange(index, "company", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Şirket adı"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={ref.position}
                          onChange={(e) =>
                            handleReferenceChange(index, "position", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="Görevi"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          type="text"
                          value={ref.phone}
                          onChange={(e) =>
                            handleReferenceChange(index, "phone", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 rounded"
                          placeholder="0532 123 45 67"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addReferenceRow}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Satır Ekle
            </button>
          </div>

          {/* Beyan */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Beyan / Declaration
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm text-gray-700 leading-relaxed">
              <p className="mb-3">
                Verdiğim bilgiler doğru ve tamdır. <strong>İLERİ GROUP</strong>, başvurum hakkında
                her türlü tahkikata yetkilidir. İletilen kişisel verilerimin yasal mevzuata uygun olarak
                şirketimize veri sorumlusu sıfatı ile işlenmekte olup, yasal olarak aktarılması gereken
                resmi makamlara hukuki zorunluluklar nedeniyle ve ayrıca şirketimize uygun görülmesi
                halinde üçüncü parti firma destek hizmetleri kuruluşlarına aktarılabilmektedir.
              </p>
              <p className="mb-3">
                Bu formun doldurulması, söz konusu bilgilendirmeyi okuduğunuz, anladığınız ve kabul
                ettiğiniz anlamına gelmektedir.
              </p>
              <p className="mb-3">
                Eksik veya yanlış bilgilerin, başvurumun iptaline, yasal takibata ve hizmet akdinin
                ihbarsız feshine yol açabileceğini kabul ederim.
              </p>
              <p className="font-semibold text-gray-800">
                Kişisel Verilerin Korunması: Bu form üzerinde verdiğim kişisel bilgilerimin kurum ile
                iş ilişkimin kurulması nedeniyle kurum tarafından gerek gördüğü paylaşımların yapılması,
                muhafazası ve işlenmesi ile referans kontrolleri için muvaffakatım vardır.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                name="declarationAccepted"
                checked={formData.declarationAccepted === "true"}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    declarationAccepted: e.target.checked ? "true" : "false",
                  }))
                }
                className="w-5 h-5 mt-0.5 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">
                Yukarıdaki beyanı okudum, anladım ve kabul ediyorum.
              </span>
            </label>

            {/* Dijital İmza Bölümü */}
            <div className="border-t pt-4 mt-4">
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-2">
                <div>
                  <span className="font-medium">Adı-Soyadı</span>
                  <div className="text-xs text-gray-400">Name-Surname</div>
                </div>
                <div>
                  <span className="font-medium">Tarih</span>
                  <div className="text-xs text-gray-400">Date</div>
                </div>
                <div>
                  <span className="font-medium">İmza</span>
                  <div className="text-xs text-gray-400">Signature</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-sm font-medium text-gray-800">
                  {formData.fullName || "-"}
                </div>
                <div className="text-sm text-gray-800">
                  {formData.signatureDate || "-"}
                </div>
                <div>
                  {formData.digitalSignature ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium">Dijital olarak imzalandı</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        {formData.fullName} tarafından {formData.signatureDate} tarihinde dijital olarak imzalanmıştır.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!formData.fullName.trim() || formData.declarationAccepted !== "true"}
                      onClick={() => {
                        const now = new Date()
                        const dateStr = now.toLocaleDateString("tr-TR") + " " + now.toLocaleTimeString("tr-TR")
                        setFormData((prev) => ({
                          ...prev,
                          digitalSignature: `${prev.fullName}|${dateStr}|${Date.now()}`,
                          signatureDate: dateStr,
                        }))
                      }}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                    >
                      Dijital İmzala
                    </button>
                  )}
                </div>
              </div>
              {!formData.fullName.trim() && (
                <p className="text-xs text-amber-600 mt-2">
                  * Dijital imza için önce Ad Soyad alanını doldurun.
                </p>
              )}
              {formData.fullName.trim() && formData.declarationAccepted !== "true" && (
                <p className="text-xs text-amber-600 mt-2">
                  * Dijital imza için önce beyanı kabul edin.
                </p>
              )}
            </div>
          </div>

          {/* Fotoğraf */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
              Fotoğraf
            </h2>
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vesikalık Fotoğraf
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maksimum 5MB, JPG veya PNG formatında
                </p>
              </div>
              {photoPreview && (
                <div className="flex-shrink-0">
                  <img
                    src={photoPreview}
                    alt="Fotoğraf önizleme"
                    className="w-32 h-40 object-cover rounded-lg border border-gray-300"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Hata Mesajı */}
          {submitStatus === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* Sayfa 3 - Butonlar */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(2)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                ← Önceki Sayfa
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Gönderiliyor..." : "Başvuruyu Gönder"}
              </button>
            </div>
          </div>
            </>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 py-4">
            ILERI Group - İnsan Varlıkları Departmanı
          </div>
        </form>
      </div>
    </div>
  )
}
