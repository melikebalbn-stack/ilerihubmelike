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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Printer,
  Calendar,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  User,
  Target,
  Layers,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

function SignatureCard({
  role,
  roleColor,
  fallbackName,
  fallbackTitle,
  fallbackDate,
  signature,
}: {
  role: string
  roleColor: "emerald" | "sky" | "amber"
  fallbackName: string | null
  fallbackTitle: string | null
  fallbackDate: Date | null
  signature?: {
    signatureCode: string
    signedAt: string
    documentHash: string
    signerName: string
    signerEmail: string
    signerTitle: string
    signerDepartment?: string
  }
}) {
  const colorClasses: Record<string, { border: string; bg: string; text: string; sep: string; badge: string }> = {
    emerald: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/50",
      text: "text-emerald-900",
      sep: "bg-emerald-200",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    sky: {
      border: "border-sky-200",
      bg: "bg-sky-50/50",
      text: "text-sky-900",
      sep: "bg-sky-200",
      badge: "bg-sky-100 text-sky-800 border-sky-200",
    },
    amber: {
      border: "border-amber-200",
      bg: "bg-amber-50/50",
      text: "text-amber-900",
      sep: "bg-amber-200",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
    },
  }
  const c = colorClasses[roleColor]
  const signed = !!signature

  return (
    <div className={`space-y-3 p-4 rounded-lg border-2 ${c.border} ${c.bg}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${c.text}`}>{role}</span>
        {signed ? (
          <Badge variant="outline" className={c.badge}>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Dijital İmzalı
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-slate-100 text-slate-600">
            Beklemede
          </Badge>
        )}
      </div>
      <Separator className={c.sep} />
      <div className="space-y-1">
        <div className="font-medium">{signature?.signerName ?? fallbackName ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {signature?.signerTitle ?? fallbackTitle ?? ""}
        </div>
        {signature?.signerDepartment && (
          <div className="text-xs text-muted-foreground">
            {signature.signerDepartment}
          </div>
        )}
        {signature?.signerEmail && (
          <div className="text-xs text-muted-foreground">
            {signature.signerEmail}
          </div>
        )}
      </div>
      {signed && (
        <>
          <Separator className={c.sep} />
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start gap-1.5">
              <span className="text-muted-foreground min-w-20">İmza Kodu:</span>
              <span className="font-mono font-semibold break-all">
                {signature.signatureCode}
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-muted-foreground min-w-20">İmza Tarihi:</span>
              <span>
                {format(new Date(signature.signedAt), "dd MMMM yyyy HH:mm", {
                  locale: tr,
                })}
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-muted-foreground min-w-20">Hash:</span>
              <span className="font-mono break-all text-[10px]">
                {signature.documentHash.slice(0, 24)}…
              </span>
            </div>
          </div>
        </>
      )}
      {!signed && fallbackDate && (
        <div className="text-xs text-muted-foreground mt-2">
          Tarih: {format(fallbackDate, "dd MMMM yyyy", { locale: tr })}
        </div>
      )}
    </div>
  )
}

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Taslak",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PENDING_APPROVAL: {
    label: "Onay Bekliyor",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "Onaylandı",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  PUBLISHED: {
    label: "Yayında",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
}

const ACTION_BADGE: Record<string, string> = {
  AÇIK: "bg-amber-50 text-amber-700 border-amber-200",
  PLANLI: "bg-sky-50 text-sky-700 border-sky-200",
  TAMAMLANDI: "bg-emerald-50 text-emerald-700 border-emerald-200",
  KAPALI: "bg-slate-50 text-slate-700 border-slate-200",
}

interface SonucAksiyon {
  no: number
  aksiyon: string
  sorumlu: string
  termin: string
  durum: string
}

interface DigitalSignature {
  signatureType: string
  signatureCode: string
  signedAt: string
  documentHash: string
  signerId: string
  signerName: string
  signerEmail: string
  signerTitle: string
  signerDepartment?: string
  role: string
  note?: string
}

interface SignaturesJson {
  hazirlayan?: DigitalSignature
  onaylayan?: DigitalSignature
}

export default async function InventoryReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect("/login")

  const { id } = await params

  const review = await prisma.inventoryReview.findUnique({
    where: { id },
  })

  if (!review) notFound()

  const aksiyonlar = (review.sonucAksiyonlar as unknown as SonucAksiyon[]) ?? []
  const status = STATUS_BADGE[review.durum] ?? STATUS_BADGE.DRAFT
  const signatures = (review.signatures as unknown as SignaturesJson | null) ?? {}
  const hazirlayanSig = signatures.hazirlayan
  const onaylayanSig = signatures.onaylayan

  // İlişkili dokümanları DB'den çek (varsa)
  const iliskiliDokumanlar = await prisma.iso27001Document.findMany({
    where: { documentNumber: { in: review.iliskiliDokumanIds } },
    select: {
      id: true,
      documentNumber: true,
      title: true,
    },
  })

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/iso27001"
              className="hover:text-foreground transition-colors"
            >
              ISO 27001
            </Link>
            <span>/</span>
            <span>Envanter Gözden Geçirme</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            {review.baslik}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono">
              {review.tutanakNo}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              İç Kod: {review.internalCode}
            </Badge>
            <Badge className={status.className} variant="outline">
              {status.label}
            </Badge>
          </div>
        </div>
        <Button asChild>
          <Link
            href={`/iso27001/envanter-gozden-gecirme/${review.id}/yazdir`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Printer className="h-4 w-4 mr-2" />
            Yazdır
          </Link>
        </Button>
      </div>

      {/* Genel Bilgi + Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-sky-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-sky-600" />
              Tarihler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gözden Geçirme</span>
              <span className="font-medium">
                {format(review.reviewDate, "dd MMMM yyyy", { locale: tr })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sonraki Tarih</span>
              <span className="font-medium">
                {format(review.nextReviewDate, "dd MMMM yyyy", { locale: tr })}
              </span>
            </div>
            {review.hazirlanmaTarihi && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hazırlanma</span>
                <span className="font-medium">
                  {format(review.hazirlanmaTarihi, "dd MMMM yyyy", { locale: tr })}
                </span>
              </div>
            )}
            {review.onayTarihi && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Onay</span>
                <span className="font-medium">
                  {format(review.onayTarihi, "dd MMMM yyyy", { locale: tr })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-emerald-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              Envanter Snapshot
            </CardTitle>
            <CardDescription className="text-xs">
              Gözden geçirme tarihindeki kayıt sayıları
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-emerald-50 py-3 px-2">
                <div className="text-2xl font-bold text-emerald-700">
                  {review.hardwareCount ?? "—"}
                </div>
                <div className="text-xs text-emerald-700/70 mt-1">Donanım</div>
              </div>
              <div className="rounded-lg bg-violet-50 py-3 px-2">
                <div className="text-2xl font-bold text-violet-700">
                  {review.softwareCount ?? "—"}
                </div>
                <div className="text-xs text-violet-700/70 mt-1">Yazılım</div>
              </div>
              <div className="rounded-lg bg-rose-50 py-3 px-2">
                <div className="text-2xl font-bold text-rose-700">
                  {review.informationCount ?? "—"}
                </div>
                <div className="text-xs text-rose-700/70 mt-1">Bilgi</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* İçerik Sekmeleri */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="amac" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="amac">
                <Target className="h-4 w-4 mr-2 hidden sm:inline" />
                Amaç
              </TabsTrigger>
              <TabsTrigger value="kapsam">
                <ShieldCheck className="h-4 w-4 mr-2 hidden sm:inline" />
                Kapsam
              </TabsTrigger>
              <TabsTrigger value="surec">
                <Calendar className="h-4 w-4 mr-2 hidden sm:inline" />
                Süreç Tarihçesi
              </TabsTrigger>
              <TabsTrigger value="bulgular">
                <AlertCircle className="h-4 w-4 mr-2 hidden sm:inline" />
                Bulgular
              </TabsTrigger>
            </TabsList>
            <TabsContent value="amac" className="prose prose-sm max-w-none mt-4 dark:prose-invert">
              <ReactMarkdown>{review.amac}</ReactMarkdown>
            </TabsContent>
            <TabsContent value="kapsam" className="prose prose-sm max-w-none mt-4 dark:prose-invert">
              <ReactMarkdown>{review.kapsam}</ReactMarkdown>
            </TabsContent>
            <TabsContent value="surec" className="prose prose-sm max-w-none mt-4 dark:prose-invert">
              <ReactMarkdown>{review.surecTarihcesi}</ReactMarkdown>
            </TabsContent>
            <TabsContent value="bulgular" className="prose prose-sm max-w-none mt-4 dark:prose-invert">
              <ReactMarkdown>{review.bulgular}</ReactMarkdown>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sonuç ve Aksiyonlar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Sonuç ve Aksiyonlar
          </CardTitle>
          <CardDescription>
            Gözden geçirme sonucunda belirlenen iyileştirme aksiyonları
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>Aksiyon</TableHead>
                <TableHead className="w-40">Sorumlu</TableHead>
                <TableHead className="w-32">Termin</TableHead>
                <TableHead className="w-28">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aksiyonlar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Aksiyon kaydı yok
                  </TableCell>
                </TableRow>
              ) : (
                aksiyonlar.map((a) => (
                  <TableRow key={a.no}>
                    <TableCell className="font-mono text-sm">{a.no}</TableCell>
                    <TableCell className="text-sm">{a.aksiyon}</TableCell>
                    <TableCell className="text-sm">{a.sorumlu}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {a.termin}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ACTION_BADGE[a.durum] ?? ACTION_BADGE.AÇIK}
                      >
                        {a.durum}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* İlişkili Dokümanlar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-600" />
            İlişkili Dokümanlar
          </CardTitle>
          <CardDescription>
            ISO 27001 doküman yönetiminde tanımlı bağlı kayıtlar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {review.iliskiliDokumanIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">İlişkili doküman yok</p>
          ) : (
            review.iliskiliDokumanIds.map((docNo) => {
              const doc = iliskiliDokumanlar.find(
                (d) => d.documentNumber === docNo,
              )
              return (
                <div
                  key={docNo}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <Badge variant="outline" className="font-mono">
                    {docNo}
                  </Badge>
                  {doc ? (
                    <Link
                      href={`/iso27001/documents`}
                      className="text-sm hover:underline flex-1"
                    >
                      {doc.title}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground italic flex-1">
                      (Doküman bulunamadı)
                    </span>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* İmza Alanları */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Dijital İmzalar
          </CardTitle>
          <CardDescription>
            Tutanak SHA-256 içerik hash'i ile dijital olarak imzalanmıştır.
            İmza kodları ile doğrulanabilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {review.contentHash && (
            <div className="rounded-lg border bg-slate-50 p-3 text-xs font-mono break-all">
              <span className="text-muted-foreground">İçerik Hash (SHA-256): </span>
              <span className="text-slate-900">{review.contentHash}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hazırlayan */}
            <SignatureCard
              role="Hazırlayan"
              roleColor="emerald"
              fallbackName={review.hazirlayanAd}
              fallbackTitle={review.hazirlayanUnvan}
              fallbackDate={review.hazirlanmaTarihi}
              signature={hazirlayanSig}
            />

            {/* Onaylayan */}
            <SignatureCard
              role="Onaylayan"
              roleColor="sky"
              fallbackName={review.onaylayanAd}
              fallbackTitle={review.onaylayanUnvan}
              fallbackDate={review.onayTarihi}
              signature={onaylayanSig}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
