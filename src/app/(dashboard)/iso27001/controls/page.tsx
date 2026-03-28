"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Shield,
  Building2,
  Users,
  Server,
  Filter,
  Download,
  Loader2,
  Upload,
  FileText,
  Image,
  File,
  Link,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

// Kategori bilgileri
const CATEGORIES = [
  { value: "ORGANIZATIONAL", label: "Organizasyonel Kontroller", labelEn: "Organizational Controls", icon: Building2, count: 37, color: "text-blue-600" },
  { value: "PEOPLE", label: "İnsan Kontrolleri", labelEn: "People Controls", icon: Users, count: 8, color: "text-green-600" },
  { value: "PHYSICAL", label: "Fiziksel Kontroller", labelEn: "Physical Controls", icon: Shield, count: 14, color: "text-orange-600" },
  { value: "TECHNOLOGICAL", label: "Teknolojik Kontroller", labelEn: "Technological Controls", icon: Server, count: 34, color: "text-purple-600" },
]

// Durum bilgileri
const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  NOT_APPLICABLE: { label: "Uygulanmıyor", color: "text-gray-600", bgColor: "bg-gray-100", icon: XCircle },
  NOT_IMPLEMENTED: { label: "Uygulanmadı", color: "text-red-600", bgColor: "bg-red-100", icon: AlertTriangle },
  PARTIALLY: { label: "Kısmen", color: "text-yellow-600", bgColor: "bg-yellow-100", icon: Clock },
  IMPLEMENTED: { label: "Uygulandı", color: "text-green-600", bgColor: "bg-green-100", icon: CheckCircle2 },
  EFFECTIVE: { label: "Etkin", color: "text-emerald-600", bgColor: "bg-emerald-100", icon: CheckCircle2 },
}

// Kanıt tipleri
const EVIDENCE_TYPES = [
  { value: "DOCUMENT", label: "Dokuman", icon: FileText },
  { value: "SCREENSHOT", label: "Ekran Goruntusu", icon: Image },
  { value: "LOG", label: "Log Kaydi", icon: File },
  { value: "REPORT", label: "Rapor", icon: FileText },
  { value: "CERTIFICATE", label: "Sertifika", icon: FileText },
  { value: "RECORD", label: "Kayit", icon: File },
  { value: "OTHER", label: "Diger", icon: File },
]

