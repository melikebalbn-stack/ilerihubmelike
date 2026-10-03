import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PasifGeriAlButonlari } from './PasifGeriAlButonlari'

function goster(props: { aktif: boolean; canPassive: boolean; canRestore: boolean }) {
  const onPasiflestir = vi.fn()
  const onGeriAl = vi.fn()
  render(<PasifGeriAlButonlari {...props} onPasiflestir={onPasiflestir} onGeriAl={onGeriAl} />)
  return { onPasiflestir, onGeriAl }
}

describe('PasifGeriAlButonlari — yetkiye göre görünürlük', () => {
  it('aktif kayıt + servis.passive → Pasifleştir görünür ve tıklanınca çağrılır', () => {
    const t = goster({ aktif: true, canPassive: true, canRestore: false })
    fireEvent.click(screen.getByRole('button', { name: 'Pasifleştir' }))
    expect(t.onPasiflestir).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Geri Al' })).toBeNull()
  })

  it('🔴 aktif kayıt + servis.passive YOK → hiçbir düğme yok (restore yetkisi olsa bile)', () => {
    goster({ aktif: true, canPassive: false, canRestore: true })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('pasif kayıt + servis.restore → Geri Al görünür ve tıklanınca çağrılır', () => {
    const t = goster({ aktif: false, canPassive: false, canRestore: true })
    fireEvent.click(screen.getByRole('button', { name: 'Geri Al' }))
    expect(t.onGeriAl).toHaveBeenCalledTimes(1)
  })

  it('🔴 pasif kayıt + servis.restore YOK → hiçbir düğme yok (passive yetkisi olsa bile)', () => {
    goster({ aktif: false, canPassive: true, canRestore: false })
    expect(screen.queryByRole('button')).toBeNull()
  })
})
