"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  FileText,
  Calendar,
  Award,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-700", icon: Play },
  COMPLETED: { label: "Tamamlandi", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  SIGNED: { label: "Imzalandi", color: "bg-emerald-100 text-emerald-700", icon: Award },
  EXPIRED: { label: "Suresi Doldu", color: "bg-red-100 text-red-700", icon: AlertCircle },
}

const TRAINING_TYPES: Record<string, string> = {
  AWARENESS: "Farkindalik Egitimi",
  TECHNICAL: "Teknik Egitim",
  ORIENTATION: "Oryantasyon",
  REFRESHER: "Yenileme Egitimi",
  SPECIALIZED: "Ozel Egitim",
}

interface TrainingAssignment {
  id: string
  trainingId: string
  status: string
  assignedAt: string
  deadline: string | null
  startedAt: string | null
  viewTime: number
  progress: number
  quizScore: number | null
  completedAt: string | null
  signedAt: string | null
  training: {
    id: string
    trainingNumber: string
    title: string
    description: string | null
    trainingType: string
    duration: number
    isOnline: boolean
    contentType: string | null
    minViewTime: number | null
    hasQuiz: boolean
    passingScore: number | null
    trainerName: string
    controlId: string | null
  }
}

export default function MyTrainingsPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([])
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    signed: 0,
    expired: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMyTrainings()
  }, [])

  const fetchMyTrainings = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/iso27001/my-trainings")
      if (res.ok) {
        const data = await res.json()
        setAssignments(data.assignments || [])
        setStats(data.stats || {})
      } else {
        toast.error("Egitimler yuklenemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setLoading(false)
    }
  }

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return null
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { text: "Suresi gecti", color: "text-red-600" }
    if (diffDays === 0) return { text: "Bugun son gun", color: "text-red-600" }
    if (diffDays <= 3) return { text: `${diffDays} gun kaldi`, color: "text-orange-600" }
    if (diffDays <= 7) return { text: `${diffDays} gun kaldi`, color: "text-yellow-600" }
    return { text: `${diffDays} gun kaldi`, color: "text-muted-foreground" }
  }

  // Bekleyen ve devam eden egitimler
  const activeAssignments = assignments.filter(
    a => a.status === "PENDING" || a.status === "IN_PROGRESS" || a.status === "COMPLETED"
  )

  // Tamamlanan egitimler
  const completedAssignments = assignments.filter(a => a.status === "SIGNED")

  return (
    <div className="space-y-6 p-6">
      {/* Baslik */}
      <div>
        <h1 className="text-2xl font-bold">Egitimlerim</h1>
        <p className="text-muted-foreground">
          Size atanan BGYS egitimlerini goruntuleyip tamamlayabilirsiniz
        </p>
      </div>

      {/* Istatistikler */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Toplam</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending + stats.inProgress}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Imza Bekleyen</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
            <Award className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.signed}</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Yukleniyor...</div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Henuz size atanmis egitim bulunmuyor</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Aktif Egitimler */}
          {activeAssignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tamamlanmasi Gereken Egitimler</CardTitle>
                <CardDescription>
                  Asagidaki egitimleri tamamlayip imzalamaniz gerekmektedir
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeAssignments.map((assignment) => {
                    const statusInfo = STATUS_MAP[assignment.status] || STATUS_MAP.PENDING
                    const StatusIcon = statusInfo.icon
                    const deadlineStatus = getDeadlineStatus(assignment.deadline)

                    return (
                      <div
                        key={assignment.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{assignment.training.title}</h3>
                              <Badge className={statusInfo.color}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {statusInfo.label}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {assignment.training.description || "Egitim aciklamasi mevcut degil"}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <span className="text-muted-foreground">
                                {TRAINING_TYPES[assignment.training.trainingType]}
                              </span>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {assignment.training.duration} dk
                              </span>
                              <span className="text-muted-foreground">
                                Egitimci: {assignment.training.trainerName}
                              </span>
                              {deadlineStatus && (
                                <span className={`flex items-center gap-1 ${deadlineStatus.color}`}>
                                  <Calendar className="h-3 w-3" />
                                  {deadlineStatus.text}
                                </span>
                              )}
                            </div>

                            {/* Ilerleme cubugu */}
                            {(assignment.status === "IN_PROGRESS" || assignment.progress > 0) && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Ilerleme</span>
                                  <span>{assignment.progress}%</span>
                                </div>
                                <Progress value={assignment.progress} className="h-2" />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <Link href={`/my-trainings/${assignment.training.id}`}>
                              <Button
                                variant={assignment.status === "COMPLETED" ? "default" : "outline"}
                              >
                                {assignment.status === "PENDING" && (
                                  <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Basla
                                  </>
                                )}
                                {assignment.status === "IN_PROGRESS" && (
                                  <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Devam Et
                                  </>
                                )}
                                {assignment.status === "COMPLETED" && (
                                  <>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Imzala
                                  </>
                                )}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tamamlanan Egitimler */}
          {completedAssignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tamamlanan Egitimler</CardTitle>
                <CardDescription>
                  Basariyla tamamladiginiz ve imzaladiginiz egitimler
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Award className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">{assignment.training.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Imzalandi:{" "}
                            {assignment.signedAt
                              ? new Date(assignment.signedAt).toLocaleDateString("tr-TR")
                              : "-"}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Tamamlandi
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
