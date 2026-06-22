"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  Lightbulb,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  User,
  Building2,
  Calendar,
  MessageSquare,
  Send,
  Undo2,
  Edit,
  Trash2,
  FileText,
  Target,
  Banknote,
  ThumbsUp,
  ThumbsDown,
  History,
  Paperclip,
  Download,
  Image,
  File
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Category {
  id: string
  name: string
  color: string
}

interface Comment {
  id: string
  content: string
  authorEmail: string
  authorName: string
  createdAt: string
}

interface Timeline {
  id: string
  action: string
  description: string
  performedBy: string
  performedByName: string
  oldStatus?: string
  newStatus?: string
  createdAt: string
}

interface Attachment {
  name: string
  url: string
  type: string
  size?: number
  uploadedAt?: string
}

interface Suggestion {
  id: string
  suggestionNumber: string
  title: string
  description: string
  currentSituation?: string
  proposedSolution?: string
  expectedBenefit?: string
  estimatedSavings?: number
  actualSavings?: number
  status: string
  priority: string
  suggestionType: string
  submittedBy: string
  submittedByName: string
  submittedByDept?: string
  isAnonymous: boolean
  submittedAt: string
  updatedAt: string
  category?: Category
  evaluatorName?: string
  evaluatorComments?: string
  implementationNotes?: string
  rejectionReason?: string
  attachments?: string // JSON string of Attachment[]
  comments: Comment[]
  timeline: Timeline[]
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUBMITTED: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
  UNDER_REVIEW: { label: 'İnceleniyor', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle },
  PENDING_APPROVAL: { label: 'Onay Bekliyor', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock },
  APPROVED: { label: 'Onaylandı', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  REJECTED: { label: 'Reddedildi', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  IN_PROGRESS: { label: 'Uygulamada', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: TrendingUp },
  IMPLEMENTED: { label: 'Uygulandı', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  CLOSED: { label: 'Kapatıldı', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: XCircle },
  WITHDRAWN: { label: 'Geri Çekildi', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Undo2 },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Düşük', color: 'bg-gray-100 text-gray-600' },
  NORMAL: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  HIGH: { label: 'Yüksek', color: 'bg-orange-100 text-orange-600' },
  CRITICAL: { label: 'Kritik', color: 'bg-red-100 text-red-600' },
}

const typeConfig: Record<string, string> = {
  IMPROVEMENT: 'İyileştirme',
  COST_REDUCTION: 'Maliyet Azaltma',
  SAFETY: 'İş Güvenliği',
  QUALITY: 'Kalite',
  EFFICIENCY: 'Verimlilik',
  ENVIRONMENT: 'Çevre',
  OTHER: 'Diğer',
}

export default function SuggestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { data: session } = useSession()
  const router = useRouter()

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Dialog states
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  // Approval states
  const [permissions, setPermissions] = useState<{
    isOwner: boolean
    isSubmitterManager: boolean
    isBoardMember: boolean
    canManagerApprove: boolean
    canBoardApprove: boolean
  } | null>(null)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')
  const [processing, setProcessing] = useState(false)

  // Delete state (admin only)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchSuggestion()
    fetchPermissions()
  }, [resolvedParams.id])

  const fetchPermissions = async () => {
    try {
      const res = await fetch(`/api/suggestions/${resolvedParams.id}/permissions`)
      if (res.ok) {
        const data = await res.json()
        setPermissions(data)
      }
    } catch (error) {
      console.error('Yetkiler yüklenirken hata:', error)
    }
  }

