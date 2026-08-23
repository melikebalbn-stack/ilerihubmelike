import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { Sidebar, SidebarProvider } from './Sidebar'

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

type MockUser = {
  role?: string
  department?: string
  permissions?: string[]
  email?: string
}

function mockSession(user: MockUser) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { role: 'KULLANICI', department: '', permissions: [], email: 'test@ilerigroup.com', ...user } },
    status: 'authenticated',
  } as ReturnType<typeof useSession>)
}

function renderSidebar() {
  return render(
    <SidebarProvider>
      <Sidebar isOpen onClose={() => {}} />
    </SidebarProvider>
  )
}

function acIvGrubunu() {
  fireEvent.click(screen.getByText('İV'))
  // strategicHrMenuItems ayrı bir iç akordeon ("Stratejik İK") altında —
  // görünmesi için o da açılmalı.
  fireEvent.click(screen.getByText('Stratejik İK'))
}

beforeEach(() => {
  vi.mocked(useSession).mockReset()
  global.fetch = vi.fn().mockRejectedValue(new Error('test ortamında fetch yok')) as unknown as typeof fetch
})

describe('Sidebar — filterStrategicHrItems permission-öncelik düzeltmesi', () => {
  it('yilliktakvim.view iznine sahip ama İV departmanında/admin rolünde olmayan kullanıcı (idari-isler senaryosu) Yıllık Çalışma Takvimini GÖRÜR', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: ['yilliktakvim.view'] })
    renderSidebar()
    acIvGrubunu()
    expect(screen.getByText('Yıllık Çalışma Takvimi')).toBeInTheDocument()
  })

  it('aynı kullanıcı dokunulmamış (permission eklenmeyen) bir öğeyi GÖRMEZ — eski rol/departman mantığı hâlâ orada, blanket erişim yok', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: ['yilliktakvim.view'] })
    renderSidebar()
    acIvGrubunu()
    expect(screen.queryByText('Yetenek Yönetimi')).not.toBeInTheDocument()
    expect(screen.queryByText('Envanter')).not.toBeInTheDocument()
  })

  it('envanter.view izni olan aynı tip kullanıcı YALNIZ Envanteri görür, Yıllık Çalışma Takvimini GÖRMEZ (izinler birbirinden bağımsız)', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: ['envanter.view'] })
    renderSidebar()
    acIvGrubunu()
    expect(screen.getByText('Envanter')).toBeInTheDocument()
    expect(screen.queryByText('Yıllık Çalışma Takvimi')).not.toBeInTheDocument()
  })

  it('REGRESYON RİSKİ (bilerek belgelendi): legacy HR_MANAGER + İnsan Varlıkları departmanı ama RBAC izni OLMAYAN kullanıcı artık Yıllık Çalışma Takvimi / Envanter / İşe Alımı GÖRMEZ — permission alanı SOLE determinant olduğu için departman/rol fallback bu 3 öğede artık ÇALIŞMIYOR', () => {
    mockSession({ role: 'HR_MANAGER', department: 'İnsan Varlıkları', permissions: [] })
    renderSidebar()
    acIvGrubunu()
    expect(screen.queryByText('Yıllık Çalışma Takvimi')).not.toBeInTheDocument()
    expect(screen.queryByText('Envanter')).not.toBeInTheDocument()
    expect(screen.queryByText('İşe Alım')).not.toBeInTheDocument()
    // Dokunulmayan öğe hâlâ eski mantıkla (legacy rol) görünür kalmalı:
    expect(screen.getByText('Yetenek Yönetimi')).toBeInTheDocument()
  })

  it('aynı legacy HR_MANAGER kullanıcı gerekli RBAC izinlerine de sahipse 3 öğeyi de GÖRÜR', () => {
    mockSession({
      role: 'HR_MANAGER',
      department: 'İnsan Varlıkları',
      permissions: ['yilliktakvim.view', 'envanter.view', 'recruitment.view'],
    })
    renderSidebar()
    acIvGrubunu()
    expect(screen.getByText('Yıllık Çalışma Takvimi')).toBeInTheDocument()
    expect(screen.getByText('Envanter')).toBeInTheDocument()
    expect(screen.getByText('İşe Alım')).toBeInTheDocument()
  })

  it('İnsan Varlıkları departmanındaki (legacy) bir kullanıcı dokunulmayan öğeleri hâlâ departman-fallback ile görür', () => {
    mockSession({ role: 'KULLANICI', department: 'İnsan Varlıkları', permissions: [] })
    renderSidebar()
    acIvGrubunu()
    expect(screen.getByText('Yetenek Yönetimi')).toBeInTheDocument()
    expect(screen.getByText('Yedekleme Planlaması')).toBeInTheDocument()
    expect(screen.getByText('Performans Yönetimi')).toBeInTheDocument()
    expect(screen.getByText('Organizasyon Şeması')).toBeInTheDocument()
  })
})

describe('Sidebar — regresyon kontrolü: mainMenuItems (filterItems) DEĞİŞMEDİ', () => {
  it('roles:["*"] öğesi (Dashboard) her kullanıcı için görünür kalmaya devam ediyor', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('idari-isler senaryosunda da Dashboard hâlâ görünür (filterItems etkilenmedi)', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: ['yilliktakvim.view'] })
    renderSidebar()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
