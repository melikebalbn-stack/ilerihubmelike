import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const complete = vi.fn()
let detailState = 'PLANLANDI'
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { permissions: ['yilliktakvim.admin'] } } }) }))
vi.mock('./ChecklistPanel', () => ({ ChecklistPanel: ({ registerCompleteAction }: { registerCompleteAction?: (action: (() => void) | null) => void }) => { useEffect(() => { registerCompleteAction?.(complete); return () => registerCompleteAction?.(null) }, [registerCompleteAction]); return <div>Checklist içeriği</div> } }))
vi.mock('./OnayPanel', () => ({ OnayPanel: () => <div>Onay içeriği</div> }))
vi.mock('./BildirimKurallariPanel', () => ({ BildirimKurallariPanel: () => <div>Hatırlatma içeriği</div> }))
vi.mock('./EkKanitPanel', () => ({ EkKanitPanel: () => <div>Ekler içeriği</div> }))
vi.mock('./IslemGecmisiPanel', () => ({ IslemGecmisiPanel: () => <div>Geçmiş içeriği</div> }))

import { YillikTakvimDetailSheet } from './YillikTakvimDetailSheet'

const detail = () => ({
  id: 'r1', yil: 2026, anaKonu: 'DIŞ KONTROL', surec: 'İŞ EKİPMANLARI', kisaBaslik: null,
  aciklama: 'Yıllık kontrol', oncelik: 'ORTA', kayitTuru: 'SON_TARIH', periyot: 'YILLIK', durum: detailState,
  plananUygulamaTarihi: '2026-12-01T00:00:00.000Z', nihaiSonTarih: '2026-12-22T00:00:00.000Z',
  disKurum: 'Akredite Kurum', gerceklesmeDurumu: 'BEKLIYOR', gerceklesmeTarihi: null,
  gerceklesmemeNedeni: null, kaynakModul: null, iptalMi: false, arsivMi: false,
  createdById: 'u1', sonrakiKayitlar: [],
  department: { id: 'd1', name: 'İnsan Varlıkları' }, katilimcilar: [
    { id: 'p1', rol: 'ANA_SORUMLU', user: { id: 'u1', name: 'Elif Yıldırım', email: 'elif@ilerigroup.com' } },
    { id: 'p2', rol: 'YEDEK_SORUMLU', user: { id: 'u2', name: 'Yedek Kullanıcı', email: 'yedek@ilerigroup.com' } },
    { id: 'p3', rol: 'BILGILENDIRILECEK', user: { id: 'u3', name: 'Bilgi Kullanıcısı', email: 'bilgi@ilerigroup.com' } },
  ],
})

beforeEach(() => {
  detailState = 'PLANLANDI'; complete.mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => detail() })))
})

describe('Yıllık Takvim detay referans kabuğu', () => {
  it('kimlik, ikon şeridi, meta blok ve gerçek sekmeleri gösterir', async () => {
    const user = userEvent.setup()
    render(<YillikTakvimDetailSheet kayitId="r1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />)
    expect(await screen.findByText('İŞ EKİPMANLARI')).toBeInTheDocument()
    expect(screen.getByText('DIŞ KONTROL')).toBeInTheDocument()
    for (const action of ['Düzenle', 'Tarih Değiştir', 'Diğer']) expect(screen.getByRole('button', { name: action })).toBeEnabled()
    for (const label of ['Sorumlu', 'Departman', 'Öncelik', 'Periyot', 'Planlanan Uygulama Tarihi', 'Nihai Son Tarih', 'Gerçekleşme Durumu', 'Durum']) expect(screen.getByText(label)).toBeInTheDocument()
    for (const tab of ['Temel Bilgiler', 'Checklist (0)', 'Onay', 'Hatırlatma', 'Ekler (0)', 'Geçmiş']) expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tamamla' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Tamamla' })); expect(complete).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('tab', { name: 'Checklist (0)' })); expect(screen.getByText('Checklist içeriği')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Ekler (0)' })); expect(screen.getByText('Ekler içeriği')).toBeVisible()
  })

  it('terminal state durumunda mutation aksiyonlarını kilitler', async () => {
    detailState = 'ONAYLANDI'
    render(<YillikTakvimDetailSheet kayitId="r1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />)
    await screen.findByText('İŞ EKİPMANLARI')
    expect(screen.getByRole('button', { name: 'Düzenle' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tamamla' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tarih Değiştir' })).toBeDisabled()
  })

  it('düzenleme formunda yedek ve bilgilendirilecek kişi alanlarını gösterir', async () => {
    const user = userEvent.setup()
    render(<YillikTakvimDetailSheet kayitId="r1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />)
    await screen.findByText('İŞ EKİPMANLARI')
    await user.click(screen.getByRole('button', { name: 'Düzenle' }))

    expect(screen.getByText('Yedek Sorumlu')).toBeInTheDocument()
    expect(screen.getByText('Bilgilendirilecek Kişiler')).toBeInTheDocument()
    expect(screen.getByText('Yedek Kullanıcı')).toBeInTheDocument()
    expect(screen.getByText('Bilgi Kullanıcısı')).toBeInTheDocument()
  })

  it('onaylanmış kayıtta sonraki dönem aksiyonunu gösterir ve POST çağrısı yapar', async () => {
    detailState = 'ONAYLANDI'
    const user = userEvent.setup()
    render(<YillikTakvimDetailSheet kayitId="r1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />)
    await screen.findByText('İŞ EKİPMANLARI')
    await user.click(screen.getByRole('button', { name: 'Diğer' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sonraki Dönemi Oluştur' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/strategic-hr/yillik-calisma-takvimi/r1/sonraki-donem', { method: 'POST' }))
  })
})
