"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Send, X, Calendar, MapPin, Building2, Users, FileText, CheckSquare } from "lucide-react"

interface Participant {
  name: string
  title: string
  company: "ILERI_GROUP" | "VISITED_COMPANY"
}

interface ActionItem {
  description: string
  responsible: string
  dueDate: string
  status: string
}

interface Recipient {
  name: string
  email: string
}

interface ReportData {
  visitDate: string
  endDate?: string
  visitTime: string
  companyName: string
  visitType: string
  location?: string
  project?: string
  meetingSummary: string
  additionalNotes?: string
  nextSteps?: string
  ourPeople: Participant[]
  theirPeople: Participant[]
  actionItems: ActionItem[]
  recipients: Recipient[]
}

interface ReportPreviewModalProps {
  open: boolean
  onClose: () => void
  onSend: () => void
  data: ReportData
  loading?: boolean
}

const visitTypeLabels: Record<string, string> = {
  CUSTOMER: "Müşteri Ziyareti",
  SUPPLIER: "Tedarikçi Ziyareti",
  FAIR: "Fuar/Etkinlik",
  TECHNICAL: "Teknik Görüşme",
  AUDIT: "Denetim/Audit",
  TRAINING: "Eğitim",
  OTHER: "Diğer"
}

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı"
}

export function ReportPreviewModal({
  open,
  onClose,
  onSend,
  data,
  loading
}: ReportPreviewModalProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    try {
      return format(new Date(dateStr), "d MMMM yyyy", { locale: tr })
    } catch {
      return dateStr
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapor Önizleme
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">Ziyaret Raporu</h2>
                <p className="text-blue-100 mt-1">{data.companyName}</p>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {visitTypeLabels[data.visitType] || data.visitType}
              </Badge>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Tarih</p>
                <p className="font-medium">{formatDate(data.visitDate)}</p>
              </div>
            </div>
            {data.endDate && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Bitiş</p>
                  <p className="font-medium">{formatDate(data.endDate)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Saat</p>
                <p className="font-medium">{data.visitTime}</p>
              </div>
            </div>
            {data.location && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Konum</p>
                  <p className="font-medium text-sm">{data.location}</p>
                </div>
              </div>
            )}
          </div>

          {data.project && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">İlgili Proje</p>
              <p className="font-medium">{data.project}</p>
            </div>
          )}

          {/* Participants */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">İleri Group&apos;tan</h3>
              </div>
              <div className="space-y-2">
                {data.ourPeople.filter(p => p.name).map((person, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="font-medium">{person.name}</span>
                    {person.title && (
                      <span className="text-muted-foreground">- {person.title}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold">Görüşülen Kişiler</h3>
              </div>
              <div className="space-y-2">
                {data.theirPeople.filter(p => p.name).map((person, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <span className="font-medium">{person.name}</span>
                    {person.title && (
                      <span className="text-muted-foreground">- {person.title}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meeting Summary */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Görüşme Özeti</h3>
            <p className="text-sm whitespace-pre-wrap">{data.meetingSummary}</p>
          </div>

          {/* Action Items */}
          {data.actionItems.filter(a => a.description).length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold">Aksiyon Maddeleri</h3>
              </div>
              <div className="space-y-2">
                {data.actionItems.filter(a => a.description).map((action, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded text-sm">
                    <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{action.description}</p>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        {action.responsible && <span>Sorumlu: {action.responsible}</span>}
                        {action.dueDate && <span>Tarih: {formatDate(action.dueDate)}</span>}
                        <Badge variant="outline" className="text-xs">
                          {statusLabels[action.status] || action.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Notes */}
          {data.additionalNotes && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Ek Notlar</h3>
              <p className="text-sm whitespace-pre-wrap">{data.additionalNotes}</p>
            </div>
          )}

          {/* Next Steps */}
          {data.nextSteps && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold mb-3 text-blue-800">Sonraki Adımlar</h3>
              <p className="text-sm whitespace-pre-wrap">{data.nextSteps}</p>
            </div>
          )}

          {/* Recipients */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Gönderilecek Kişiler</h3>
            <div className="flex flex-wrap gap-2">
              {data.recipients.filter(r => r.email).map((recipient, i) => (
                <Badge key={i} variant="secondary" className="py-1">
                  {recipient.name} ({recipient.email})
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Kapat
          </Button>
          <Button onClick={onSend} disabled={loading}>
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Gönderiliyor..." : "Gönder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
