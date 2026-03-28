"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  FolderOpen,
  Users,
  Truck,
  Factory,
  TrendingUp,
  Package,
  ChevronRight,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"

const settingsItems = [
  {
    title: "Malzeme Kataloğu",
    description: "Paylaşılan malzeme kütüphanesini yönetin. Bir kere tanımlayın, her analizde kullanın.",
    icon: Package,
    href: "/cost-analysis/settings/materials",
    color: "text-red-600 bg-red-100",
  },
  {
    title: "Kategoriler",
    description: "Ürün kategorilerini yönetin (Platform, Yapısal Parça, vb.)",
    icon: FolderOpen,
    href: "/cost-analysis/settings/categories",
    color: "text-purple-600 bg-purple-100",
  },
  {
    title: "Müşteriler",
    description: "Müşteri listesini yönetin (Roketsan, ASELSAN, vb.)",
    icon: Users,
    href: "/cost-analysis/settings/customers",
    color: "text-blue-600 bg-blue-100",
  },
  {
    title: "Tedarikçiler",
    description: "Malzeme ve hizmet tedarikçilerini yönetin",
    icon: Truck,
    href: "/cost-analysis/settings/suppliers",
    color: "text-orange-600 bg-orange-100",
  },
  {
    title: "Makineler / İş Merkezleri",
    description: "Makine ve iş merkezlerini, saat ücretlerini yönetin",
    icon: Factory,
    href: "/cost-analysis/settings/machines",
    color: "text-green-600 bg-green-100",
  },
  {
    title: "Döviz Kurları",
    description: "Para birimi dönüşüm kurlarını yönetin",
    icon: TrendingUp,
    href: "/cost-analysis/settings/exchange-rates",
    color: "text-teal-600 bg-teal-100",
  },
]

export default function CostAnalysisSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-sm mb-2">
            <Link href="/cost-analysis" className="text-teal-600 hover:underline">
              Maliyet Analizleri
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">Ayarlar</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Maliyet Analizi Ayarları</h1>
          <p className="text-gray-500 mt-1">
            Maliyet analizi modülünün temel tanımlamalarını yönetin
          </p>
        </div>
        <Link href="/cost-analysis">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri Dön
          </Button>
        </Link>
      </div>

      {/* Guide Box */}
      <div className="bg-[#F3E5F5] rounded-lg p-5 border-l-4 border-purple-500">
        <h3 className="font-semibold text-purple-800 mb-2">Ayarlar Kılavuzu</h3>
        <p className="text-purple-700 text-sm">
          Maliyet analizi modülünün temel tanımlamaları. Kategoriler, müşteriler, tedarikçiler
          ve makine/iş merkezi bilgilerini buradan yönetebilirsiniz. Bu tanımlamalar,
          yeni maliyet analizi oluştururken kullanılacaktır.
        </p>
      </div>

      {/* Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg ${item.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
