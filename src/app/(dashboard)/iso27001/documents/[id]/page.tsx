import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  FileText,
  Download,
  Eye,
  Calendar,
  User,
  Tag,
  GitBranch,
  Clock,
  History,
  ShieldCheck,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { DocumentDetailActions } from "./detail-actions"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Taslak", className: "bg-slate-100 text-slate-700 border-slate-200" },
  PENDING_APPROVAL: { label: "Onay Bekliyor", className: "bg-amber-100 text-amber-800 border-amber-200" },
  APPROVED: { label: "Onaylı", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  PUBLISHED: { label: "Yayında", className: "bg-sky-100 text-sky-800 border-sky-200" },
  UNDER_REVIEW: { label: "Gözden Geçiriliyor", className: "bg-violet-100 text-violet-800 border-violet-200" },
  OBSOLETE: { label: "Geçersiz", className: "bg-red-100 text-red-800 border-red-200" },
  ARCHIVED: { label: "Arşivlenmiş", className: "bg-slate-100 text-slate-500 border-slate-200" },
}

const CATEGORY_LABEL: Record<string, string> = {
  MANDATORY: "Zorunlu Doküman",
  RECORD: "Zorunlu Kayıt",
  ANNEX_A: "Annex A",
  POLICY: "Politika",
  PROCEDURE: "Prosedür",
  GUIDELINE: "Kılavuz",
  FORM: "Form",
  OTHER: "Diğer",
}

// PR-Y12: inline helper kopyası kaldırıldı, saf RBAC inline check kullanılıyor

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const resolveFileUrl = (fileUrl: string) =>
  fileUrl.startsWith("/api/") ? fileUrl : `/api/files${fileUrl}`

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect("/login")

  const { id } = await params

  const doc = await prisma.iso27001Document.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { signatures: true, versions: true },
      },
    },
  })

  if (!doc) notFound()

  const status = STATUS_BADGE[doc.status] ?? STATUS_BADGE.DRAFT
  const userEmail = session.user.email
  const userPerms = (session.user as { permissions?: string[] }).permissions
  // PR-Y12: saf RBAC, bgys.audit.manage permission
  const canManage =
    (userPerms?.includes("bgys.audit.manage") ?? false) ||
    userEmail === doc.ownerEmail

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Geri butonu */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/iso27001/documents">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Doküman Listesine Dön
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/iso27001"
              className="hover:text-foreground transition-colors"
            >
              ISO 27001
            </Link>
            <span>/</span>
            <Link
              href="/iso27001/documents"
              className="hover:text-foreground transition-colors"
            >
              Dokümanlar
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="font-mono text-base px-2.5 py-1">
              {doc.documentNumber}
            </Badge>
            <Badge className={status.className} variant="outline">
              {status.label}
            </Badge>
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
              <Tag className="h-3 w-3 mr-1" />
              {CATEGORY_LABEL[doc.category] ?? doc.category}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold flex items-start gap-2">
            <FileText className="h-6 w-6 text-sky-600 mt-1 shrink-0" />
            <span>{doc.title}</span>
          </h1>
        </div>

        <DocumentDetailActions
          documentId={doc.id}
          documentNumber={doc.documentNumber}
          title={doc.title}
          version={doc.version}
          fileName={doc.fileName}
          canManage={canManage}
        />
      </div>

      {/* Genel Bilgiler */}
      <Card className="border-sky-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-600" />
            Genel Bilgiler
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {doc.description && (
            <div className="md:col-span-2">
              <div className="text-muted-foreground text-xs mb-1">Açıklama</div>
              <div>{doc.description}</div>
            </div>
          )}
          {doc.clause && (
            <div>
              <div className="text-muted-foreground text-xs mb-1">İlgili Madde</div>
              <div className="font-mono">{doc.clause}</div>
            </div>
          )}
          {doc.controlId && (
            <div>
              <div className="text-muted-foreground text-xs mb-1">Annex A Kontrol</div>
              <div className="font-mono">{doc.controlId}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
              <User className="h-3 w-3" />
              Sahibi
            </div>
            <div className="font-medium">{doc.ownerName}</div>
            <div className="text-xs text-muted-foreground">{doc.ownerEmail}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              Mevcut Versiyon
            </div>
            <div className="font-mono font-semibold text-base">{doc.version}</div>
          </div>
          {doc.approvedAt && (
            <div>
              <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Onay Tarihi
              </div>
              <div>
                {format(doc.approvedAt, "dd MMMM yyyy", { locale: tr })}
              </div>
              {doc.approvedByName && (
                <div className="text-xs text-muted-foreground">
                  {doc.approvedByName}
                </div>
              )}
            </div>
          )}
          {doc.nextReviewDate && (
            <div>
              <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Sonraki Gözden Geçirme
              </div>
              <div>
                {format(doc.nextReviewDate, "dd MMMM yyyy", { locale: tr })}
              </div>
              {doc.reviewFrequency && (
                <div className="text-xs text-muted-foreground">
                  Periyot: {doc.reviewFrequency} gün
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aktif Dosya */}
      <Card className="border-emerald-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" />
            Aktif Dosya
          </CardTitle>
          <CardDescription className="text-xs">
            Şu anda yayında olan versiyon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{doc.fileName}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                <span>v{doc.version}</span>
                <span>·</span>
                <span>{doc.fileType?.toUpperCase()}</span>
                <span>·</span>
                <span>{formatBytes(doc.fileSize)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a
                  href={resolveFileUrl(doc.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Önizle
                </a>
              </Button>
              <Button asChild size="sm">
                <a href={resolveFileUrl(doc.fileUrl)} download={doc.fileName}>
                  <Download className="h-4 w-4 mr-2" />
                  İndir
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Versiyon Geçmişi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-violet-600" />
            Versiyon Geçmişi
          </CardTitle>
          <CardDescription className="text-xs">
            Bu doküman için kayıt altındaki tüm önceki versiyonlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Versiyon</TableHead>
                <TableHead className="w-40">Tarih</TableHead>
                <TableHead className="w-44">Değiştiren</TableHead>
                <TableHead>Değişiklik Açıklaması</TableHead>
                <TableHead className="w-24 text-right">Dosya</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Aktif (mevcut) versiyon */}
              <TableRow className="bg-emerald-50/30">
                <TableCell className="font-mono font-semibold">
                  <div className="flex items-center gap-2">
                    {doc.version}
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] py-0 px-1.5">
                      Aktif
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {format(doc.updatedAt, "dd MMM yyyy HH:mm", { locale: tr })}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{doc.ownerName}</TableCell>
                <TableCell className="text-sm text-muted-foreground italic">
                  Mevcut yayında olan versiyon
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <a href={resolveFileUrl(doc.fileUrl)} download={doc.fileName}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>

              {/* Geçmiş versiyonlar */}
              {doc.versions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-6 text-sm"
                  >
                    Önceki versiyon kaydı yok
                  </TableCell>
                </TableRow>
              ) : (
                doc.versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono">{v.version}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(v.createdAt, "dd MMM yyyy HH:mm", {
                          locale: tr,
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{v.changedByName}</TableCell>
                    <TableCell className="text-sm whitespace-pre-wrap">
                      {v.changeDescription || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {v.fileUrl ? (
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={resolveFileUrl(v.fileUrl)}
                            download={v.fileName}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Separator className="my-3" />
          <div className="text-xs text-muted-foreground">
            Toplam {doc.versions.length + 1} versiyon · {doc._count?.signatures ?? 0} imza kaydı
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
