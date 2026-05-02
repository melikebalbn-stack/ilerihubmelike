'use client'

import type { SandboxModule } from '@/lib/sandbox-config'
import { Badge } from '@/components/ui/badge'
import { FlaskConical, ShieldCheck, EyeOff } from 'lucide-react'

interface SandboxHeaderProps {
  module: SandboxModule
  userName: string
}

export default function SandboxHeader({ module, userName }: SandboxHeaderProps) {
  return (
    <div className="mb-6 space-y-3">
      <div className="border border-amber-400 bg-amber-50 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <FlaskConical className="h-4 w-4 text-amber-600" />
            <span>🧪 GELİŞTİRİCİ MODU AKTİF</span>
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-700 text-xs"
            >
              SANDBOX
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-amber-600">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              SUPER_ADMIN yetkileri aktif
            </span>
            <span className="flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              Diğer kullanıcılara gizli
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-3xl">{module.icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {module.name}
          </h1>
          <p className="text-sm text-gray-500">
            Hoş geldin,{' '}
            <span className="font-medium text-gray-700">
              {userName}
            </span>{' '}
            — Bu alan sadece sana özel kişisel geliştirici çalışma alanın.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Nasıl Çalışır?</strong> Bu geliştirici alanında formlar,
          bileşenler veya modül yapıları oluşturabilirsin. Test ettikten sonra
          Melih ile birlikte ilgili ILERIHub modüllerine aktarabilirsiniz.
        </p>
      </div>
    </div>
  )
}