// Türkçe açıklamalar
const TURKISH_DESCRIPTIONS: Record<string, string> = {
  "A.5.1": "Bilgi güvenliği politikası ve konuya özgü politikalar tanımlanmalı, yönetim tarafından onaylanmalı, yayımlanmalı, ilgili personel ve ilgili taraflara iletilmeli ve kabul ettirilmeli, planlanan aralıklarla ve önemli değişiklikler olduğunda gözden geçirilmelidir.",
  "A.5.2": "Bilgi güvenliği rol ve sorumlulukları, kuruluşun ihtiyaçlarına göre tanımlanmalı ve atanmalıdır.",
  "A.5.3": "Çakışan görevler ve çakışan sorumluluk alanları birbirinden ayrılmalıdır.",
  "A.5.4": "Yönetim, tüm personelin kuruluşun oluşturulmuş bilgi güvenliği politikası, konuya özgü politikalar ve prosedürlerine uygun olarak bilgi güvenliğini uygulamasını sağlamalıdır.",
  "A.5.5": "Kuruluş, ilgili yetkililerle iletişim kurmalı ve sürdürmelidir.",
  "A.5.6": "Kuruluş, özel ilgi grupları veya diğer uzman güvenlik forumları ve profesyonel birliklerle iletişim kurmalı ve sürdürmelidir.",
  "A.5.7": "Bilgi güvenliği tehditlerini ilişkin bilgiler, tehdit istihbaratı üretmek için toplanmalı ve analiz edilmelidir.",
  "A.5.8": "Bilgi güvenliği, proje yönetimine entegre edilmelidir.",
  "A.5.9": "Sahiplerini de içeren bilgi ve ilişkili varlıkların envanteri geliştirilmeli ve sürdürülmelidir.",
  "A.5.10": "Bilgi ve ilişkili varlıkların kabul edilebilir kullanımı için kurallar ve işleme prosedürleri belirlenmeli, dokümante edilmeli ve uygulanmalıdır.",
  "A.5.11": "Personel ve diğer ilgili taraflar, istihdam, sözleşme veya anlaşmalarının değişmesi veya sona ermesi durumunda, ellerindeki tüm kuruluş varlıklarını iade etmelidir.",
  "A.5.12": "Bilgi, gizlilik, bütünlük, erişilebilirlik ve ilgili taraf gereksinimlerine dayalı olarak kuruluşun bilgi güvenliği ihtiyaçlarına göre sınıflandırılmalıdır.",
  "A.5.13": "Kuruluş tarafından benimsenen bilgi sınıflandırma şemasına uygun olarak bilgi etiketleme için uygun prosedürler geliştirilmeli ve uygulanmalıdır.",
  "A.5.14": "Kuruluş içinde ve kuruluş ile diğer taraflar arasındaki her tür transfer olanağı için bilgi transferi kuralları, prosedürleri veya anlaşmaları mevcut olmalıdır.",
  "A.5.15": "Bilgi ve ilişkili varlıklara fiziksel ve mantıksal erişimi kontrol etmek için kurallar, iş ve bilgi güvenliği gereksinimlerine dayalı olarak oluşturulmalı ve uygulanmalıdır.",
  "A.5.16": "Kimliklerin tam yaşam döngüsü yönetilmelidir.",
  "A.5.17": "Kimlik doğrulama bilgilerinin tahsisi ve yönetimi, personele kimlik doğrulama bilgilerinin uygun kullanımı konusunda tavsiyeleri de içeren bir yönetim süreci ile kontrol edilmelidir.",
  "A.5.18": "Bilgi ve ilişkili varlıklara erişim hakları, kuruluşun erişim kontrolü konuya özgü politikası ve kurallarına uygun olarak sağlanmalı, gözden geçirilmeli, değiştirilmeli ve kaldırılmalıdır.",
  "A.5.19": "Tedarikçi ürün veya hizmetlerinin kullanımıyla ilişkili bilgi güvenliği risklerini yönetmek için süreçler ve prosedürler tanımlanmalı ve uygulanmalıdır.",
  "A.5.20": "İlgili bilgi güvenliği gereksinimleri, tedarikçi ilişkisinin türüne göre her tedarikçi ile oluşturulmalı ve üzerinde anlaşılmalıdır.",
  "A.5.21": "BİT ürün ve hizmetleri tedarik zinciriyle ilişkili bilgi güvenliği risklerini yönetmek için süreçler ve prosedürler tanımlanmalı ve uygulanmalıdır.",
  "A.5.22": "Kuruluş, tedarikçi bilgi güvenliği uygulamaları ve hizmet sunumundaki değişiklikleri düzenli olarak izlemeli, gözden geçirmeli, değerlendirmeli ve yönetmelidir.",
  "A.5.23": "Bulut hizmetlerinin edinimi, kullanımı, yönetimi ve çıkışı için süreçler, kuruluşun bilgi güvenliği gereksinimlerine uygun olarak oluşturulmalıdır.",
  "A.5.24": "Kuruluş, bilgi güvenliği olay yönetimi süreçlerini, rol ve sorumluluklarını tanımlayarak, oluşturarak ve ileterek bilgi güvenliği olaylarını yönetmeye planlamalı ve hazırlanmalıdır.",
  "A.5.25": "Kuruluş, bilgi güvenliği olaylarını değerlendirmeli ve bunların bilgi güvenliği olayı olarak kategorize edilip edilmeyeceğine karar vermelidir.",
  "A.5.26": "Bilgi güvenliği olaylarına dokümante edilmiş prosedürlere uygun olarak müdahale edilmelidir.",
  "A.5.27": "Bilgi güvenliği olaylarından elde edilen bilgi, bilgi güvenliği kontrollerini güçlendirmek ve iyileştirmek için kullanılmalıdır.",
  "A.5.28": "Kuruluş, bilgi güvenliği olaylarıyla ilgili kanıtların belirlenmesi, toplanması, elde edilmesi ve korunması için prosedürler oluşturmalı ve uygulamalıdır.",
  "A.5.29": "Kuruluş, kesinti sırasında bilgi güvenliğini uygun bir düzeyde nasıl sürdüreceğini planlamalıdır.",
  "A.5.30": "BİT hazırlığı, iş sürekliliği hedefleri ve BİT süreklilik gereksinimlerine dayalı olarak planlanmalı, uygulanmalı, sürdürülmeli ve test edilmelidir.",
  "A.5.31": "Bilgi güvenliğiyle ilgili yasal, mevzuat, düzenleyici ve sözleşmesel gereksinimler ve kuruluşun bu gereksinimleri karşılama yaklaşımı belirlenmeli, dokümante edilmeli ve güncel tutulmalıdır.",
  "A.5.32": "Kuruluş, fikri mülkiyet haklarını korumak için uygun prosedürler uygulamalıdır.",
  "A.5.33": "Kayıtlar; kayıp, imha, tahrifat, yetkisiz erişim ve yetkisiz açıklamaya karşı korunmalıdır.",
  "A.5.34": "Kuruluş, yürürlükteki yasa ve düzenlemeler ile sözleşmesel gereksinimlere göre gizliliğin korunması ve kişisel verilerin korunmasına ilişkin gereksinimleri belirlenmeli ve karşılamalıdır.",
  "A.5.35": "Kuruluşun bilgi güvenliğini yönetme yaklaşımı ve insan, süreç ve teknolojileri içeren uygulaması, planlanan aralıklarla veya önemli değişiklikler olduğunda bağımsız olarak gözden geçirilmelidir.",
  "A.5.36": "Kuruluşun bilgi güvenliği politikası, konuya özgü politikalar, kurallar ve standartlara uyumluluk düzenli olarak gözden geçirilmelidir.",
  "A.5.37": "Bilgi işleme tesisleri için işletim prosedürleri dokümante edilmeli ve ihtiyaç duyan personele sunulmalıdır.",
  "A.6.1": "Personel olmak için tüm adaylar üzerinde geçmiş doğrulama kontrolleri, kuruluşa katılmadan önce ve devam eden bir şekilde, yürürlükteki yasalar, düzenlemeler ve etik göz önünde bulundurularak ve iş gereksinimleri, erişilecek bilginin sınıflandırması ve algılanan risklerle orantılı olarak yapılmalıdır.",
  "A.6.2": "İstihdam sözleşmeleri, personelin ve kuruluşun bilgi güvenliği sorumluluklarını belirtmelidir.",
  "A.6.3": "Kuruluş personeli ve ilgili taraflar, iş fonksiyonlarına uygun olarak uygun bilgi güvenliği farkındalık, eğitim ve öğretimi ile kuruluşun bilgi güvenliği politikası, konuya özgü politikalar ve prosedürler hakkında düzenli güncellemeler almalıdır.",
  "A.6.4": "Bilgi güvenliği politikası ihlali gerçekleştiren personel ve diğer ilgili taraflara karşı önlem almak için disiplin süreci resmileştirilmeli ve iletilmelidir.",
  "A.6.5": "İşten ayrılma veya iş değişikliğinden sonra geçerli kalan bilgi güvenliği sorumlulukları ve görevleri tanımlanmalı, uygulanmalı ve ilgili personel ve diğer taraflara iletilmelidir.",
  "A.6.6": "Kuruluşun bilgi koruma ihtiyaçlarını yansıtan gizlilik veya ifşa etmeme anlaşmaları belirlenmeli, dokümante edilmeli, düzenli olarak gözden geçirilmeli ve personel ve diğer ilgili taraflar tarafından imzalanmalıdır.",
  "A.6.7": "Personel uzaktan çalışırken, kuruluşun tesisleri dışında erişilen, işlenen veya depolanan bilgiyi korumak için güvenlik önlemleri uygulanmalıdır.",
  "A.6.8": "Kuruluş, personelin gözlemlenen veya şüphelenilen bilgi güvenliği olaylarını uygun kanallar aracılığıyla zamanında bildirmesi için bir mekanizma sağlamalıdır.",
  "A.7.1": "Bilgi ve ilişkili varlıkları içeren alanları korumak için güvenlik çevreleri tanımlanmalı ve kullanılmalıdır.",
  "A.7.2": "Güvenli alanlar, uygun giriş kontrolleri ve erişim noktalarıyla korunmalıdır.",
  "A.7.3": "Ofis, oda ve tesisler için fiziksel güvenlik tasarlanmalı ve uygulanmalıdır.",
  "A.7.4": "Tesisler, yetkisiz fiziksel erişim için sürekli izlenmelidir.",
  "A.7.5": "Doğal afetler ve altyapıya yönelik kasıtlı veya kasıtsız fiziksel tehditler gibi fiziksel ve çevresel tehditlere karşı koruma tasarlanmalı ve uygulanmalıdır.",
  "A.7.6": "Güvenli alanlarda çalışmak için güvenlik önlemleri tasarlanmalı ve uygulanmalıdır.",
  "A.7.7": "Kağıtlar ve çıkarılabilir depolama ortamları için temiz masa kuralları ve bilgi işleme tesisleri için temiz ekran kuralları tanımlanmalı ve uygun şekilde uygulanmalıdır.",
  "A.7.8": "Ekipman güvenli bir şekilde yerleştirilmeli ve korunmalıdır.",
  "A.7.9": "Tesis dışı varlıklar korunmalıdır.",
  "A.7.10": "Depolama ortamları, kuruluşun sınıflandırma şeması ve kullanım gereksinimlerine uygun olarak edinme, kullanma, taşıma ve imha yaşam döngüsü boyunca yönetilmelidir.",
  "A.7.11": "Bilgi işleme tesisleri, güç kesintileri ve destekleyici altyapı hizmetlerindeki arızaların neden olduğu diğer kesintilere karşı korunmalıdır.",
  "A.7.12": "Güç, veri veya destekleyici bilgi hizmetlerini taşıyan kablolar dinleme, parazit veya hasara karşı korunmalıdır.",
  "A.7.13": "Ekipman, bilginin erişilebilirliği, bütünlüğü ve gizliliğini sağlamak için doğru şekilde bakılmalıdır.",
  "A.7.14": "Depolama ortamı içeren ekipman parçaları, imha veya yeniden kullanımdan önce hassas verilerin ve lisanslı yazılımların kaldırıldığının veya güvenli bir şekilde üzerine yazıldığının doğrulanması gerekir.",
  "A.8.1": "Kullanıcı uç nokta cihazlarında depolanan, işlenen veya erişilebilen bilgi korunmalıdır.",
  "A.8.2": "Ayrıcalıklı erişim haklarının tahsisi ve kullanımı kısıtlanmalı ve yönetilmelidir.",
  "A.8.3": "Bilgi ve ilişkili varlıklara erişim, erişim kontrolü konuya özgü politikasına uygun olarak kısıtlanmalıdır.",
  "A.8.4": "Kaynak kod, geliştirme araçları ve yazılım kütüphanelerine okuma ve yazma erişimi uygun şekilde yönetilmelidir.",
  "A.8.5": "Güvenli kimlik doğrulama teknolojileri ve prosedürleri, bilgi erişim kısıtlamaları ve erişim kontrolü konuya özgü politikasına dayalı olarak uygulanmalıdır.",
  "A.8.6": "Kaynakların kullanımı izlenmeli ve mevcut ve beklenen kapasite gereksinimlerine göre ayarlanmalıdır.",
  "A.8.7": "Zararlı yazılımlara karşı koruma uygulanmalı ve uygun kullanıcı farkındalığı ile desteklenmelidir.",
  "A.8.8": "Kullanımdaki bilgi sistemlerinin teknik açıklıkları hakkında bilgi edinilmeli, kuruluşun bu açıklıklara maruziyeti değerlendirilmeli ve uygun önlemler alınmalıdır.",
  "A.8.9": "Donanım, yazılım, hizmetler ve ağların güvenlik yapılandırmaları dahil yapılandırmaları oluşturulmalı, dokümante edilmeli, uygulanmalı, izlenmeli ve gözden geçirilmelidir.",
  "A.8.10": "Bilgi sistemlerinde, cihazlarda veya diğer depolama ortamlarında saklanan bilgi, artık gerekli olmadığında silinmelidir.",
  "A.8.11": "Veri maskeleme, kuruluşun erişim kontrolü konuya özgü politikası ve diğer ilgili politikalar ile iş gereksinimleri ve yürürlükteki mevzuat dikkate alınarak kullanılmalıdır.",
  "A.8.12": "Veri sızıntısı önleme tedbirleri, hassas bilgiyi işleyen, depolayan veya ileten sistemlere, ağlara ve diğer cihazlara uygulanmalıdır.",
  "A.8.13": "Bilgi, yazılım ve sistemlerin yedek kopyaları, yedekleme konuya özgü politikasına uygun olarak muhafaza edilmeli ve düzenli olarak test edilmelidir.",
  "A.8.14": "Bilgi işleme tesisleri, erişilebilirlik gereksinimlerini karşılamak için yeterli yedeklilik ile uygulanmalıdır.",
  "A.8.15": "Aktiviteleri, istisnaları, hataları ve diğer ilgili olayları kaydeden günlükler üretilmeli, depolanmalı, korunmalı ve analiz edilmelidir.",
  "A.8.16": "Ağlar, sistemler ve uygulamalar anormal davranışlar için izlenmeli ve potansiyel bilgi güvenliği olaylarını değerlendirmek için uygun önlemler alınmalıdır.",
  "A.8.17": "Kuruluş tarafından kullanılan bilgi işleme sistemlerinin saatleri, onaylı zaman kaynaklarına senkronize edilmelidir.",
  "A.8.18": "Sistem ve uygulama kontrollerini geçersiz kılabilen yardımcı programların kullanımı kısıtlanmalı ve sıkı şekilde kontrol edilmelidir.",
  "A.8.19": "İşletim sistemlerine yazılım kurulumunu güvenli bir şekilde yönetmek için prosedürler ve önlemler uygulanmalıdır.",
  "A.8.20": "Sistemler ve uygulamalardaki bilgiyi korumak için ağlar ve ağ cihazları güvenli hale getirilmeli, yönetilmeli ve kontrol edilmelidir.",
  "A.8.21": "Ağ hizmetlerinin güvenlik mekanizmaları, hizmet seviyeleri ve hizmet gereksinimleri belirlenmeli, uygulanmalı ve izlenmelidir.",
  "A.8.22": "Bilgi hizmetleri, kullanıcılar ve bilgi sistemleri grupları kuruluşun ağlarında ayrılmalıdır.",
  "A.8.23": "Zararlı içeriğe maruziyeti azaltmak için dış web sitelerine erişim yönetilmelidir.",
  "A.8.24": "Kriptografik anahtar yönetimi dahil olmak üzere kriptografinin etkin kullanımı için kurallar tanımlanmalı ve uygulanmalıdır.",
  "A.8.25": "Yazılım ve sistemlerin güvenli geliştirilmesi için kurallar oluşturulmalı ve uygulanmalıdır.",
  "A.8.26": "Uygulamalar geliştirilirken veya edinilirken bilgi güvenliği gereksinimleri belirlenmeli, tanımlanmalı ve onaylanmalıdır.",
  "A.8.27": "Güvenli sistemler mühendisliği ilkeleri oluşturulmalı, dokümante edilmeli, sürdürülmeli ve herhangi bir bilgi sistemi geliştirme faaliyetine uygulanmalıdır.",
  "A.8.28": "Güvenli kodlama ilkeleri yazılım geliştirmeye uygulanmalıdır.",
  "A.8.29": "Güvenlik test süreçleri geliştirme yaşam döngüsünde tanımlanmalı ve uygulanmalıdır.",
  "A.8.30": "Kuruluş, dış kaynaklı sistem geliştirme ile ilgili faaliyetleri yönlendirmeli, izlemeli ve gözden geçirmelidir.",
  "A.8.31": "Geliştirme, test ve üretim ortamları ayrılmalı ve güvenlik altına alınmalıdır.",
  "A.8.32": "Bilgi işleme tesisleri ve bilgi sistemlerindeki değişiklikler, değişiklik yönetimi prosedürlerine tabi olmalıdır.",
  "A.8.33": "Test bilgileri uygun şekilde seçilmeli, korunmalı ve yönetilmelidir.",
  "A.8.34": "İşletim sistemlerinin değerlendirmesini içeren denetim testleri ve diğer güvence faaliyetleri, test eden ve uygun yönetim arasında planlanmalı ve üzerinde anlaşılmalıdır.",
}

