import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import BuAyNeDegistiPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

function mockSession(permissions: string[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { permissions } },
    status: 'authenticated',
  } as ReturnType<typeof useSession>)
}

const bosSonuc = {
  yil: 2026, ay: 7,
  yeniServisKullanicilari: [], servistenAyrilanlar: [], servisDegistirenler: [],
  durakDegistirenler: [], aracDegisenServisler: [], soforDegisenServisler: [],
  adresDegisiklikleri: { kapsamDisi: true, not: 'Kapsam dışı test notu' },
  vardiyaDegistirenler: [], yeniKapasiteRiskleri: null, bosalanKapasite: null,
}

function fetchOkYanit(data: unknown) {
  return { ok: true, json: async () => ({ ok: true, data }) }
}

beforeEach(() => {
  vi.mocked(useSession).mockReset()
  global.fetch = vi.fn() as unknown as typeof fetch
})

describe('BuAyNeDegistiPage — yetkilendirme', () => {
  it('servis.view izni olmayan kullanıcıya sayfa render edilmez, API hiç çağrılmaz', async () => {
    mockSession([])
    render(<BuAyNeDegistiPage />)

    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeInTheDocument()
    expect(screen.queryByText('Bu Ay Ne Değişti?')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı sayfayı görür ve API çağrılır', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit(bosSonuc)) as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)

    expect(screen.getByText('Bu Ay Ne Değişti?')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })
})

describe('BuAyNeDegistiPage — ay seçici', () => {
  it('sayfa açılınca varsayılan (cari) ay/yıl ile API çağrılır', async () => {
    mockSession(['servis.view'])
    const fetchMock = vi.fn().mockResolvedValue(fetchOkYanit(bosSonuc))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)

    const simdi = new Date()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/servis-yonetimi/bu-ay-ne-degisti?yil=${simdi.getFullYear()}&ay=${simdi.getMonth() + 1}`,
      ),
    )
  })

  it('ay değiştirilince doğru yil/ay parametreleriyle YENİDEN API çağrılır', async () => {
    mockSession(['servis.view'])
    const fetchMock = vi.fn().mockResolvedValue(fetchOkYanit(bosSonuc))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Ay'), { target: { value: '3' } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const sonCagri = fetchMock.mock.calls[1][0] as string
    expect(sonCagri).toContain('ay=3')
  })

  it('yıl değiştirilince doğru yil/ay parametreleriyle YENİDEN API çağrılır', async () => {
    mockSession(['servis.view'])
    const fetchMock = vi.fn().mockResolvedValue(fetchOkYanit(bosSonuc))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const simdi = new Date()
    const oncekiYil = simdi.getFullYear() - 1
    fireEvent.change(screen.getByLabelText('Yıl'), { target: { value: String(oncekiYil) } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const sonCagri = fetchMock.mock.calls[1][0] as string
    expect(sonCagri).toContain(`yil=${oncekiYil}`)
  })
})

describe('BuAyNeDegistiPage — boş durum ve placeholder kartlar', () => {
  it('tüm listeler boşsa genel bir boş-durum mesajı gösterir', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit(bosSonuc)) as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)

    await waitFor(() =>
      expect(screen.getByText(/için servis-yönetimi modülünde kayıtlı bir değişiklik yok\./)).toBeInTheDocument(),
    )
  })

  it('adres ve kapasite kartları hata fırlatmadan "kapsam dışı"/"devre dışı" notuyla gösterilir', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(fetchOkYanit(bosSonuc)) as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)

    await waitFor(() => expect(screen.getByText('Kapsam dışı test notu')).toBeInTheDocument())
    expect(screen.getByText('Devre dışı')).toBeInTheDocument()
    expect(screen.getByText(/Kapasite motoru main.*girdiğinde eklenecek/)).toBeInTheDocument()
  })

  it('veri varsa ilgili kartta satır olarak listelenir (boş-durum mesajı görünmez)', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue(
      fetchOkYanit({
        ...bosSonuc,
        yeniServisKullanicilari: [
          { personnelId: 'p1', adSoyad: 'Ahmet Yılmaz', sicilNo: '1234', bolum: 'Üretim', guzergahKod: 'G1', guzergahAd: 'Güzergah 1', tarih: '2026-07-05T00:00:00.000Z' },
        ],
      }),
    ) as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)

    await waitFor(() => expect(screen.getByText(/Ahmet Yılmaz/)).toBeInTheDocument())
    expect(screen.queryByText('Bu ay yeni servis kullanıcısı yok.')).not.toBeInTheDocument()
    expect(screen.queryByText(/için servis-yönetimi modülünde kayıtlı bir değişiklik yok\./)).not.toBeInTheDocument()
  })

  it('API hata döndürürse hata mesajı gösterilir, sayfa çökmez', async () => {
    mockSession(['servis.view'])
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, message: 'Sunucu hatası.' }) }) as unknown as typeof fetch

    render(<BuAyNeDegistiPage />)

    await waitFor(() => expect(screen.getByText('Sunucu hatası.')).toBeInTheDocument())
  })
})
