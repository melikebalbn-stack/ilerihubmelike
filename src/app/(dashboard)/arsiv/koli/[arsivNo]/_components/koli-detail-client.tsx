'use client'

/**
 * Koli detay sayfasının Client wrapper'ı.
 *
 * Amaç: Header (Düzenle butonu + modal), Timeline (Geçmiş İşlemler) ve Alt
 * Koliler bölümü paylaşılan `refreshKey` state'i ile birlikte çalışsın.
 *
 * Slot pattern (UI-2b revize): `AnaKoliBilgileri` ve `QrKodCard` Server
 * Component olarak slot'larda kalır. `AltKolilerSection` Client component
 * olduğu için (modal state'i için) Server'dan slot olarak geçilemez —
 * bunun yerine `altKoliler` array veri olarak alınır ve burada render edilir.
 *
 * `onChanged` zinciri: alt koli ekle/düzenle/sil → setRefreshKey + router.refresh
 * → timeline yeniden fetch + Server data (altKoliler dahil) yeniden çekilir.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import KoliDetayHeader from './koli-detay-header'
import KoliEditModal from './koli-edit-modal'
import AktiviteLogTimeline from './aktivite-log-timeline'
import AltKolilerSection, { type AltKoli } from './alt-koliler-section'

type Lokasyon = {
  id: number
  depoNo: string
  rafKodu: string
  siraNo: number
  kapasite: number
  mevcutDoluluk: number
}

type Props = {
  koli: {
    id: string
    arsivNo: string
    bolum: { ad: string; kod: string; renkHex: string }
    durum: 'Aktif' | 'Arsivde' | 'ImhaYaklasti' | 'ImhaEdildi'
    aciklama: string | null
    lokasyonId: number | null
  }
  canEdit: boolean
  lokasyonlar: Lokasyon[]
  /** Sol kolon üst — Server (AnaKoliBilgileri). AltKolilerSection burada
   *  değil, aşağıda Client olarak render edilir. */
  leftColumn: ReactNode
  /** Sağ kolon üst kısmı — Server (QrKodCard) */
  rightColumnTop: ReactNode
  /** Alt Koliler section için veri ve bağlam */
  arsivNo: string
  bolumId: number
  anaKoliDonemBaslangic: string
  anaKoliDonemSonu: string
  altKoliler: AltKoli[]
}

export default function KoliDetailClient({
  koli,
  canEdit,
  lokasyonlar,
  leftColumn,
  rightColumnTop,
  arsivNo,
  bolumId,
  anaKoliDonemBaslangic,
  anaKoliDonemSonu,
  altKoliler,
}: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Tab focus alındığında timeline'ı yenile + Server data refresh.
  useEffect(() => {
    function handleFocus() {
      setRefreshKey((k) => k + 1)
      router.refresh()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [router])

  function handleAltKoliChanged() {
    setRefreshKey((k) => k + 1)
    router.refresh()
  }

  return (
    <>
      <KoliDetayHeader
        koli={koli}
        canEdit={canEdit}
        onEditClick={() => setModalOpen(true)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {leftColumn}
          <AltKolilerSection
            arsivNo={arsivNo}
            bolumId={bolumId}
            anaKoliDonemBaslangic={anaKoliDonemBaslangic}
            anaKoliDonemSonu={anaKoliDonemSonu}
            altKoliler={altKoliler}
            canEdit={canEdit}
            onChanged={handleAltKoliChanged}
          />
        </div>

        <div className="space-y-6">
          {rightColumnTop}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Geçmiş İşlemler</h2>
            <AktiviteLogTimeline koliId={koli.id} refreshKey={refreshKey} />
          </section>
        </div>
      </div>

      {modalOpen && (
        <KoliEditModal
          koli={koli}
          lokasyonlar={lokasyonlar}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setRefreshKey((k) => k + 1)
            router.refresh()
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
