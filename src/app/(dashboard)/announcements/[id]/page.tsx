"use client"

import { useState, useEffect, use, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import DOMPurify from "dompurify"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Pin,
  Clock,
  Eye,
  Heart,
  MessageSquare,
  ThumbsUp,
  PartyPopper,
  Lightbulb,
  HandHeart,
  Send,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Trash2,
  User
} from "lucide-react"

interface Category {
  id: string
  name: string
  color: string | null
}

interface Question {
  id: string
  questionText: string
  questionType: string
  isRequired: boolean
  options: {
    id: string
    optionText: string
    isOther: boolean
  }[]
}

interface Survey {
  id: string
  title: string
  description: string | null
  status: string
  questions: Question[]
}

interface Comment {
  id: string
  authorEmail: string
  authorName: string
  content: string
  createdAt: string
  replies: Comment[]
}

interface Announcement {
  id: string
  title: string
  summary: string | null
  content: string
  category: Category | null
  priority: string
  status: string
  isPinned: boolean
  publishedAt: string | null
  createdAt: string
  authorName: string
  authorEmail: string
  viewCount: number
  allowComments: boolean
  allowReactions: boolean
  requireAcknowledgment: boolean
  isRead: boolean
  isAcknowledged: boolean
  hasRespondedToSurvey: boolean
  survey: Survey | null
  comments: Comment[]
  userReactions: string[]
  reactionCounts: Record<string, number>
  _count: {
    reads: number
    comments: number
    reactions: number
  }
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: "Dusuk", color: "bg-gray-100 text-gray-800" },
  NORMAL: { label: "Normal", color: "bg-blue-100 text-blue-800" },
  HIGH: { label: "Yuksek", color: "bg-orange-100 text-orange-800" },
  URGENT: { label: "Acil", color: "bg-red-100 text-red-800" }
}

const reactionTypes = [
  { type: "LIKE", icon: ThumbsUp, label: "Begendim" },
  { type: "LOVE", icon: Heart, label: "Sevdim" },
  { type: "CELEBRATE", icon: PartyPopper, label: "Kutluyorum" },
  { type: "INSIGHTFUL", icon: Lightbulb, label: "Aydinlatici" },
  { type: "SUPPORT", icon: HandHeart, label: "Destek" }
]

