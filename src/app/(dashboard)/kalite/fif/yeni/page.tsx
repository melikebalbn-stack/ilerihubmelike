import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireSession } from '@/lib/auth/require-session'
import { FifFormClient } from '@/components/quality/fif/FifFormClient'

export const dynamic = 'force-dynamic'

/**
 * Yeni FİF formu (FAZ B). ÖNCEDEN: liste sayfasındaki buton anında boş bir
 * TASLAK açıp detaya gidiyordu — vazgeçen her kullanıcı arkada boş kayıt ve
 * HARCANMIŞ kayıt numarası bırakıyordu (prod'da 4 tanesi birikmişti).
 * Artık kayıt YALNIZ "Kaydet"e basılınca (POST /api/kalite/fif) oluşur;
 * numara da o anda üretilir.
 */
export default async function FifYeniPage() {
  const { error } = await requireSession()
  if (error) redirect('/login')

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/kalite/fif" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1B4F72]">Yeni FİF</h1>
          <p className="text-sm text-slate-500">
            Kayıt numarası, Kaydet&apos;e bastığınızda verilir — vazgeçerseniz numara harcanmaz.
          </p>
        </div>
      </div>

      <FifFormClient initial={null} />
    </div>
  )
}
