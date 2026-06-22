'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlusCircle, Layout, FileCode, Rocket } from 'lucide-react'

interface SandboxWorkspaceProps {
  ownerName: string
}

export default function SandboxWorkspace({ ownerName }: SandboxWorkspaceProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        <Card className="border-2 border-dashed border-gray-300 hover:border-violet-400 transition-colors cursor-pointer group">
          <CardContent className="flex flex-col items-center justify-center h-40 text-gray-400 group-hover:text-violet-500 transition-colors">
            <PlusCircle className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium">Yeni Bileşen Ekle</p>
            <p className="text-xs mt-1 text-center">Form, liste veya dashboard kartı</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layout className="h-4 w-4 text-blue-500" />
              Şablon Seç
            </CardTitle>
            <CardDescription className="text-xs">
              Hazır modül şablonlarından başla
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs">
              📝 Basit Form
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs">
              📊 Veri Tablosu
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs">
              📈 İstatistik Kartları
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-violet-800">
              <Rocket className="h-4 w-4" />
              Dağıtıma Hazır?
            </CardTitle>
            <CardDescription className="text-xs text-violet-600">
              Test tamamlandıysa Melih ile paylaş
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-violet-700 mb-3">
              Bu alandaki özelliği ilgili ILERIHub modülüne taşımak için BT
              Müdürüne haber ver.
            </p>
            <Badge className="bg-violet-100 text-violet-800 text-xs">
              Geliştirici → Üretim
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode className="h-4 w-4 text-gray-500" />
            Geliştirici Notları
          </CardTitle>
          <CardDescription>
            Bu bölüm sadece sana görünür. Çalışma notlarını buraya ekleyebilirsin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
            <p className="text-sm text-gray-400">
              Burası {ownerName} için notlar alanı — yakında eklenecek
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