export default function AnnouncementDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, unknown>>({})
  const [submittingSurvey, setSubmittingSurvey] = useState(false)

  const userEmail = session?.user?.email?.toLowerCase() || ""
  const userRole = session?.user?.role || "EMPLOYEE"
  const isAdmin = userEmail === "melih.dilben@ilerigroup.com" ||
                  userRole === "ADMIN" ||
                  userRole === "SUPER_ADMIN"

  const fetchAnnouncement = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/announcements/${id}`)
      if (res.ok) {
        const data = await res.json()
        setAnnouncement(data)
      } else if (res.status === 404) {
        router.push("/announcements")
      }
    } catch (error) {
      console.error("Duyuru yüklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchAnnouncement()
  }, [fetchAnnouncement])

  const handleReaction = async (reactionType: string) => {
    if (!announcement?.allowReactions) return

    try {
      const res = await fetch(`/api/announcements/${id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType })
      })

      if (res.ok) {
        fetchAnnouncement()
      }
    } catch (error) {
      console.error("Tepki eklenirken hata:", error)
    }
  }

  const handleComment = async () => {
    if (!newComment.trim() || !announcement?.allowComments) return

    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/announcements/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment })
      })

      if (res.ok) {
        setNewComment("")
        fetchAnnouncement()
      }
    } catch (error) {
      console.error("Yorum eklenirken hata:", error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}/comment?commentId=${commentId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        fetchAnnouncement()
      }
    } catch (error) {
      console.error("Yorum silinirken hata:", error)
    }
  }

  const handleAcknowledge = async () => {
    setAcknowledging(true)
    try {
      const res = await fetch(`/api/announcements/${id}/acknowledge`, {
        method: "POST"
      })

      if (res.ok) {
        fetchAnnouncement()
      }
    } catch (error) {
      console.error("Onay verilirken hata:", error)
    } finally {
      setAcknowledging(false)
    }
  }

  const handleSurveySubmit = async () => {
    if (!announcement?.survey) return

    setSubmittingSurvey(true)
    try {
      const answers = Object.entries(surveyAnswers).map(([questionId, value]) => {
        const question = announcement.survey?.questions.find(q => q.id === questionId)
        if (!question) return null

        const answer: Record<string, unknown> = { questionId }

        if (question.questionType === "SINGLE_CHOICE" || question.questionType === "DROPDOWN") {
          answer.optionId = value
        } else if (question.questionType === "MULTIPLE_CHOICE") {
          answer.optionIds = value
        } else if (question.questionType === "RATING" || question.questionType === "SCALE") {
          answer.numericAnswer = value
        } else if (question.questionType === "YES_NO") {
          answer.textAnswer = value
        } else {
          answer.textAnswer = value
        }

        return answer
      }).filter(Boolean)

      const res = await fetch(`/api/surveys/${announcement.survey.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      })

      if (res.ok) {
        fetchAnnouncement()
      }
    } catch (error) {
      console.error("Anket yaniti gonderilirken hata:", error)
    } finally {
      setSubmittingSurvey(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    return new Date(dateString).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="classic-spinner" />
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Duyuru bulunamadi</h2>
        <Button asChild className="mt-4">
          <Link href="/announcements">Duyurulara Don</Link>
        </Button>
      </div>
    )
  }

  const priority = priorityConfig[announcement.priority]

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/announcements">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Duyurulara Don
        </Link>
      </Button>

      {/* Main Content */}
      <Card className={announcement.priority === "URGENT" ? "border-red-300" : ""}>
        <CardHeader>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {announcement.isPinned && (
              <Badge variant="secondary" className="gap-1">
                <Pin className="h-3 w-3" />
                Sabitlenmis
              </Badge>
            )}
            {announcement.category && (
              <Badge
                variant="outline"
                style={{
                  backgroundColor: announcement.category.color || undefined,
                  color: announcement.category.color ? "#fff" : undefined
                }}
              >
                {announcement.category.name}
              </Badge>
            )}
            <Badge className={priority?.color}>
              {priority?.label}
            </Badge>
          </div>

          <CardTitle className="text-2xl">{announcement.title}</CardTitle>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {announcement.authorName}
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDate(announcement.publishedAt || announcement.createdAt)}
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {announcement.viewCount} goruntulenme
            </span>
          </div>
        </CardHeader>

        <CardContent>
          {/* Content - XSS korumalı */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none mb-6"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(announcement.content) }}
          />

          {/* Acknowledgment */}
          {announcement.requireAcknowledgment && (
            <div className={`p-4 rounded-lg border ${
              announcement.isAcknowledged
                ? "bg-green-50 border-green-200 dark:bg-green-950/20"
                : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20"
            }`}>
              {announcement.isAcknowledged ? (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Bu duyuruyu okudugunuzu onayladiniz</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Bu duyuru okundu onayi gerektiriyor</span>
                  </div>
                  <Button onClick={handleAcknowledge} disabled={acknowledging}>
                    {acknowledging ? "Onaylaniyor..." : "Okudum, Onayliyorum"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Survey */}
          {announcement.survey && announcement.survey.status === "ACTIVE" && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="h-5 w-5" />
                  {announcement.survey.title}
                </CardTitle>
                {announcement.survey.description && (
                  <p className="text-sm text-muted-foreground">
                    {announcement.survey.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {announcement.hasRespondedToSurvey ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Bu anketi zaten yanitladiniz</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {announcement.survey.questions.map((question) => (
                      <div key={question.id} className="space-y-3">
                        <label className="font-medium">
                          {question.questionText}
                          {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>

                        {(question.questionType === "SINGLE_CHOICE" ||
                          question.questionType === "DROPDOWN") && (
                          <div className="space-y-2">
                            {question.options.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={question.id}
                                  value={option.id}
                                  checked={surveyAnswers[question.id] === option.id}
                                  onChange={() =>
                                    setSurveyAnswers({ ...surveyAnswers, [question.id]: option.id })
                                  }
                                  className="h-4 w-4"
                                />
                                {option.optionText}
                              </label>
                            ))}
                          </div>
                        )}

                        {question.questionType === "MULTIPLE_CHOICE" && (
                          <div className="space-y-2">
                            {question.options.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    (surveyAnswers[question.id] as string[] || []).includes(option.id)
                                  }
                                  onChange={(e) => {
                                    const current = (surveyAnswers[question.id] as string[] || [])
                                    if (e.target.checked) {
                                      setSurveyAnswers({
                                        ...surveyAnswers,
                                        [question.id]: [...current, option.id]
                                      })
                                    } else {
                                      setSurveyAnswers({
                                        ...surveyAnswers,
                                        [question.id]: current.filter(id => id !== option.id)
                                      })
                                    }
                                  }}
                                  className="h-4 w-4"
                                />
                                {option.optionText}
                              </label>
                            ))}
                          </div>
                        )}

                        {question.questionType === "YES_NO" && (
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={question.id}
                                value="yes"
                                checked={surveyAnswers[question.id] === "yes"}
                                onChange={() =>
                                  setSurveyAnswers({ ...surveyAnswers, [question.id]: "yes" })
                                }
                                className="h-4 w-4"
                              />
                              Evet
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={question.id}
                                value="no"
                                checked={surveyAnswers[question.id] === "no"}
                                onChange={() =>
                                  setSurveyAnswers({ ...surveyAnswers, [question.id]: "no" })
                                }
                                className="h-4 w-4"
                              />
                              Hayir
                            </label>
                          </div>
                        )}

                        {question.questionType === "RATING" && (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((num) => (
                              <Button
                                key={num}
                                variant={surveyAnswers[question.id] === num ? "default" : "outline"}
                                size="sm"
                                onClick={() =>
                                  setSurveyAnswers({ ...surveyAnswers, [question.id]: num })
                                }
                              >
                                {num}
                              </Button>
                            ))}
                          </div>
                        )}

                        {question.questionType === "SCALE" && (
                          <div className="flex gap-1 flex-wrap">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <Button
                                key={num}
                                variant={surveyAnswers[question.id] === num ? "default" : "outline"}
                                size="sm"
                                onClick={() =>
                                  setSurveyAnswers({ ...surveyAnswers, [question.id]: num })
                                }
                              >
                                {num}
                              </Button>
                            ))}
                          </div>
                        )}

                        {(question.questionType === "TEXT_SHORT" ||
                          question.questionType === "TEXT_LONG") && (
                          <Textarea
                            value={(surveyAnswers[question.id] as string) || ""}
                            onChange={(e) =>
                              setSurveyAnswers({ ...surveyAnswers, [question.id]: e.target.value })
                            }
                            rows={question.questionType === "TEXT_LONG" ? 4 : 2}
                            placeholder="Yanitinizi yazin..."
                          />
                        )}
                      </div>
                    ))}

                    <Button
                      onClick={handleSurveySubmit}
                      disabled={submittingSurvey}
                      className="w-full"
                    >
                      {submittingSurvey ? "Gonderiliyor..." : "Anketi Gonder"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Separator className="my-6" />

          {/* Reactions */}
          {announcement.allowReactions && (
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-muted-foreground mr-2">Tepki ver:</span>
              {reactionTypes.map(({ type, icon: Icon, label }) => {
                const count = announcement.reactionCounts[type] || 0
                const isActive = announcement.userReactions.includes(type)

                return (
                  <Button
                    key={type}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleReaction(type)}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                    {count > 0 && <span className="ml-1">{count}</span>}
                  </Button>
                )
              })}
            </div>
          )}

          {/* Comments */}
          {announcement.allowComments && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Yorumlar ({announcement._count.comments})
              </h3>

              {/* New Comment */}
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Yorum yazin..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handleComment}
                  disabled={!newComment.trim() || submittingComment}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Comment List */}
              <div className="space-y-4">
                {announcement.comments.map((comment) => (
                  <div key={comment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{comment.authorName}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                      </div>
                      {(comment.authorEmail === userEmail || isAdmin) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm">{comment.content}</p>

                    {/* Replies */}
                    {comment.replies.length > 0 && (
                      <div className="ml-8 mt-4 space-y-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="border-l-2 pl-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{reply.authorName}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {announcement.comments.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Henuz yorum yapilmamis. Ilk yorumu siz yapin!
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
