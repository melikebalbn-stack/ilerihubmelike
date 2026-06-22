"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Shield,
  FileCheck,
  User,
  Calendar,
  FileText,
  Building2
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

interface VerificationResult {
  valid: boolean
  verified?: boolean
  hashMatch?: boolean
  message: string
  signature?: {
    code: string
    signedAt: string
    signerName: string
    signerTitle: string | null
    signerDepartment: string | null
    signatureType: string
  }
  document?: {
    number: string
    title: string
    version: string
    status: string
  }
}

export default function VerifySignaturePage() {
  const [signatureCode, setSignatureCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    if (!signatureCode.trim()) {
      setError("Imza kodu giriniz")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/iso27001/signatures/verify?code=${encodeURIComponent(signatureCode.trim())}`)
      const data = await res.json()

      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || "Dogrulama basarisiz")
      }
    } catch (err) {
      setError("Dogrulama sirasinda hata olustu")
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DRAFT: { label: "Taslak", color: "bg-gray-100 text-gray-800" },
      PENDING_APPROVAL: { label: "Onay Bekliyor", color: "bg-yellow-100 text-yellow-800" },
      APPROVED: { label: "Onayli", color: "bg-green-100 text-green-800" },
      PUBLISHED: { label: "Yayinda", color: "bg-blue-100 text-blue-800" },
      UNDER_REVIEW: { label: "Gozden Geciriliyor", color: "bg-purple-100 text-purple-800" },
      OBSOLETE: { label: "Gecersiz", color: "bg-red-100 text-red-800" },
      ARCHIVED: { label: "Arsivlenmis", color: "bg-gray-100 text-gray-500" },
    }
    const s = statusMap[status] || statusMap.DRAFT
    return <Badge className={s.color}>{s.label}</Badge>
  }

  const getSignatureTypeName = (type: string) => {
    switch (type) {
      case "APPROVAL": return "Onay Imzasi"
      case "REVIEW": return "Gozden Gecirme Imzasi"
      case "ACKNOWLEDGEMENT": return "Bilgi Alma Imzasi"
      default: return type
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-2xl mx-auto py-16 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl lg:text-3xl font-bold">Imza Dogrulama</h1>
          <p className="text-muted-foreground mt-2">
            ISO 27001 dokuman imzalarini dogrulayin
          </p>
        </div>

        {/* Arama Kartı */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Imza Kodu Sorgula
            </CardTitle>
            <CardDescription>
              Dokumandaki imza kodunu girerek imzanin gecerliligi kontrol edilir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="code" className="sr-only">Imza Kodu</Label>
                <Input
                  id="code"
                  placeholder="Ornek: ILH-SIG-20260123-ABC12345"
                  value={signatureCode}
                  onChange={(e) => setSignatureCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="font-mono"
                />
              </div>
              <Button onClick={handleVerify} disabled={loading}>
                {loading ? "Dogrulaniyor..." : "Dogrula"}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Sonuç */}
        {result && (
          <Card>
            <CardContent className="pt-6">
              {result.valid ? (
                <div className="space-y-6">
                  {/* Başarılı Sonuç Header */}
                  <div className={`flex items-center gap-4 p-4 rounded-lg ${
                    result.hashMatch
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                  }`}>
                    {result.hashMatch ? (
                      <CheckCircle2 className="h-10 w-10 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-10 w-10 text-yellow-600" />
                    )}
                    <div>
                      <h3 className={`font-semibold text-lg ${
                        result.hashMatch ? "text-green-800 dark:text-green-200" : "text-yellow-800 dark:text-yellow-200"
                      }`}>
                        {result.hashMatch ? "Imza Gecerli" : "Dikkat"}
                      </h3>
                      <p className={`text-sm ${
                        result.hashMatch ? "text-green-700 dark:text-green-300" : "text-yellow-700 dark:text-yellow-300"
                      }`}>
                        {result.message}
                      </p>
                    </div>
                  </div>

                  {/* İmza Bilgileri */}
                  {result.signature && (
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <FileCheck className="h-4 w-4" />
                        Imza Bilgileri
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Imzalayan</p>
                            <p className="font-medium">{result.signature.signerName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Imza Tarihi</p>
                            <p className="font-medium">
                              {format(new Date(result.signature.signedAt), "dd MMMM yyyy HH:mm", { locale: tr })}
                            </p>
                          </div>
                        </div>
                        {result.signature.signerTitle && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Unvan</p>
                              <p className="font-medium">{result.signature.signerTitle}</p>
                            </div>
                          </div>
                        )}
                        {result.signature.signerDepartment && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Departman</p>
                              <p className="font-medium">{result.signature.signerDepartment}</p>
                            </div>
                          </div>
                        )}
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Imza Turu</p>
                          <Badge variant="outline">{getSignatureTypeName(result.signature.signatureType)}</Badge>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Imza Kodu</p>
                          <p className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                            {result.signature.code}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Doküman Bilgileri */}
                  {result.document && (
                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Dokuman Bilgileri
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Dokuman No</p>
                          <p className="font-mono text-sm">{result.document.number}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Versiyon</p>
                          <p className="font-medium">{result.document.version}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Baslik</p>
                          <p className="font-medium">{result.document.title}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Durum</p>
                          {getStatusBadge(result.document.status)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Geçersiz İmza */
                <div className="flex items-center gap-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <XCircle className="h-10 w-10 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-lg text-red-800 dark:text-red-200">
                      Imza Bulunamadi
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {result.message}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bilgi */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Bu sayfa, Ileri Group ISO 27001 Bilgi Guvenligi Yonetim Sistemi
            kapsamindaki dokumanlarin dijital imzalarini dogrulamak icin kullanilir.
          </p>
        </div>
      </div>
    </div>
  )
}
