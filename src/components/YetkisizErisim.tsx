import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface YetkisizErisimProps {
  /** Guard'da kontrol edilen permission key — verilirse "Gerekli yetki" satırı gösterilir. */
  permission?: string
  /** Ana açıklama metni (varsayılan: genel yetkisiz mesajı). */
  mesaj?: string
  /** Kart başlığı. */
  baslik?: string
}

/**
 * Ortak 403 / yetkisiz erişim ekranı.
 *
 * Saf JSX (client hook yok) → server component sayfalarından da render edilebilir.
 * Yetki reddinde `redirect('/dashboard')` yerine bu döndürülür: kullanıcı ekranda
 * kalır, neden giremediğini görür (sessiz bounce / dönen ekran yerine).
 */
export function YetkisizErisim({
  permission,
  mesaj = 'Bu sayfaya erişim yetkiniz yok.',
  baslik = 'Erişim Reddedildi (403)',
}: YetkisizErisimProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1B4F72]/10">
            <ShieldAlert className="h-7 w-7 text-[#1B4F72]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-[#1B4F72]">{baslik}</h1>
            <p className="text-sm text-slate-600">{mesaj}</p>
            {permission ? (
              <p className="text-sm text-slate-500">
                Gerekli yetki:{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{permission}</code>
              </p>
            ) : null}
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard&apos;a dön</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default YetkisizErisim