  const fetchSuggestion = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/suggestions/${resolvedParams.id}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestion(data)
      } else if (res.status === 404) {
        toast.error('Öneri bulunamadı')
        router.push('/suggestions')
      }
    } catch (error) {
      console.error('Öneri yüklenirken hata:', error)
      toast.error('Öneri yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/suggestions/${resolvedParams.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      })

      if (res.ok) {
        toast.success('Yorum eklendi')
        setNewComment('')
        fetchSuggestion()
      } else {
        toast.error('Yorum eklenirken bir hata oluştu')
      }
    } catch {
      toast.error('Yorum eklenirken bir hata oluştu')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    try {
      const res = await fetch(`/api/suggestions/${resolvedParams.id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: withdrawReason })
      })

      if (res.ok) {
        toast.success('Öneri geri çekildi')
        setShowWithdrawDialog(false)
        setWithdrawReason('')
        fetchSuggestion()
        fetchPermissions()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Öneri geri çekilirken bir hata oluştu')
      }
    } catch {
      toast.error('Öneri geri çekilirken bir hata oluştu')
    } finally {
      setWithdrawing(false)
    }
  }

  const handleApprove = async () => {
    setProcessing(true)
    try {
      // Manager mı yoksa Kurul üyesi mi karar ver
      const decision = permissions?.canManagerApprove ? 'MANAGER_APPROVE' : 'APPROVE'

      const res = await fetch(`/api/suggestions/${resolvedParams.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          comments: approvalComment
        })
      })

      if (res.ok) {
        toast.success(permissions?.canManagerApprove
          ? 'Öneri onaylandı ve Öneri Kuruluna iletildi'
          : 'Öneri onaylandı')
        setShowApproveDialog(false)
        setApprovalComment('')
        fetchSuggestion()
        fetchPermissions()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Öneri onaylanırken bir hata oluştu')
      }
    } catch {
      toast.error('Öneri onaylanırken bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!approvalComment.trim()) {
      toast.error('Lütfen red gerekçesi giriniz')
      return
    }

    setProcessing(true)
    try {
      // Manager mı yoksa Kurul üyesi mi karar ver
      const decision = permissions?.canManagerApprove ? 'MANAGER_REJECT' : 'REJECT'

      const res = await fetch(`/api/suggestions/${resolvedParams.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          comments: approvalComment
        })
      })

      if (res.ok) {
        toast.success('Öneri reddedildi')
        setShowRejectDialog(false)
        setApprovalComment('')
        fetchSuggestion()
        fetchPermissions()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Öneri reddedilirken bir hata oluştu')
      }
    } catch {
      toast.error('Öneri reddedilirken bir hata oluştu')
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const canWithdraw = () => {
    if (!suggestion || !session?.user?.email) return false
    // Sadece öneriyi gönderen kişi geri çekebilir
    // ve sadece belirli durumlarda (henüz onaylanmamış/uygulanmamış)
    const isOwner = suggestion.submittedBy === session.user.email
    const withdrawableStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL']
    return isOwner && withdrawableStatuses.includes(suggestion.status)
  }

  // Admin kontrolü - sadece melih.dilben silebilir
  const isAdmin = session?.user?.email?.toLowerCase() === 'melih.dilben@ilerigroup.com'

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/suggestions/${resolvedParams.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Öneri başarıyla silindi')
        router.push('/suggestions?module=suggestions')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Öneri silinirken bir hata oluştu')
      }
    } catch {
      toast.error('Öneri silinirken bir hata oluştu')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="classic-spinner" />
      </div>
    )
  }

  if (!suggestion) {
    return (
      <div className="text-center py-12">
        <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Öneri bulunamadı</p>
        <Button className="mt-4" onClick={() => window.location.href = '/suggestions?module=suggestions'}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri Dön
        </Button>
      </div>
    )
  }

  const status = statusConfig[suggestion.status] || statusConfig.SUBMITTED
  const StatusIcon = status.icon
  const priority = priorityConfig[suggestion.priority] || priorityConfig.NORMAL

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.location.href = '/suggestions?module=suggestions'}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground font-mono">
                {suggestion.suggestionNumber}
              </span>
              {suggestion.category && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: suggestion.category.color + '20',
                    color: suggestion.category.color
                  }}
                >
                  {suggestion.category.name}
                </span>
              )}
              <Badge className={priority.color} variant="secondary">
                {priority.label}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{suggestion.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-sm py-1 px-3", status.color)}>
            <StatusIcon className="h-4 w-4 mr-1" />
            {status.label}
          </Badge>

          {/* Manager veya Kurul Onay Butonları */}
          {(permissions?.canManagerApprove || permissions?.canBoardApprove) && (
            <>
              <Button
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => setShowApproveDialog(true)}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Onayla
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowRejectDialog(true)}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Reddet
              </Button>
            </>
          )}

          {canWithdraw() && (
            <Button
              variant="outline"
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
              onClick={() => setShowWithdrawDialog(true)}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Geri Çek
            </Button>
          )}

          {/* Admin Silme Butonu */}
          {isAdmin && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Sil
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Öneri Detayları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">Açıklama</Label>
                <p className="mt-1 whitespace-pre-wrap">{suggestion.description}</p>
              </div>

              {suggestion.currentSituation && (
                <div>
                  <Label className="text-muted-foreground text-sm">Mevcut Durum</Label>
                  <p className="mt-1 whitespace-pre-wrap">{suggestion.currentSituation}</p>
                </div>
              )}

              {suggestion.proposedSolution && (
                <div>
                  <Label className="text-muted-foreground text-sm">Önerilen Çözüm</Label>
                  <p className="mt-1 whitespace-pre-wrap">{suggestion.proposedSolution}</p>
                </div>
              )}

              {suggestion.expectedBenefit && (
                <div>
                  <Label className="text-muted-foreground text-sm">Beklenen Fayda</Label>
                  <p className="mt-1 whitespace-pre-wrap">{suggestion.expectedBenefit}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Info */}
          {(suggestion.estimatedSavings || suggestion.actualSavings) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Finansal Bilgiler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {suggestion.estimatedSavings && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600 mb-1">Tahmini Tasarruf</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {suggestion.estimatedSavings.toLocaleString('tr-TR')} ₺
                      </p>
                    </div>
                  )}
                  {suggestion.actualSavings && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600 mb-1">Gerçekleşen Tasarruf</p>
                      <p className="text-2xl font-bold text-green-700">
                        {suggestion.actualSavings.toLocaleString('tr-TR')} ₺
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {suggestion.attachments && (() => {
            try {
              const attachments: Attachment[] = JSON.parse(suggestion.attachments)
              if (attachments.length > 0) {
                const formatFileSize = (bytes?: number) => {
                  if (!bytes) return ''
                  if (bytes < 1024) return bytes + ' B'
                  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
                  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
                }

                const getFileIcon = (type: string) => {
                  if (type.startsWith('image/')) return <Image className="h-4 w-4" />
                  return <File className="h-4 w-4" />
                }

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Paperclip className="h-5 w-5" />
                        Ekler ({attachments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {attachments.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="p-2 bg-background rounded">
                              {getFileIcon(file.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              {file.size && (
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                              )}
                            </div>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-background rounded transition-colors"
                              title="İndir"
                            >
                              <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              }
            } catch {
              return null
            }
            return null
          })()}

          {/* Evaluation Info */}
          {(suggestion.evaluatorComments || suggestion.implementationNotes || suggestion.rejectionReason) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Değerlendirme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {suggestion.evaluatorName && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Değerlendiren</Label>
                    <p className="mt-1">{suggestion.evaluatorName}</p>
                  </div>
                )}
                {suggestion.evaluatorComments && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Değerlendirme Notu</Label>
                    <p className="mt-1 whitespace-pre-wrap">{suggestion.evaluatorComments}</p>
                  </div>
                )}
                {suggestion.implementationNotes && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Uygulama Notları</Label>
                    <p className="mt-1 whitespace-pre-wrap">{suggestion.implementationNotes}</p>
                  </div>
                )}
                {suggestion.rejectionReason && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                    <Label className="text-red-600 text-sm">Red Gerekçesi</Label>
                    <p className="mt-1 text-red-700 whitespace-pre-wrap">{suggestion.rejectionReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Yorumlar ({suggestion.comments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment */}
              <div className="flex gap-2">
                <Input
                  placeholder="Yorum yazın..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                />
                <Button onClick={handleAddComment} disabled={submittingComment || !newComment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Comments List */}
              {suggestion.comments && suggestion.comments.length > 0 ? (
                <div className="space-y-3">
                  {suggestion.comments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{comment.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatShortDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Henüz yorum yapılmamış
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Approval Status Card */}
          {(permissions?.isSubmitterManager || permissions?.isBoardMember) && (
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Onay Durumu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Mevcut aşama */}
                  <div className="flex items-center gap-2 text-sm">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      suggestion.status === 'SUBMITTED' || suggestion.status === 'UNDER_REVIEW'
                        ? 'bg-yellow-500 animate-pulse'
                        : 'bg-green-500'
                    )} />
                    <span>1. Yönetici Onayı</span>
                    {(suggestion.status !== 'SUBMITTED' && suggestion.status !== 'UNDER_REVIEW') && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      suggestion.status === 'PENDING_APPROVAL'
                        ? 'bg-yellow-500 animate-pulse'
                        : suggestion.status === 'APPROVED' || suggestion.status === 'IMPLEMENTED' || suggestion.status === 'IN_PROGRESS'
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                    )} />
                    <span>2. Kurul Onayı</span>
                    {(suggestion.status === 'APPROVED' || suggestion.status === 'IMPLEMENTED' || suggestion.status === 'IN_PROGRESS') && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                    )}
                  </div>

                  {/* Yetki bilgisi */}
                  {permissions?.canManagerApprove && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                      Bu öneri sizin onayınızı bekliyor.
                    </div>
                  )}
                  {permissions?.canBoardApprove && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                      Bu öneri Kurul onayını bekliyor.
                    </div>
                  )}
                  {permissions?.isBoardMember && !permissions?.canBoardApprove && suggestion.status === 'REJECTED' && (
                    <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                      Bu öneri reddedildi.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Gönderen</p>
                  <p className="font-medium">
                    {suggestion.isAnonymous ? 'Anonim' : suggestion.submittedByName}
                  </p>
                </div>
              </div>

              {suggestion.submittedByDept && !suggestion.isAnonymous && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Departman</p>
                    <p className="font-medium">{suggestion.submittedByDept}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Gönderim Tarihi</p>
                  <p className="font-medium">{formatDate(suggestion.submittedAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Öneri Tipi</p>
                  <p className="font-medium">{typeConfig[suggestion.suggestionType] || 'Diğer'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Geçmiş
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestion.timeline && suggestion.timeline.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {suggestion.timeline.map((item, index) => (
                      <div key={item.id} className="relative pl-6">
                        <div className="absolute left-0 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                        <div>
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.performedByName} • {formatShortDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Henüz işlem geçmişi yok
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Withdraw Dialog */}
      <AlertDialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-orange-500" />
              Öneriyi Geri Çek
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bu öneriyi geri çekmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Geri Çekme Nedeni (İsteğe Bağlı)</Label>
            <textarea
              className="w-full min-h-[80px] mt-2 px-3 py-2 border rounded-md"
              placeholder="Öneriyi neden geri çekiyorsunuz?"
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawing}>İptal</AlertDialogCancel>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {withdrawing ? 'Geri Çekiliyor...' : 'Geri Çek'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
              Öneriyi Onayla
            </DialogTitle>
            <DialogDescription>
              {permissions?.canManagerApprove
                ? 'Bu öneriyi onayladığınızda Öneri Kuruluna iletilecektir.'
                : 'Bu öneriyi onayladığınızda onay süreci tamamlanacaktır.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Değerlendirme Notu (İsteğe Bağlı)</Label>
            <textarea
              className="w-full min-h-[80px] mt-2 px-3 py-2 border rounded-md"
              placeholder="Varsa eklemek istediğiniz notları yazın..."
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={processing}>
              İptal
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? 'Onaylanıyor...' : 'Onayla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              Öneriyi Reddet
            </DialogTitle>
            <DialogDescription>
              Bu öneriyi reddetmek üzeresiniz. Lütfen red gerekçenizi belirtin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Red Gerekçesi *</Label>
            <textarea
              className="w-full min-h-[80px] mt-2 px-3 py-2 border rounded-md"
              placeholder="Öneriyi neden reddediyorsunuz?"
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={processing}>
              İptal
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing || !approvalComment.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? 'Reddediliyor...' : 'Reddet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog - Admin Only */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Öneriyi Sil
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{suggestion?.suggestionNumber}</strong> numaralı öneriyi kalıcı olarak silmek istediğinizden emin misiniz?
              <br /><br />
              <span className="text-red-500 font-medium">
                Bu işlem geri alınamaz! Öneri ve tüm ilişkili kayıtlar (yorumlar, onay geçmişi, timeline) kalıcı olarak silinecektir.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Siliniyor...' : 'Evet, Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
