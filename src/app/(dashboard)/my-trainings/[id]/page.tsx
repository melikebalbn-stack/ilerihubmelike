"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  Play,
  FileText,
  ArrowLeft,
  User,
  Shield,
  AlertTriangle,
  Lock,
  Award,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

// PDF Viewer - client-side only
const PDFViewer = dynamic(
  () => import("@/components/training/PDFViewer").then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="text-center py-8">PDF yukleniyor...</div> }
)

export default function TrainingViewPage() {
  const params = useParams()
  const router = useRouter()
  const trainingId = params.id as string

  const [assignment, setAssignment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [viewTime, setViewTime] = useState(0)
  const [progress, setProgress] = useState(0)
  const [started, setStarted] = useState(false)
  const [showSignDialog, setShowSignDialog] = useState(false)
  const [signing, setSigning] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [allPagesViewed, setAllPagesViewed] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchTraining()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [trainingId])

  const fetchTraining = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/iso27001/my-trainings/${trainingId}`)
      if (res.ok) {
        const data = await res.json()
        setAssignment(data)
        setViewTime(data.viewTime || 0)
        setProgress(data.progress || 0)
        setStarted(data.status !== "PENDING")
      } else {
        toast.error("Egitim bulunamadi")
        router.push("/my-trainings")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setLoading(false)
    }
  }

  const startTraining = async () => {
    try {
      const res = await fetch(`/api/iso27001/my-trainings/${trainingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      })

      if (res.ok) {
        setStarted(true)
        toast.success("Egitim basladi")

        // Goruntuleme sayacini baslat
        timerRef.current = setInterval(() => {
          setViewTime((prev) => prev + 1)
        }, 1000)

        // PDF varsa ilerleme PDF sayfa takibine gore olacak
        // PDF yoksa simule et
        if (!assignment?.training?.contentUrl) {
          progressIntervalRef.current = setInterval(() => {
            setProgress((prev) => {
              const newProgress = Math.min(prev + 1, 100)
              if (newProgress % 10 === 0) {
                saveProgress(newProgress)
              }
              return newProgress
            })
          }, 1000)
        }
      }
    } catch (error) {
      toast.error("Egitim baslatilamadi")
    }
  }

  // PDF sayfa degisikligi
  const handlePageChange = useCallback((current: number, total: number) => {
    setCurrentPage(current)
    setTotalPages(total)
    const newProgress = Math.round((current / total) * 100)
    setProgress(newProgress)
    saveProgress(newProgress)
  }, [])

  // Tum PDF sayfalari goruntulendi
  const handleAllPagesViewed = useCallback(() => {
    setAllPagesViewed(true)
    setProgress(100)
    saveProgress(100)
    toast.success("Tum sayfalar goruntulendi! Simdi egitimi tamamlayabilirsiniz.")
  }, [])

  const saveProgress = async (currentProgress: number) => {
    try {
      await fetch(`/api/iso27001/my-trainings/${trainingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress",
          viewTime: 10, // Son 10 saniye
          progress: currentProgress,
        }),
      })
    } catch (error) {
      console.error("Ilerleme kaydedilemedi:", error)
    }
  }

  const completeTraining = async () => {
    try {
      const res = await fetch(`/api/iso27001/my-trainings/${trainingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      })

      if (res.ok) {
        if (timerRef.current) clearInterval(timerRef.current)
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)

        toast.success("Egitim tamamlandi! Simdi imzalayabilirsiniz.")
        setShowSignDialog(true)
        fetchTraining()
      }
    } catch (error) {
      toast.error("Egitim tamamlanamadi")
    }
  }

  const signTraining = async () => {
    if (!password) {
      toast.error("Lutfen sifrenizi girin")
      return
    }

    if (!confirmed) {
      toast.error("Lutfen onay kutusunu isaretleyin")
      return
    }

    try {
      setSigning(true)
      const res = await fetch(`/api/iso27001/my-trainings/${trainingId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          confirmation: "Egitimi tamamladigimi ve anladigimi onayliyorum.",
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("Egitim basariyla imzalandi!")
        setShowSignDialog(false)
        router.push("/my-trainings")
      } else {
        toast.error(data.error || "Imza atilamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setSigning(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Yukleniyor...</div>
      </div>
    )
  }

  if (!assignment) {
    return null
  }

  const training = assignment.training
  const isCompleted = assignment.status === "COMPLETED" || assignment.status === "SIGNED"
  const hasPDF = training.contentUrl && training.contentType === "PDF"
  const canComplete = hasPDF ? (allPagesViewed && !isCompleted) : (progress >= 100 && !isCompleted)
  const needsSignature = assignment.status === "COMPLETED"

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Geri butonu */}
      <Link href="/my-trainings">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Egitimlerime Don
        </Button>
      </Link>

      {/* Egitim Bilgileri */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{training.title}</CardTitle>
              <CardDescription className="mt-1">
                {training.trainingNumber} | Egitimci: {training.trainerName}
              </CardDescription>
            </div>
            <Badge
              className={
                assignment.status === "SIGNED"
                  ? "bg-emerald-100 text-emerald-700"
                  : assignment.status === "COMPLETED"
                  ? "bg-green-100 text-green-700"
                  : assignment.status === "IN_PROGRESS"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-yellow-100 text-yellow-700"
              }
            >
              {assignment.status === "SIGNED" && "Imzalandi"}
              {assignment.status === "COMPLETED" && "Tamamlandi"}
              {assignment.status === "IN_PROGRESS" && "Devam Ediyor"}
              {assignment.status === "PENDING" && "Bekliyor"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {training.description || "Bu egitim ISO 27001 kapsaminda bilgi guvenligi farkindaligi icin hazirlanmistir."}
          </p>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Sure: {training.duration} dakika</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Egitimci: {training.trainerName}</span>
            </div>
            {training.controlId && (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Kontrol: {training.controlId}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Egitim Icerigi */}
      <Card>
        <CardHeader>
          <CardTitle>Egitim Icerigi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ilerleme */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Ilerleme</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Goruntuleme suresi: {formatTime(viewTime)}</span>
              {training.minViewTime && (
                <span>
                  Minimum: {formatTime(training.minViewTime)} (
                  {Math.min(100, Math.round((viewTime / training.minViewTime) * 100))}%)
                </span>
              )}
            </div>
          </div>

          {/* Icerik Alani */}
          <div className="border rounded-lg bg-muted/30 min-h-[400px] flex flex-col items-center justify-center p-8">
            {!started ? (
              <div className="text-center space-y-4">
                <GraduationCap className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Egitimi Baslatmaya Hazir Misiniz?</h3>
                <p className="text-muted-foreground max-w-md">
                  Egitimi baslattiginizda goruntuleme sureciniz kaydedilecektir.
                  Egitimi tamamlamak icin tum icerigi izlemeniz gerekmektedir.
                </p>
                <Button onClick={startTraining} size="lg">
                  <Play className="mr-2 h-5 w-5" />
                  Egitimi Baslat
                </Button>
              </div>
            ) : assignment.status === "SIGNED" ? (
              <div className="text-center space-y-4">
                <Award className="mx-auto h-16 w-16 text-green-500" />
                <h3 className="text-lg font-semibold text-green-700">Egitim Tamamlandi!</h3>
                <p className="text-muted-foreground">
                  Bu egitimi basariyla tamamladiniz ve imzaladiniz.
                </p>
                <p className="text-sm text-muted-foreground">
                  Imza tarihi:{" "}
                  {assignment.signedAt
                    ? new Date(assignment.signedAt).toLocaleString("tr-TR")
                    : "-"}
                </p>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Egitim icerigi */}
                {hasPDF ? (
                  // PDF Goruntüleyici
                  <PDFViewer
                    url={training.contentUrl}
                    onPageChange={handlePageChange}
                    onAllPagesViewed={handleAllPagesViewed}
                    minTimePerPage={5} // Her sayfa icin minimum 5 saniye
                  />
                ) : (
                  // Varsayilan metin icerigi
                  <div className="prose prose-sm max-w-none">
                    <h2>BGYS Farkindalik Egitimi</h2>
                    <h3>1. Bilgi Guvenligi Nedir?</h3>
                    <p>
                      Bilgi guvenligi, bilginin gizliligi, butunlugu ve erisilebilirliginin
                      korunmasidir. Kuruluslarin en degerli varliklari arasinda bilgi yer almaktadir.
                    </p>

                    <h3>2. ISO 27001 Standardi</h3>
                    <p>
                      ISO 27001, bilgi guvenligi yonetim sistemi (BGYS) icin uluslararasi bir standarttir.
                      Bu standart, organizasyonlarin bilgi varliklarini sistematik bir sekilde korumalarini saglar.
                    </p>

                    <h3>3. Calisan Sorumluluklari</h3>
                    <ul>
                      <li>Guclu sifreler kullanin ve kimseyle paylasmayin</li>
                      <li>Suphe duydugunuz e-postalari acmayin</li>
                      <li>Is bilgilerini yetkisiz kisilerle paylasmayin</li>
                      <li>Bilgisayarinizi kilitlemeden ayrilmayin</li>
                      <li>Guvenlik olaylarini hemen bildirin</li>
                    </ul>

                    <h3>4. Guvenlik Olaylari</h3>
                    <p>
                      Herhangi bir guvenlik olayini (veri sizintisi, saldiri girisimi, suphe duydugunuz
                      durumlar) hemen IT ekibine bildirmelisiniz.
                    </p>
                  </div>
                )}

                {/* Tamamlama butonu */}
                {canComplete && (
                  <div className="flex justify-center pt-4 border-t">
                    <Button onClick={completeTraining} size="lg">
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Egitimi Tamamla
                    </Button>
                  </div>
                )}

                {needsSignature && (
                  <div className="flex justify-center pt-4 border-t">
                    <Button onClick={() => setShowSignDialog(true)} size="lg">
                      <FileText className="mr-2 h-5 w-5" />
                      Egitimi Imzala
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Imza Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Dijital Imza
            </DialogTitle>
            <DialogDescription>
              Egitimi tamamladiginizi onaylamak icin sifrenizi girin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Onemli Bilgi</p>
                  <p className="text-yellow-700">
                    Bu dijital imza yasal baglayiciligi olan bir beyandır.
                    Imzaladiginizda egitimi tamamladiginizi ve anladiginizi kabul etmis olursunuz.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Onay PIN</Label>
              <Input
                type="text"
                placeholder="ONAY veya 4 haneli PIN girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Imzalamayi onaylamak icin &quot;ONAY&quot; yazin veya 4 haneli bir PIN girin
              </p>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="confirmation"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <label
                htmlFor="confirmation"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Bu egitimi tamamladigimi, icerigi anladigimi ve bilgi guvenligi
                kurallarini uygulamaya sozu verdigimi beyan ederim.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>
              Iptal
            </Button>
            <Button onClick={signTraining} disabled={signing || !password || !confirmed}>
              {signing ? "Imzalaniyor..." : "Imzala ve Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
