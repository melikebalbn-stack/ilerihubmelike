'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, XCircle, FileText, User, Calendar, Clock, Shield, AlertCircle } from 'lucide-react'

interface VerificationData {
  valid: boolean
  document?: {
    code: string
    title: string
    revisionNumber: number
    type: string
    status: string
  }
  approval?: {
    signedBy: string
    signedAt: string
    signatureHash: string
    status: string
  }
  error?: string
}

export default function VerifyPage() {
  const params = useParams()
  const code = params.code as string
  const [data, setData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await fetch(`/api/verify/${code}`)
        const result = await response.json()
        setData(result)
      } catch {
        setData({ valid: false, error: 'Doğrulama yapılırken bir hata oluştu' })
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      verify()
    }
  }, [code])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Doğrulanıyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Logo ve Başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Doküman Doğrulama</h1>
          <p className="text-gray-500 mt-1">ILERIHub Dijital İmza Sistemi</p>
        </div>

        {/* Sonuç Kartı */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Durum Başlığı */}
          <div className={`p-6 ${data?.valid ? 'bg-green-500' : 'bg-red-500'}`}>
            <div className="flex items-center justify-center gap-3">
              {data?.valid ? (
                <>
                  <CheckCircle className="w-10 h-10 text-white" />
                  <span className="text-xl font-semibold text-white">Doğrulandı</span>
                </>
              ) : (
                <>
                  <XCircle className="w-10 h-10 text-white" />
                  <span className="text-xl font-semibold text-white">Doğrulanamadı</span>
                </>
              )}
            </div>
          </div>

          {/* İçerik */}
          <div className="p-6">
            {data?.valid && data.document && data.approval ? (
              <div className="space-y-4">
                {/* Doküman Bilgileri */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Doküman Bilgileri</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">{data.document.title}</p>
                        <p className="text-sm text-gray-500">
                          {data.document.code} - Rev. {data.document.revisionNumber}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Onay Bilgileri */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Onay Bilgileri</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Onaylayan</p>
                        <p className="font-medium text-gray-900">{data.approval.signedBy}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Onay Tarihi</p>
                        <p className="font-medium text-gray-900">
                          {new Date(data.approval.signedAt).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Onay Saati</p>
                        <p className="font-medium text-gray-900">
                          {new Date(data.approval.signedAt).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* İmza Hash */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Dijital İmza (SHA-256)</h3>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <code className="text-xs text-gray-600 break-all font-mono">
                      {data.approval.signatureHash}
                    </code>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {data?.error || 'Bu doğrulama kodu geçersiz veya doküman bulunamadı.'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Lütfen QR kodu tekrar taratın veya doğru bağlantıyı kullandığınızdan emin olun.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 text-center">
            <p className="text-xs text-gray-500">
              Doğrulama Kodu: <code className="bg-gray-200 px-1 rounded">{code}</code>
            </p>
          </div>
        </div>

        {/* Bilgilendirme */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Bu sayfa, dokümanın dijital imzasının geçerliliğini doğrulamak için kullanılır.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            ILERIHub &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