interface Control {
  id: string
  controlId: string
  title: string
  titleTr: string
  description: string
  descriptionTr: string | null
  category: string
  categoryNumber: number
  controlNumber: number
  status: string
  applicability: boolean
  justification: string | null
  implementationNotes: string | null
  implementationDate: string | null
  controlSource: string | null
  relatedAssets: string | null
  responsibleName: string | null
  responsibleEmail: string | null
  lastReviewDate: string | null
  nextReviewDate: string | null
  _count: {
    documents: number
    evidences: number
  }
}

export default function Iso27001ControlsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const highlightedControlRef = useRef<HTMLDivElement>(null)

  // URL'den gelen kontrol ID'si
  const targetControlId = searchParams.get("id")

  const [controls, setControls] = useState<Control[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<string>("ORGANIZATIONAL")
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingControl, setEditingControl] = useState<Control | null>(null)
  const [saving, setSaving] = useState(false)

  // Doküman state
  const [allDocuments, setAllDocuments] = useState<{ id: string; documentNumber: string; title: string }[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  // Kanıt state
  const [controlEvidences, setControlEvidences] = useState<{
    id: string
    title: string
    evidenceType: string
    fileName: string | null
    fileUrl: string | null
    evidenceDate: string
  }[]>([])
  const [loadingEvidences, setLoadingEvidences] = useState(false)
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState({
    title: "",
    description: "",
    evidenceType: "DOCUMENT",
    file: null as File | null,
  })
  const [isDragging, setIsDragging] = useState(false)

  // Kanıt görüntüleme dialog state
  const [isEvidenceDialogOpen, setIsEvidenceDialogOpen] = useState(false)
  const [viewingControlId, setViewingControlId] = useState<string | null>(null)
  const [viewingControlName, setViewingControlName] = useState<string>("")
  const [viewEvidences, setViewEvidences] = useState<typeof controlEvidences>([])
  const [loadingViewEvidences, setLoadingViewEvidences] = useState(false)

  // Hızlı kanıt ekleme dialog state
  const [isQuickEvidenceDialogOpen, setIsQuickEvidenceDialogOpen] = useState(false)
  const [quickEvidenceControl, setQuickEvidenceControl] = useState<Control | null>(null)
  const [quickEvidenceFile, setQuickEvidenceFile] = useState<File | null>(null)
  const [quickEvidenceTitle, setQuickEvidenceTitle] = useState("")
  const [quickEvidenceUploading, setQuickEvidenceUploading] = useState(false)
  const [quickIsDragging, setQuickIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Mevcut kanıtlardan seçme state
  const [allEvidences, setAllEvidences] = useState<{
    id: string
    title: string
    evidenceType: string
    fileName: string | null
    fileUrl: string
    usedInControls: string[]
  }[]>([])
  const [loadingAllEvidences, setLoadingAllEvidences] = useState(false)
  const [evidenceTab, setEvidenceTab] = useState<"new" | "existing">("new")
  const [linkingEvidence, setLinkingEvidence] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({
    status: "",
    applicability: true,
    justification: "",
    implementationNotes: "",
    controlSource: "",
    relatedAssets: "",
    responsibleName: "",
    responsibleEmail: "",
  })

  // Kontrolleri yükle - useCallback ile memoize
  const fetchControls = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory !== "all") params.append("category", selectedCategory)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (searchQuery) params.append("search", searchQuery)

      const res = await fetch(`/api/iso27001/controls?${params}`)
      if (res.ok) {
        const data = await res.json()
        setControls(data)
      }
    } catch (error) {
      console.error("Kontroller yuklenemedi:", error)
      toast.error("Kontroller yuklenemedi")
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, selectedStatus, searchQuery])

  useEffect(() => {
    fetchControls()
  }, [fetchControls])

  // URL'den gelen kontrol ID'sine göre sekme ve accordion'u ayarla
  useEffect(() => {
    if (targetControlId && controls.length > 0) {
      // Kontrol numarasından kategoriyi belirle (A.5.x -> ORGANIZATIONAL, A.6.x -> PEOPLE, vb.)
      const categoryNum = targetControlId.split(".")[1]
      let category = "ORGANIZATIONAL"
      if (categoryNum === "5") category = "ORGANIZATIONAL"
      else if (categoryNum === "6") category = "PEOPLE"
      else if (categoryNum === "7") category = "PHYSICAL"
      else if (categoryNum === "8") category = "TECHNOLOGICAL"

      setActiveTab(category)

      // İlgili kontrolü bul ve accordion'u aç
      const targetControl = controls.find(c => c.controlId === targetControlId)
      if (targetControl) {
        setExpandedItems([targetControl.id])

        // Biraz bekle ve sonra scroll yap
        setTimeout(() => {
          const element = document.getElementById(`control-${targetControl.id}`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
            // Highlight efekti için class ekle
            element.classList.add("ring-2", "ring-primary", "ring-offset-2")
            setTimeout(() => {
              element.classList.remove("ring-2", "ring-primary", "ring-offset-2")
            }, 3000)
          }
        }, 300)
      }

      // URL'den id parametresini temizle
      router.replace("/iso27001/controls", { scroll: false })
    }
  }, [targetControlId, controls, router])

  // Dokümanları yükle
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/iso27001/documents")
      if (res.ok) {
        const data = await res.json()
        setAllDocuments(data.documents || data)
      }
    } catch (error) {
      console.error("Dokumanlar yuklenemedi:", error)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Kontrole bağlı dokümanları yükle
  const fetchControlDocuments = async (controlId: string) => {
    try {
      setLoadingDocs(true)
      const res = await fetch(`/api/iso27001/controls/${controlId}/documents`)
      if (res.ok) {
        const data = await res.json()
        setSelectedDocIds(data.documents?.map((d: any) => d.id) || [])
      }
    } catch (error) {
      console.error("Kontrol dokumanlari yuklenemedi:", error)
      setSelectedDocIds([])
    } finally {
      setLoadingDocs(false)
    }
  }

  // Kontrole bağlı kanıtları yükle
  const fetchControlEvidences = async (controlId: string) => {
    try {
      setLoadingEvidences(true)
      const res = await fetch(`/api/iso27001/controls/${controlId}/evidences`)
      if (res.ok) {
        const data = await res.json()
        setControlEvidences(data.evidences || [])
      }
    } catch (error) {
      console.error("Kontrol kanitlari yuklenemedi:", error)
      setControlEvidences([])
    } finally {
      setLoadingEvidences(false)
    }
  }

  // Kanıt yükle
  const handleUploadEvidence = async () => {
    console.log("[Frontend] handleUploadEvidence called")
    console.log("[Frontend] editingControl:", editingControl?.controlId)
    console.log("[Frontend] evidenceForm:", evidenceForm)

    if (!editingControl || !evidenceForm.title) {
      console.log("[Frontend] Validation failed - missing control or title")
      toast.error("Kanit basligi zorunludur")
      return
    }

    try {
      setUploadingEvidence(true)
      const formData = new FormData()
      formData.append("title", evidenceForm.title)
      formData.append("description", evidenceForm.description)
      formData.append("evidenceType", evidenceForm.evidenceType)
      if (evidenceForm.file) {
        formData.append("file", evidenceForm.file)
        console.log("[Frontend] File added:", evidenceForm.file.name, evidenceForm.file.size)
      }

      const url = `/api/iso27001/controls/${editingControl.controlId}/evidences`
      console.log("[Frontend] Calling API:", url)

      const res = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      console.log("[Frontend] Response status:", res.status)

      if (res.ok) {
        const data = await res.json()
        console.log("[Frontend] Success:", data)
        toast.success("Kanit yuklendi")
        setEvidenceForm({ title: "", description: "", evidenceType: "DOCUMENT", file: null })
        fetchControlEvidences(editingControl.controlId)
        fetchControls() // Evidence sayısını güncellemek için
      } else {
        const error = await res.json()
        console.log("[Frontend] Error response:", error)
        toast.error(error.error || "Kanit yuklenemedi")
      }
    } catch (error) {
      console.error("[Frontend] Exception:", error)
      const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
      toast.error(`Kanit yukleme hatasi: ${errorMessage}`)
    } finally {
      setUploadingEvidence(false)
    }
  }

  // Kanıt sil
  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!editingControl) return

    try {
      const res = await fetch(
        `/api/iso27001/controls/${editingControl.controlId}/evidences?evidenceId=${evidenceId}`,
        { method: "DELETE" }
      )

      if (res.ok) {
        toast.success("Kanit silindi")
        fetchControlEvidences(editingControl.controlId)
        fetchControls()
      } else {
        toast.error("Kanit silinemedi")
      }
    } catch (error) {
      toast.error("Silme hatasi")
    }
  }

  // Tüm mevcut kanıtları yükle
  const fetchAllEvidences = async () => {
    try {
      setLoadingAllEvidences(true)
      const res = await fetch("/api/iso27001/evidences")
      if (res.ok) {
        const data = await res.json()
        setAllEvidences(data.evidences || [])
      }
    } catch (error) {
      console.error("Tum kanitlar yuklenemedi:", error)
      setAllEvidences([])
    } finally {
      setLoadingAllEvidences(false)
    }
  }

  // Mevcut kanıtı kontrole bağla
  const handleLinkEvidence = async (evidenceId: string) => {
    if (!editingControl) return

    try {
      setLinkingEvidence(true)
      const res = await fetch("/api/iso27001/evidences/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceId,
          controlId: editingControl.controlId
        })
      })

      if (res.ok) {
        toast.success("Kanıt başarıyla bağlandı")
        fetchControlEvidences(editingControl.controlId)
        fetchAllEvidences() // Kullanım listesini güncelle
        fetchControls()
      } else {
        const error = await res.json()
        toast.error(error.error || "Kanıt bağlanamadı")
      }
    } catch (error) {
      toast.error("Bağlama hatası")
    } finally {
      setLinkingEvidence(false)
    }
  }

  // Kanıtları görüntüle (dialog için)
  const handleViewEvidences = async (controlId: string, controlName: string) => {
    setViewingControlId(controlId)
    setViewingControlName(controlName)
    setIsEvidenceDialogOpen(true)
    setLoadingViewEvidences(true)
    try {
      const res = await fetch(`/api/iso27001/controls/${controlId}/evidences`)
      if (res.ok) {
        const data = await res.json()
        setViewEvidences(data.evidences || [])
      }
    } catch (error) {
      console.error("Kanitlar yuklenemedi:", error)
      setViewEvidences([])
    } finally {
      setLoadingViewEvidences(false)
    }
  }

  // Hızlı kanıt ekleme dialog'unu aç
  const handleQuickAddEvidence = (control: Control) => {
    setQuickEvidenceControl(control)
    setQuickEvidenceFile(null)
    setQuickEvidenceTitle("")
    setIsQuickEvidenceDialogOpen(true)
  }

  // Hızlı kanıt yükleme - XMLHttpRequest ile (Service Worker bypass + progress bar)
  const handleQuickUploadEvidence = () => {
    if (!quickEvidenceControl || !quickEvidenceTitle.trim()) {
      toast.error("Kanıt başlığı zorunludur")
      return
    }

    setQuickEvidenceUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append("title", quickEvidenceTitle.trim())
    formData.append("evidenceType", "DOCUMENT")
    if (quickEvidenceFile) {
      formData.append("file", quickEvidenceFile)
    }

    const xhr = new XMLHttpRequest()

    // Progress event
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        setUploadProgress(percent)
      }
    })

    // Load event (success)
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success("Kanıt başarıyla eklendi!")
        setIsQuickEvidenceDialogOpen(false)
        setQuickEvidenceFile(null)
        setQuickEvidenceTitle("")
        setUploadProgress(0)
        fetchControls()
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          toast.error(error.error || "Kanıt eklenemedi")
        } catch {
          toast.error("Kanıt eklenemedi")
        }
      }
      setQuickEvidenceUploading(false)
    })

    // Error event
    xhr.addEventListener("error", () => {
      console.error("XHR Error:", xhr.statusText)
      toast.error("Bağlantı hatası - lütfen tekrar deneyin")
      setQuickEvidenceUploading(false)
      setUploadProgress(0)
    })

    // Timeout event
    xhr.addEventListener("timeout", () => {
      toast.error("Yükleme zaman aşımına uğradı")
      setQuickEvidenceUploading(false)
      setUploadProgress(0)
    })

    // Abort event
    xhr.addEventListener("abort", () => {
      toast.info("Yükleme iptal edildi")
      setQuickEvidenceUploading(false)
      setUploadProgress(0)
    })

    // Configure and send - timestamp ile cache bypass
    const url = `/api/iso27001/controls/${quickEvidenceControl.controlId}/evidences?_t=${Date.now()}`
    xhr.open("POST", url)
    xhr.timeout = 300000 // 5 dakika timeout
    xhr.withCredentials = true
    xhr.send(formData)
  }

  // Seed kontroller
  const handleSeed = async () => {
    try {
      setSeeding(true)
      const res = await fetch("/api/iso27001/controls/seed", { method: "POST" })
      const data = await res.json()

      if (res.ok) {
        toast.success(data.message)
        fetchControls()
      } else {
        toast.error(data.error || data.message)
      }
    } catch (error) {
      toast.error("Seed islemi basarisiz")
    } finally {
      setSeeding(false)
    }
  }

  // Arama
  const handleSearch = () => {
    fetchControls()
  }

  // Düzenleme dialogunu aç
  const handleEdit = (control: Control) => {
    setEditingControl(control)
    setEditForm({
      status: control.status,
      applicability: control.applicability,
      justification: control.justification || "",
      implementationNotes: control.implementationNotes || "",
      controlSource: control.controlSource || "",
      relatedAssets: control.relatedAssets || "",
      responsibleName: control.responsibleName || "",
      responsibleEmail: control.responsibleEmail || "",
    })
    setSelectedDocIds([])
    setControlEvidences([])
    setEvidenceForm({ title: "", description: "", evidenceType: "DOCUMENT", file: null })
    setEvidenceTab("new")
    fetchControlDocuments(control.controlId)
    fetchControlEvidences(control.controlId)
    fetchAllEvidences()
    setIsEditDialogOpen(true)
  }

  // Kontrolü güncelle
  const handleSave = async () => {
    if (!editingControl) return

    try {
      setSaving(true)

      // Kontrol bilgilerini güncelle
      const res = await fetch("/api/iso27001/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlId: editingControl.controlId,
          ...editForm,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Guncelleme basarisiz")
        return
      }

      // Doküman bağlantılarını güncelle
      const docRes = await fetch(`/api/iso27001/controls/${editingControl.controlId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: selectedDocIds }),
      })

      if (docRes.ok) {
        toast.success("Kontrol ve dokumanlar guncellendi")
      } else {
        toast.success("Kontrol guncellendi (dokuman baglama hatasi)")
      }

      setIsEditDialogOpen(false)
      fetchControls()
    } catch (error) {
      toast.error("Guncelleme sirasinda hata olustu")
    } finally {
      setSaving(false)
    }
  }

  // İstatistikler - useMemo ile cache
  const stats = useMemo(() => ({
    total: controls.length,
    implemented: controls.filter(c => c.status === "IMPLEMENTED" || c.status === "EFFECTIVE").length,
    partial: controls.filter(c => c.status === "PARTIALLY").length,
    notImplemented: controls.filter(c => c.status === "NOT_IMPLEMENTED").length,
    notApplicable: controls.filter(c => c.status === "NOT_APPLICABLE").length,
  }), [controls])

  const compliancePercentage = useMemo(() => {
    if (stats.total === 0) return 0
    const applicable = stats.total - stats.notApplicable
    return applicable > 0 ? Math.round((stats.implemented / applicable) * 100) : 0
  }, [stats])

  // Kategoriye göre grupla - useMemo ile cache
  const groupedControls = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat.value] = controls.filter(c => c.category === cat.value)
      return acc
    }, {} as Record<string, Control[]>)
  }, [controls])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            ISO 27001:2022 Kontrol Listesi
          </h1>
          <p className="text-muted-foreground">
            Annex A - 93 Kontrol (4 Kategori)
          </p>
        </div>
        {controls.length === 0 && (
          <Button onClick={handleSeed} disabled={seeding}>
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Yukleniyor...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                93 Kontrolu Yukle
              </>
            )}
          </Button>
        )}
      </div>

      {/* İstatistikler */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Toplam Kontrol</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.implemented}</div>
            <p className="text-sm text-muted-foreground">Uygulandı</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.partial}</div>
            <p className="text-sm text-muted-foreground">Kısmen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.notImplemented}</div>
            <p className="text-sm text-muted-foreground">Uygulanmadı</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{compliancePercentage}%</div>
            <Progress value={compliancePercentage} className="mt-2" />
            <p className="text-sm text-muted-foreground">Uyumluluk</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kontrol ara (A.5.1, politika, erişim...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.entries(STATUS_MAP).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-2" />
              Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kontrol Listesi */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Kontroller yükleniyor...
        </div>
      ) : controls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Kontrol Bulunamadı</h3>
            <p className="text-muted-foreground mb-4">
              ISO 27001:2022 standartının 93 kontrolünü yüklemek için butona tıklayın.
            </p>
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding ? "Yükleniyor..." : "93 Kontrolü Yükle"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            {CATEGORIES.map(cat => {
              const catControls = groupedControls[cat.value] || []
              const implemented = catControls.filter(c => c.status === "IMPLEMENTED" || c.status === "EFFECTIVE").length
              const CatIcon = cat.icon
              return (
                <TabsTrigger key={cat.value} value={cat.value} className="flex items-center gap-2">
                  <CatIcon className={`h-4 w-4 ${cat.color}`} />
                  <span className="hidden md:inline">{cat.label.split(" ")[0]}</span>
                  <Badge variant="outline" className="ml-1">
                    {implemented}/{catControls.length}
                  </Badge>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {CATEGORIES.map(cat => {
            const catControls = groupedControls[cat.value] || []
            const CatIcon = cat.icon

            return (
              <TabsContent key={cat.value} value={cat.value}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CatIcon className={`h-5 w-5 ${cat.color}`} />
                      {cat.label}
                    </CardTitle>
                    <CardDescription>
                      {cat.labelEn} - {catControls.length} kontrol
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems} className="space-y-2">
                      {catControls.map(control => {
                        const statusInfo = STATUS_MAP[control.status] || STATUS_MAP.NOT_APPLICABLE
                        const StatusIcon = statusInfo.icon

                        return (
                          <AccordionItem
                            key={control.id}
                            value={control.id}
                            id={`control-${control.id}`}
                            className="border rounded-lg px-4 transition-all"
                          >
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-4 text-left">
                                <Badge variant="outline" className="font-mono">
                                  {control.controlId}
                                </Badge>
                                <div className="flex-1">
                                  <p className="font-medium">{control.titleTr}</p>
                                  <p className="text-xs text-muted-foreground">{control.title}</p>
                                </div>
                                <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusInfo.label}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-4 pt-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Açıklama</Label>
                                  <p className="text-sm">{TURKISH_DESCRIPTIONS[control.controlId] || control.descriptionTr || control.description}</p>
                                </div>

                                {control.controlSource && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Kaynak</Label>
                                    <p className="text-sm">{control.controlSource}</p>
                                  </div>
                                )}

                                {control.relatedAssets && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">İlgili Varlıklar</Label>
                                    <p className="text-sm">{control.relatedAssets}</p>
                                  </div>
                                )}

                                {control.implementationNotes && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Uygulanan Kontrol</Label>
                                    <p className="text-sm">{control.implementationNotes}</p>
                                  </div>
                                )}

                                {control.justification && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Seçilme Nedeni</Label>
                                    <p className="text-sm">{control.justification}</p>
                                  </div>
                                )}

                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  {control.responsibleName && (
                                    <span>Sorumlu: {control.responsibleName}</span>
                                  )}
                                  {control._count?.documents > 0 && (
                                    <Badge variant="outline">{control._count.documents} doküman</Badge>
                                  )}
                                  {control._count?.evidences > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="cursor-pointer hover:bg-primary/10"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleViewEvidences(control.controlId, `${control.controlId} - ${control.titleTr}`)
                                      }}
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      {control._count.evidences} kanıt
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  {control._count?.evidences > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewEvidences(control.controlId, `${control.controlId} - ${control.titleTr}`)}
                                    >
                                      <FileText className="h-4 w-4 mr-1" />
                                      Kanıtları Gör
                                    </Button>
                                  )}
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleQuickAddEvidence(control)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Upload className="h-4 w-4 mr-1" />
                                    Kanıt Ekle
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(control)}
                                  >
                                    Düzenle
                                  </Button>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      {/* Düzenleme Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingControl?.controlId} - Kontrol Düzenle
            </DialogTitle>
            <DialogDescription>
              {editingControl?.titleTr}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Uygulama Durumu</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kaynak</Label>
                <Input
                  value={editForm.controlSource}
                  onChange={(e) => setEditForm(prev => ({ ...prev, controlSource: e.target.value }))}
                  placeholder="BGYS, Yasal, Müşteri..."
                />
              </div>
              <div className="space-y-2">
                <Label>İlgili Varlıklar</Label>
                <Input
                  value={editForm.relatedAssets}
                  onChange={(e) => setEditForm(prev => ({ ...prev, relatedAssets: e.target.value }))}
                  placeholder="Mevcut Kontrol, Sunucular..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Uygulanan Kontrol</Label>
              <Textarea
                value={editForm.implementationNotes}
                onChange={(e) => setEditForm(prev => ({ ...prev, implementationNotes: e.target.value }))}
                placeholder="Bu kontrolün nasıl uygulandığını açıklayın..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Seçilme Nedeni</Label>
              <Textarea
                value={editForm.justification}
                onChange={(e) => setEditForm(prev => ({ ...prev, justification: e.target.value }))}
                placeholder="Kontrolün neden seçildiğini/uygulandığını açıklayın..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sorumlu Adı</Label>
                <Input
                  value={editForm.responsibleName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, responsibleName: e.target.value }))}
                  placeholder="Sorumlu kişi"
                />
              </div>
              <div className="space-y-2">
                <Label>Sorumlu E-posta</Label>
                <Input
                  type="email"
                  value={editForm.responsibleEmail}
                  onChange={(e) => setEditForm(prev => ({ ...prev, responsibleEmail: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            {/* Doküman Bağlama */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                İlgili Dokümanlar
                {loadingDocs && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                {allDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Henüz doküman eklenmemiş
                  </p>
                ) : (
                  allDocuments.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDocIds((prev) => [...prev, doc.id])
                          } else {
                            setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id))
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          {doc.documentNumber}
                        </span>
                        {doc.title}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {selectedDocIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedDocIds.length} doküman seçildi
                </p>
              )}
            </div>

            {/* Kanıt Yükleme */}
            <div className="space-y-3 border-t pt-4">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Kanıt Ekle
                {loadingEvidences && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>

              {/* Mevcut kanıtlar */}
              {controlEvidences.length > 0 && (
                <div className="border rounded-md p-2 space-y-1 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Bu Kontrolün Kanıtları ({controlEvidences.length})
                  </p>
                  {controlEvidences.map((ev) => {
                    const evType = EVIDENCE_TYPES.find((t) => t.value === ev.evidenceType)
                    const EvIcon = evType?.icon || File
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between p-2 bg-background rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <EvIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{ev.title}</span>
                          {ev.fileUrl && (
                            <a
                              href={ev.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline text-xs"
                            >
                              <Link className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEvidence(ev.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Sekme seçimi */}
              <div className="flex gap-2 border-b">
                <button
                  type="button"
                  onClick={() => setEvidenceTab("new")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    evidenceTab === "new"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload className="h-4 w-4 inline mr-1" />
                  Yeni Dosya Yükle
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceTab("existing")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    evidenceTab === "existing"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Link className="h-4 w-4 inline mr-1" />
                  Mevcut Kanıttan Seç
                </button>
              </div>

              {evidenceTab === "new" ? (
                /* Yeni kanıt formu */
                <div className="grid gap-3 border rounded-md p-3 bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Kanıt Başlığı <span className="text-red-500">*</span></Label>
                      <Input
                        value={evidenceForm.title}
                        onChange={(e) =>
                          setEvidenceForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="Ornegin: Firewall Konfigurasyonu"
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Kanıt Tipi</Label>
                      <Select
                        value={evidenceForm.evidenceType}
                        onValueChange={(value) =>
                          setEvidenceForm((prev) => ({ ...prev, evidenceType: value }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVIDENCE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Dosya (Opsiyonel)</Label>
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                        isDragging
                          ? "border-primary bg-primary/10"
                          : evidenceForm.file
                          ? "border-green-500 bg-green-50"
                          : "border-muted-foreground/25 hover:border-primary/50"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDragging(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDragging(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDragging(false)
                        const droppedFile = e.dataTransfer.files?.[0]
                        if (droppedFile) {
                          setEvidenceForm((prev) => ({ ...prev, file: droppedFile }))
                        }
                      }}
                      onClick={() => document.getElementById("evidence-file-input")?.click()}
                    >
                      <input
                        id="evidence-file-input"
                        type="file"
                        className="hidden"
                        onChange={(e) =>
                          setEvidenceForm((prev) => ({
                            ...prev,
                            file: e.target.files?.[0] || null,
                          }))
                        }
                      />
                      {evidenceForm.file ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                          <FileText className="h-5 w-5" />
                          <span className="font-medium">{evidenceForm.file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEvidenceForm((prev) => ({ ...prev, file: null }))
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">
                            {isDragging ? "Dosyayı bırakın..." : "Dosya sürükleyin veya tıklayın"}
                          </p>
                          <p className="text-xs mt-1">Max 50MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {!evidenceForm.title && (
                    <p className="text-xs text-red-500 mb-2">* Kanıt başlığı zorunludur</p>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      console.log("[Frontend] Button clicked!", { title: evidenceForm.title, file: evidenceForm.file?.name })
                      handleUploadEvidence()
                    }}
                    disabled={uploadingEvidence || !evidenceForm.title}
                    className="w-full"
                  >
                    {uploadingEvidence ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Yukleniyor...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Kanıt Ekle
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* Mevcut kanıtlardan seç */
                <div className="border rounded-md p-3 bg-muted/20">
                  {loadingAllEvidences ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Kanıtlar yükleniyor...</p>
                    </div>
                  ) : allEvidences.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Henüz yüklenmiş kanıt yok</p>
                      <p className="text-xs mt-1">İlk olarak "Yeni Dosya Yükle" sekmesinden kanıt ekleyin</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      <p className="text-xs text-muted-foreground mb-2">
                        Mevcut kanıtlardan birini seçerek bu kontrole bağlayabilirsiniz ({allEvidences.length} kanıt)
                      </p>
                      {allEvidences
                        .filter(ev => !ev.usedInControls.includes(editingControl?.controlId || ""))
                        .map((ev) => {
                          const evType = EVIDENCE_TYPES.find((t) => t.value === ev.evidenceType)
                          const EvIcon = evType?.icon || File
                          return (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between p-2 bg-background rounded text-sm border hover:border-primary/50 transition-colors"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <EvIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{ev.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {ev.fileName || "Dosya yok"} • Kullanıldığı kontroller: {ev.usedInControls.join(", ")}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLinkEvidence(ev.id)}
                                disabled={linkingEvidence}
                                className="ml-2 flex-shrink-0"
                              >
                                {linkingEvidence ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Link className="h-3 w-3 mr-1" />
                                    Bağla
                                  </>
                                )}
                              </Button>
                            </div>
                          )
                        })}
                      {allEvidences.filter(ev => !ev.usedInControls.includes(editingControl?.controlId || "")).length === 0 && (
                        <p className="text-center py-4 text-sm text-muted-foreground">
                          Tüm mevcut kanıtlar zaten bu kontrole bağlı
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kanıt Görüntüleme Dialog */}
      <Dialog open={isEvidenceDialogOpen} onOpenChange={setIsEvidenceDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Kanıtlar
            </DialogTitle>
            <DialogDescription>
              {viewingControlName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {loadingViewEvidences ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Kanıtlar yükleniyor...</p>
              </div>
            ) : viewEvidences.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Henüz kanıt eklenmemiş</p>
              </div>
            ) : (
              <div className="space-y-2">
                {viewEvidences.map((ev) => {
                  const evType = EVIDENCE_TYPES.find((t) => t.value === ev.evidenceType)
                  const EvIcon = evType?.icon || File
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center justify-between p-3 border rounded-lg bg-muted/30 ${ev.fileUrl ? "cursor-pointer hover:bg-muted/50" : ""}`}
                      onClick={() => ev.fileUrl && window.open(ev.fileUrl, "_blank")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background">
                          <EvIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {evType?.label || ev.evidenceType} • {new Date(ev.evidenceDate).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                      </div>
                      {ev.fileUrl ? (
                        <a
                          href={ev.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-4 w-4" />
                          İndir
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Dosya yok</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvidenceDialogOpen(false)}>
              Kapat
            </Button>
            <Button onClick={() => {
              setIsEvidenceDialogOpen(false)
              const control = controls.find(c => c.controlId === viewingControlId)
              if (control) handleEdit(control)
            }}>
              Kanıt Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hızlı Kanıt Ekleme Dialog */}
      <Dialog open={isQuickEvidenceDialogOpen} onOpenChange={setIsQuickEvidenceDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-600" />
              Kanıt Ekle
            </DialogTitle>
            <DialogDescription>
              {quickEvidenceControl?.controlId} - {quickEvidenceControl?.titleTr}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Kanıt Başlığı */}
            <div className="space-y-2">
              <Label>
                Kanıt Başlığı <span className="text-red-500">*</span>
              </Label>
              <Input
                value={quickEvidenceTitle}
                onChange={(e) => setQuickEvidenceTitle(e.target.value)}
                placeholder="Örn: Firewall Konfigürasyonu, Log Kayıtları"
                autoFocus
              />
            </div>

            {/* Dosya Yükleme Alanı */}
            <div className="space-y-2">
              <Label>Dosya (Opsiyonel)</Label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                  quickIsDragging
                    ? "border-green-500 bg-green-50"
                    : quickEvidenceFile
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:border-green-400 hover:bg-green-50/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setQuickIsDragging(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setQuickIsDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setQuickIsDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) {
                    setQuickEvidenceFile(file)
                    if (!quickEvidenceTitle) {
                      // Dosya adından başlık öner
                      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
                      setQuickEvidenceTitle(nameWithoutExt)
                    }
                  }
                }}
                onClick={() => document.getElementById("quick-evidence-file")?.click()}
              >
                <input
                  id="quick-evidence-file"
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setQuickEvidenceFile(file)
                      if (!quickEvidenceTitle) {
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
                        setQuickEvidenceTitle(nameWithoutExt)
                      }
                    }
                  }}
                />
                {quickEvidenceFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-10 w-10 text-green-600" />
                    <p className="font-medium text-green-700">{quickEvidenceFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(quickEvidenceFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setQuickEvidenceFile(null)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Kaldır
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-green-600">Dosya seçin</span> veya sürükleyin
                    </p>
                    <p className="text-xs text-gray-400">PDF, Word, Excel, Resim (Max 50MB)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {quickEvidenceUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Yükleniyor...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              {quickEvidenceFile && (
                <p className="text-xs text-muted-foreground text-center">
                  {quickEvidenceFile.name} ({(quickEvidenceFile.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsQuickEvidenceDialogOpen(false)}
              disabled={quickEvidenceUploading}
            >
              İptal
            </Button>
            <Button
              onClick={handleQuickUploadEvidence}
              disabled={quickEvidenceUploading || !quickEvidenceTitle.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {quickEvidenceUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  %{uploadProgress} Yükleniyor...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Kanıt Ekle
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
