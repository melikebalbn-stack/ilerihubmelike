import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ServisGecmisDialog } from './ServisGecmisDialog'

// Üç ekranın paylaştığı bileşen (servis-yonetimi, guzergah/[id], sikayet).
// 5C'de yerel union'lar prisma'dan türetilen tiplerle değiştirildi; bileşen
// testsizdi, bu dosya o boşluğu kapatıyor. Bileşende REFACTOR YAPILMADI —
// olduğu gibi test ediliyor.

const KAYIT = {
  id: 'g1',
  islem: 'GUNCELLEME' as const,
  oncekiDeger: { aktif: true, telefon: '0555 111 22 33' },
  yeniDeger: { aktif: false, telefon: '0555 999 88 77' },
  aciklama: null,
  tarih: '2026-09-26T08:30:00.000Z',
  user: { name: 'Elif Yıldırım' },
}

function fetchMockKur(yanit: { ok: boolean; body: unknown }) {
  const m = vi.fn(async () => ({ ok: yanit.ok, json: async () => yanit.body }))
  global.fetch = m as unknown as typeof fetch
  return m
}

function ac(props: Partial<React.ComponentProps<typeof ServisGecmisDialog>> = {}) {
  return render(
    <ServisGecmisDialog
      hedefTipi="SIKAYET"
      hedefId="s1"
      baslik="#7 — Şikâyet geçmişi"
      open
      onOpenChange={() => {}}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ServisGecmisDialog — uç çağrısı', () => {
  it('🔴 hedefTipi=SIKAYET ve hedefId ile doğru uç çağrılıyor', async () => {
    const m = fetchMockKur({ ok: true, body: { ok: true, data: [] } })
    ac()

    await waitFor(() => expect(m).toHaveBeenCalled())
    const url = m.mock.calls[0][0] as unknown as string
    expect(url).toContain('/api/servis-yonetimi/islem-gecmisi')
    expect(url).toContain('hedefTipi=SIKAYET')
    expect(url).toContain('hedefId=s1')
  })

  it('dizi hedefTipi virgülle birleştirilir (alt kayıt desteği korunuyor)', async () => {
    const m = fetchMockKur({ ok: true, body: { ok: true, data: [] } })
    ac({ hedefTipi: ['PERSONEL_ATAMA', 'PERSONEL_ATAMA_DILIM'] })

    await waitFor(() => expect(m).toHaveBeenCalled())
    expect(m.mock.calls[0][0] as unknown as string).toContain('hedefTipi=PERSONEL_ATAMA,PERSONEL_ATAMA_DILIM')
  })

  it('hedefId URL-kodlanıyor', async () => {
    const m = fetchMockKur({ ok: true, body: { ok: true, data: [] } })
    ac({ hedefId: 'a b/c' })

    await waitFor(() => expect(m).toHaveBeenCalled())
    expect(m.mock.calls[0][0] as unknown as string).toContain('hedefId=a%20b%2Fc')
  })

  it('kapalıyken uca HİÇ istek atılmaz', () => {
    const m = fetchMockKur({ ok: true, body: { ok: true, data: [] } })
    ac({ open: false })
    expect(m).not.toHaveBeenCalled()
  })
})

describe('ServisGecmisDialog — tarihçe satırları', () => {
  it('dönen kayıt listeleniyor: işlem, kullanıcı ve ESKİ → YENİ değer görünüyor', async () => {
    fetchMockKur({ ok: true, body: { ok: true, data: [KAYIT] } })
    ac()

    await waitFor(() => expect(screen.getByText('Güncellendi')).toBeInTheDocument())
    expect(screen.getByText('Elif Yıldırım')).toBeInTheDocument()

    // aktif alanı okunabilir değere çevriliyor: Aktif → Pasif
    expect(screen.getByText('Aktif')).toBeInTheDocument()
    expect(screen.getByText('Pasif')).toBeInTheDocument()
    // telefon eski/yeni birlikte
    expect(screen.getByText('0555 111 22 33')).toBeInTheDocument()
    expect(screen.getByText('0555 999 88 77')).toBeInTheDocument()
  })

  it('kullanıcı yoksa "Sistem" yazıyor', async () => {
    fetchMockKur({ ok: true, body: { ok: true, data: [{ ...KAYIT, user: null }] } })
    ac()
    await waitFor(() => expect(screen.getByText('Sistem')).toBeInTheDocument())
  })

  it('başlık gösteriliyor', async () => {
    fetchMockKur({ ok: true, body: { ok: true, data: [] } })
    ac()
    await waitFor(() => expect(screen.getByText(/#7 — Şikâyet geçmişi/)).toBeInTheDocument())
  })
})

// ----------------------------------------------------------------------------
// 🔴 Boş hâl ile hata hâli AYRI — sessizce boş liste gösterilmiyor
// ----------------------------------------------------------------------------
describe('ServisGecmisDialog — boş ve hata hâlleri ayrı', () => {
  it('tarihçe boşsa "İşlem geçmişi bulunmuyor." yazıyor', async () => {
    fetchMockKur({ ok: true, body: { ok: true, data: [] } })
    ac()
    await waitFor(() => expect(screen.getByText('İşlem geçmişi bulunmuyor.')).toBeInTheDocument())
  })

  it('🔴 uç hata dönerse HATA gösteriliyor, "kayıt yok" DEĞİL', async () => {
    fetchMockKur({ ok: false, body: { ok: false, message: 'Geçersiz veya eksik hedefTipi.' } })
    ac()

    await waitFor(() => expect(screen.getByText('Geçersiz veya eksik hedefTipi.')).toBeInTheDocument())
    // Sessizce boş liste gösterilmiyor
    expect(screen.queryByText('İşlem geçmişi bulunmuyor.')).not.toBeInTheDocument()
  })

  it('403 gibi mesajsız hata hâlinde de kullanıcıya bir hata gösteriliyor', async () => {
    fetchMockKur({ ok: false, body: { ok: false } })
    ac()

    await waitFor(() => expect(screen.getByText('İşlem geçmişi alınamadı.')).toBeInTheDocument())
    expect(screen.queryByText('İşlem geçmişi bulunmuyor.')).not.toBeInTheDocument()
  })

  it('ağ hatasında da sessiz kalınmıyor', async () => {
    global.fetch = vi.fn(async () => { throw new Error('ağ yok') }) as unknown as typeof fetch
    ac()

    await waitFor(() =>
      expect(screen.getByText('İşlem geçmişi alınırken beklenmeyen bir hata oluştu.')).toBeInTheDocument(),
    )
    expect(screen.queryByText('İşlem geçmişi bulunmuyor.')).not.toBeInTheDocument()
  })

  it('üç hâlin metinleri birbirinden FARKLI (sabitlendi)', () => {
    const metinler = [
      'İşlem geçmişi bulunmuyor.',
      'İşlem geçmişi alınamadı.',
      'İşlem geçmişi alınırken beklenmeyen bir hata oluştu.',
    ]
    expect(new Set(metinler).size).toBe(3)
  })
})
