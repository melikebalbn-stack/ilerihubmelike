'use client'

// Onay yenileme katmanı — taslak cookie'si düştüğünde (6 saat) veya guard 403 verdiğinde
// DOLDURULMUŞ FORMU KAYBETTİRMEDEN KVKK + sağlık adımlarını yeniden aldırır.
//
// Neden iki adım birden: /consent yeni bir taslak başvuru YARATIR; o taslağın sağlık kaydı
// olmadığı için yalnız KVKK yenilenirse submit bu kez sağlık guard'ından 403 alır
// (route.ts: consent yoksa 403, health yoksa 403). Bu yüzden sıra KVKK → Sağlık.
//
// Form state'e DOKUNULMAZ: bu bileşen yalnız üstte bir katman açar, aday formu arkada durur.
// Tamamlanınca onTamamlandi() ile çağıran submit'i TEKRAR dener.

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { KvkkStep } from './steps/KvkkStep'
import { HealthStep } from './steps/HealthStep'

const NAVY = '#1B4F72'

interface Props {
  /** Sunucudan gelen özgün hata metni (kullanıcıya olduğu gibi gösterilir). */
  sunucuMesaji?: string | null
  /** İki adım da tamamlandı → çağıran submit'i tekrar dener. */
  onTamamlandi: () => void
  /** Aday vazgeçti — katman kapanır, form yerinde kalır. */
  onVazgec: () => void
}

export function OnayYenileme({ sunucuMesaji, onTamamlandi, onVazgec }: Props) {
  const [adim, setAdim] = useState<'kvkk' | 'saglik'>('kvkk')

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-4 py-6">
      <div className="mx-auto w-full max-w-3xl rounded-xl border bg-white p-4 shadow-lg sm:p-6">
        {/* Güvence mesajı — aday "her şeyi baştan mı yazacağım" diye panik yapmasın. */}
        <div className="mb-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Onay adımının yenilenmesi gerekiyor.</p>
            <p className="mt-1">
              <strong>Doldurduğunuz bilgiler duruyor</strong> — hiçbir şey silinmedi. Onay
              adımlarını tamamladığınızda başvurunuz kaldığı yerden gönderilecek.
            </p>
            {sunucuMesaji && (
              <p className="mt-1 text-xs text-amber-700">Sunucu mesajı: {sunucuMesaji}</p>
            )}
          </div>
        </div>

        <p className="mb-3 text-center text-xs text-gray-400">
          Onay yenileme · Adım {adim === 'kvkk' ? '1' : '2'}/2
        </p>

        {adim === 'kvkk' ? (
          <KvkkStep onDone={() => setAdim('saglik')} />
        ) : (
          <HealthStep onDone={onTamamlandi} />
        )}

        <div className="mt-5 border-t pt-4 text-center">
          <button
            type="button"
            onClick={onVazgec}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            Şimdi değil — forma geri dön
          </button>
          <p className="mt-1 text-[11px] text-slate-400">
            Geri dönseniz de bilgileriniz ekranda kalır; onay tamamlanmadan gönderim yapılamaz.
          </p>
        </div>
      </div>
    </div>
  )
}
