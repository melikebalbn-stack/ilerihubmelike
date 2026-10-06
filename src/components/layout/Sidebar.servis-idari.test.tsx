import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { Sidebar, SidebarProvider } from './Sidebar'

vi.mock('next-auth/react', () => ({ useSession: vi.fn(), signOut: vi.fn() }))

// idari-isler rolünün (prisma/seed-servis-role-mapping.ts) servis izin kümesiyle Servis alt grubu.
// Rol: view, create, edit, history, tanim.manage, sorumlu.manage + sikayet.view/manage (dev DB matrisi).
// YOK: passive, restore, export, kvkk.view, liste.publish.
const IDARI_ISLER = [
  'servis.view', 'servis.create', 'servis.edit', 'servis.history', 'servis.tanim.manage',
  'servis.sorumlu.manage', 'servis.sikayet.view', 'servis.sikayet.manage',
]

function servisLinkleri(permissions: string[]): string[] {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { role: 'KULLANICI', department: 'Üretim', permissions, email: 'test@ilerigroup.com' } },
    status: 'authenticated',
  } as ReturnType<typeof useSession>)
  render(<SidebarProvider><Sidebar isOpen onClose={() => {}} /></SidebarProvider>)
  fireEvent.click(screen.getByText('İV'))
  fireEvent.click(screen.getByText('Stratejik İK'))
  const kutu = screen.getByTestId('strategic-hr-subgroup-servis').parentElement as HTMLElement
  return Array.from(kutu.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '')
}

beforeEach(() => {
  vi.mocked(useSession).mockReset()
  global.fetch = vi.fn().mockRejectedValue(new Error('test ortamında fetch yok')) as unknown as typeof fetch
})

describe('Sidebar — idari-isler rolü, Servis alt grubu', () => {
  it('🔴 idari-isler: view/edit/şikâyet öğeleri GÖRÜNÜR; Acil Durum (servis.kvkk.view) GÖRÜNMEZ', () => {
    const linkler = servisLinkleri(IDARI_ISLER)
    console.log('idari-isler Servis alt öğeleri:', linkler.join(' | '))
    for (const ad of ['Servis Yönetimi', 'Servis Paneli', 'Veri Kalite Merkezi', 'Servis Şikâyetleri', 'Operasyonel Servis Listesi', "Excel'den Toplu Atama"]) {
      expect(linkler.some((l) => l.includes(ad)), ad).toBe(true)
    }
    expect(linkler.some((l) => l.includes('Acil Durum'))).toBe(false)
  })

  it('kontrol: servis.kvkk.view eklenince Acil Durum görünür', () => {
    expect(servisLinkleri([...IDARI_ISLER, 'servis.kvkk.view']).some((l) => l.includes('Acil Durum'))).toBe(true)
  })

  it('🔴 Excel\'den Toplu Atama servis.view VE servis.edit ister (yalnız view yetmez)', () => {
    const linkler = servisLinkleri(['servis.view'])
    expect(linkler.some((l) => l.includes("Excel'den Toplu Atama"))).toBe(false)
    expect(linkler.some((l) => l.includes('Servis Paneli'))).toBe(true)
  })
})
