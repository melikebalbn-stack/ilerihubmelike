import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/servis-yonetimi/personel-atama-excel' }))

import { RouteChangeProvider } from './route-change-provider'

const ekranda = () => screen.queryByText('Yükleniyor...')

describe('RouteChangeProvider — yükleniyor katmanı', () => {
  it('sayfa linkine tıklayınca katman açılır', () => {
    render(<RouteChangeProvider><a href="/servis-yonetimi/panel">Panel</a></RouteChangeProvider>)
    fireEvent.click(screen.getByText('Panel'))
    expect(ekranda()).not.toBeNull()
  })

  it('🔴 /api/ indirme linki katmanı AÇMAZ (sayfa değişmez, katman kapanmayıp ekranı kilitlerdi)', () => {
    render(<RouteChangeProvider><a href="/api/servis-yonetimi/personel-atama-excel/sablon">Şablonu indir</a></RouteChangeProvider>)
    fireEvent.click(screen.getByText('Şablonu indir'))
    expect(ekranda()).toBeNull()
  })

  it('download öznitelikli link katmanı açmaz', () => {
    render(<RouteChangeProvider><a href="/dosyalar/x.pdf" download>PDF</a></RouteChangeProvider>)
    fireEvent.click(screen.getByText('PDF'))
    expect(ekranda()).toBeNull()
  })
})
