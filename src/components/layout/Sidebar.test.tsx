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

describe('Sidebar RBAC Dalga 1 — menü görünürlüğü sayfa guard’ıyla hizalandı', () => {
  const ac = (label: string) => fireEvent.click(screen.getByText(label))

  // 1) Yangın Güvenliği — sayfa middleware'i [ADMIN, SUPER_ADMIN, QUALITY_MANAGER].
  it('SUPER_ADMIN Yangın Güvenliği’ni GÖRÜR (eskiden roles’ta SA yoktu → menüde görünmüyordu)', () => {
    mockSession({ role: 'SUPER_ADMIN' })
    renderSidebar()
    ac('ILERI Teknik')
    expect(screen.getByText('Yangın Güvenliği')).toBeInTheDocument()
  })
  it('QUALITY_MANAGER Yangın Güvenliği’ni hâlâ GÖRÜR (mevcut rol korundu)', () => {
    mockSession({ role: 'QUALITY_MANAGER' })
    renderSidebar()
    ac('ILERI Teknik')
    expect(screen.getByText('Yangın Güvenliği')).toBeInTheDocument()
  })
  it('yetkisiz KULLANICI Yangın Güvenliği’ni GÖRMEZ (rol dışı)', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim' })
    renderSidebar()
    ac('ILERI Teknik') // grup her zaman render (Tezgah Bakım/Arşiv roles:"*")
    expect(screen.queryByText('Yangın Güvenliği')).not.toBeInTheDocument()
  })

  // 2/3) AD Eşleşme / AD Grup Mapping — sayfa SUPER_ADMIN-only.
  it('SUPER_ADMIN AD Eşleşme + AD Grup Mapping GÖRÜR', () => {
    mockSession({ role: 'SUPER_ADMIN' })
    renderSidebar()
    ac('Sistem Geliştirme')
    expect(screen.getByText('AD Eşleşme')).toBeInTheDocument()
    expect(screen.getByText('AD Grup Mapping')).toBeInTheDocument()
  })
  it('ADMIN AD Eşleşme’yi GÖRMEZ (sayfa SA-only; eskiden görüp YetkisizErisim alıyordu)', () => {
    // ADMIN'e admin.audit.view veriyoruz ki Sistem Geliştirme grubu (Login üzerinden) render olsun.
    mockSession({ role: 'ADMIN', permissions: ['admin.audit.view'] })
    renderSidebar()
    ac('Sistem Geliştirme')
    expect(screen.queryByText('AD Eşleşme')).not.toBeInTheDocument()
    expect(screen.queryByText('AD Grup Mapping')).not.toBeInTheDocument()
    expect(screen.getByText('Login Aktiviteleri')).toBeInTheDocument()
  })

  // 4/5) Login Aktiviteleri / Yedekleme — sayfa client permission.
  it('admin.audit.view izinli (rolsüz) kullanıcı Login Aktiviteleri’ni GÖRÜR', () => {
    mockSession({ role: 'KULLANICI', permissions: ['admin.audit.view'] })
    renderSidebar()
    ac('Sistem Geliştirme')
    expect(screen.getByText('Login Aktiviteleri')).toBeInTheDocument()
    expect(screen.queryByText('Yedekleme')).not.toBeInTheDocument() // ayrı izin
  })
  it('admin.backup.manage izinli kullanıcı Yedekleme’yi GÖRÜR', () => {
    mockSession({ role: 'KULLANICI', permissions: ['admin.backup.manage'] })
    renderSidebar()
    ac('Sistem Geliştirme')
    expect(screen.getByText('Yedekleme')).toBeInTheDocument()
  })

  // 6/7/8) Kalite kümesi — sayfa permission'ları (OR).
  it('quality.symbol.manage izinli kullanıcı Semboller’i GÖRÜR', () => {
    mockSession({ role: 'KULLANICI', permissions: ['quality.symbol.manage'] })
    renderSidebar()
    ac('Kalite') // grup her zaman render (Kalibrasyon roles:"*")
    expect(screen.getByText('Semboller')).toBeInTheDocument()
    expect(screen.queryByText('Ölçüm Raporları')).not.toBeInTheDocument()
  })
  it('quality.report.read izinli kullanıcı Ölçüm Raporları’nı GÖRÜR', () => {
    mockSession({ role: 'KULLANICI', permissions: ['quality.report.read'] })
    renderSidebar()
    ac('Kalite')
    expect(screen.getByText('Ölçüm Raporları')).toBeInTheDocument()
  })
  it('quality.report.create izinli kullanıcı Ölçüm Şablonları’nı GÖRÜR (OR kolu)', () => {
    mockSession({ role: 'KULLANICI', permissions: ['quality.report.create'] })
    renderSidebar()
    ac('Kalite')
    expect(screen.getByText('Ölçüm Şablonları')).toBeInTheDocument()
  })
  it('yetkisiz KULLANICI kalite ölçüm kalemlerini GÖRMEZ (Kalibrasyon hariç)', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim' })
    renderSidebar()
    ac('Kalite')
    expect(screen.getByText('Kalibrasyon')).toBeInTheDocument() // roles:"*" korundu
    expect(screen.queryByText('Semboller')).not.toBeInTheDocument()
    expect(screen.queryByText('Ölçüm Şablonları')).not.toBeInTheDocument()
    expect(screen.queryByText('Ölçüm Raporları')).not.toBeInTheDocument()
  })

  // 10) Offboarding — sayfa offboarding.view.
  it('offboarding.view izinli kullanıcı İlişik Kesme’yi GÖRÜR', () => {
    mockSession({ role: 'KULLANICI', permissions: ['offboarding.view'] })
    renderSidebar()
    ac('İV')
    expect(screen.getByText('İlişik Kesme')).toBeInTheDocument()
  })
  it('offboarding.view izni OLMAYAN SUPERVISOR İlişik Kesme’yi GÖRMEZ (rol-listesi kaldırıldı)', () => {
    mockSession({ role: 'SUPERVISOR', department: 'Üretim' })
    renderSidebar()
    // İV grubu bu kullanıcıda hiç render olmayabilir (showIkGroup false); her iki halde de kalem yok.
    expect(screen.queryByText('İlişik Kesme')).not.toBeInTheDocument()
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
