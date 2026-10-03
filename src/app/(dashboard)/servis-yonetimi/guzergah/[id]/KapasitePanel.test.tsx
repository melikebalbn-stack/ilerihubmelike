import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { KapasitePanel } from './KapasitePanel'

const dilimler = [
  { id: 'd1', kod: 'SABAH', ad: 'Sabah Gidiş', yon: 'GIDIS' as const },
  { id: 'd2', kod: 'AKSAM', ad: 'Akşam Dönüş', yon: 'DONUS' as const },
]

beforeEach(() => vi.restoreAllMocks())

describe('KapasitePanel', () => {
  it('her aktif dilim için canonical endpointi çağırıp özeti gösterir', async () => {
    const d1 = { kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 }
    const d2 = { kapasite: 20, atananPersonelSayisi: 10, bosKoltuk: 10, dolulukOrani: 50, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 }
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ ok: true, data: String(url).includes('dilimId=d1') ? d1 : d2 }),
    }))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<KapasitePanel guzergahId="g1" dilimler={dilimler} />)

    await waitFor(() => expect(screen.getByText('SABAH — Sabah Gidiş')).toBeInTheDocument())
    expect(screen.getByText('AKSAM — Akşam Dönüş')).toBeInTheDocument()
    // 2 dilim çağrısı + güzergâh düzeyi (tekil/dilimsiz) için 1 kapasite-toplu çağrısı
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/servis-yonetimi/guzergah/g1/kapasite?')
    expect(String(fetchMock.mock.calls[0][0])).toContain('dilimId=d1')
  })

  it('negatif boş koltukta kapasite aşımı uyarısını gösterir', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { kapasite: 16, atananPersonelSayisi: 17, bosKoltuk: -1, dolulukOrani: 106.25, aracSayisi: 1, durum: 'ASIM', asimMiktari: 1 } }),
    }) as unknown as typeof fetch

    render(<KapasitePanel guzergahId="g1" dilimler={[dilimler[0]]} />)

    await waitFor(() => expect(screen.getByText('Kapasite aşımı · Aşım +1')).toBeInTheDocument())
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('%106.3')).toBeInTheDocument()
  })

  it('🔴 aracı olmayan dilim: koltuk/boş/doluluk "—", rozet "Araç yok" (0 ya da %100 gösterilmez)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: -3, dolulukOrani: null, aracSayisi: 0, durum: 'ARAC_YOK', asimMiktari: 0 } }),
    }) as unknown as typeof fetch

    render(<KapasitePanel guzergahId="g1" dilimler={[dilimler[0]]} />)

    await waitFor(() => expect(screen.getByText('Araç yok')).toBeInTheDocument())
    expect(screen.getAllByText('—')).toHaveLength(3) // koltuk, boş, doluluk
    expect(screen.queryByText('%100.0')).toBeNull()
    expect(screen.queryByText('%0.0')).toBeNull()
    expect(screen.queryByText('-3')).toBeNull() // araçsızlık "aşım" gibi görünmez
    expect(screen.queryByText(/aşım/i)).toBeNull()
    expect(screen.getByText('3')).toBeInTheDocument() // atanan personel
  })

  it('dolmak üzere (≥%90) sarı rozet', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { kapasite: 20, atananPersonelSayisi: 19, bosKoltuk: 1, dolulukOrani: 95, aracSayisi: 1, durum: 'DOLMAK_UZERE', asimMiktari: 0 } }),
    }) as unknown as typeof fetch
    render(<KapasitePanel guzergahId="g1" dilimler={[dilimler[0]]} />)
    await waitFor(() => expect(screen.getByText('Dolmak üzere')).toBeInTheDocument())
    expect(screen.getByText('%95.0')).toBeInTheDocument()
  })
})

describe('KapasitePanel — B6: tekil personel ve dilimi olmayan atama satırı', () => {
  const ozet = { kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 }
  const kur = (toplu: unknown, topluOk = true) => {
    global.fetch = vi.fn(async (url: string) =>
      String(url).includes('kapasite-toplu')
        ? { ok: topluOk, json: async () => toplu }
        : { ok: true, json: async () => ({ ok: true, data: ozet }) },
    ) as unknown as typeof fetch
  }

  it('🔴 dilimsiz atama varsa ayrı satır: "Dilimi olmayan — N atama … kapasiteye girmiyor"; tekil personel cümlesi', async () => {
    kur({ ok: true, data: { guzergahlar: [{ tekilPersonel: 14 }], toplam: { dilimsizAtamaSayisi: 3 } } })
    render(<KapasitePanel guzergahId="g1" dilimler={dilimler} />)
    const satir = await screen.findByTestId('dilimsiz-satir')
    expect(satir.textContent).toContain('Dilimi olmayan')
    expect(satir.textContent).toContain('3 atama')
    expect(satir.textContent).toContain('kapasiteye girmiyor')
    expect(screen.getByTestId('guzergah-tekil').textContent).toContain('14 tekil personel')
  })

  it('dilimsiz yok (N=0): satır YOK, tekil personel cümlesi var', async () => {
    kur({ ok: true, data: { guzergahlar: [{ tekilPersonel: 12 }], toplam: { dilimsizAtamaSayisi: 0 } } })
    render(<KapasitePanel guzergahId="g1" dilimler={dilimler} />)
    await screen.findByTestId('guzergah-tekil')
    expect(screen.queryByTestId('dilimsiz-satir')).toBeNull()
  })

  it('güvenli geri dönüş: ek bilgi alınamazsa dilim tablosu yine görünür, bilgi satırları çizilmez', async () => {
    kur({ ok: false, message: 'hata' }, false)
    render(<KapasitePanel guzergahId="g1" dilimler={dilimler} />)
    await waitFor(() => expect(screen.getByText('SABAH — Sabah Gidiş')).toBeInTheDocument())
    expect(screen.queryByTestId('guzergah-tekil')).toBeNull()
    expect(screen.queryByTestId('dilimsiz-satir')).toBeNull()
  })

  it('kapasite-toplu aynı hesap tarihiyle çağrılır', async () => {
    kur({ ok: true, data: { guzergahlar: [], toplam: {} } })
    render(<KapasitePanel guzergahId="g1" dilimler={dilimler} />)
    await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) => /kapasite-toplu\?guzergahId=g1&tarih=\d{4}-\d{2}-\d{2}/.test(String(c[0])))).toBe(true))
  })
})
