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

  // 6/7/8) Kalite ölçüm kümesi — ADIM 5'te MENÜDEN GİZLENDİ (hidden: true),
  // ADIM 6'da Kalibrasyon + RMA da Formlar'a taşındı. Bu kullanıcılarda Kalite
  // grubunun üç kolu da boş → grup HİÇ çizilmiyor, o yüzden ac('Kalite') YOK.
  // Kalem zaten DOM'da olmadığı için doğrudan sorgulamak daha güçlü bir kanıt.
  it('quality.symbol.manage izinli kullanıcı bile Semboller’i GÖRMEZ (hidden)', () => {
    mockSession({ role: 'KULLANICI', permissions: ['quality.symbol.manage'] })
    renderSidebar()
    expect(screen.queryByText('Semboller')).not.toBeInTheDocument()
  })
  it('quality.report.read izinli kullanıcı bile Ölçüm Raporları’nı GÖRMEZ (hidden)', () => {
    mockSession({ role: 'KULLANICI', permissions: ['quality.report.read'] })
    renderSidebar()
    expect(screen.queryByText('Ölçüm Raporları')).not.toBeInTheDocument()
  })
  it('quality.report.create izinli kullanıcı bile Ölçüm Şablonları’nı GÖRMEZ (hidden)', () => {
    mockSession({ role: 'KULLANICI', permissions: ['quality.report.create'] })
    renderSidebar()
    expect(screen.queryByText('Ölçüm Şablonları')).not.toBeInTheDocument()
  })
  it('yetkisiz KULLANICI ölçüm kalemlerini GÖRMEZ ve Kalite grubu toggle’ı HİÇ çizilmez', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim' })
    renderSidebar()
    expect(screen.queryByText('Semboller')).not.toBeInTheDocument()
    expect(screen.queryByText('Ölçüm Şablonları')).not.toBeInTheDocument()
    expect(screen.queryByText('Ölçüm Raporları')).not.toBeInTheDocument()
    // Formlar kapalıyken "Kalite" metni yalnız grup toggle'ından gelebilirdi.
    expect(screen.queryByText('Kalite')).not.toBeInTheDocument()
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

describe('Sidebar — Formlar grubu alt başlıkları', () => {
  function acFormlarGrubunu() {
    fireEvent.click(screen.getByText('Formlar'))
  }

  it('Formlar açıldığında alt başlıklar render edilir ve öğeler altlarında görünür', () => {
    // roles:["*"] kalemler herkeste görünür → Genel/Üretim/İV dolu.
    // (Kalite alt grubu ADIM 5'te boşaldı, ayrı testte.)
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()
    acFormlarGrubunu()

    // Metinle değil test kancasıyla: "Kalite" / "İnsan Varlıkları" sidebar'da
    // başka grup başlıklarında da geçiyor.
    expect(screen.getByTestId('form-subgroup-genel')).toHaveTextContent('Genel')
    expect(screen.getByTestId('form-subgroup-uretim')).toHaveTextContent('Üretim')
    expect(screen.getByTestId('form-subgroup-iv')).toHaveTextContent('İnsan Varlıkları')

    // Öğelerin kendisi hâlâ yerinde (alt gruplama görünürlüğü değiştirmedi).
    expect(screen.getByText('Ziyaret Raporları')).toBeInTheDocument()
    expect(screen.getByText('Vardiya Formu')).toBeInTheDocument()
  })

  it('Formlar › Kalite başlığı GERİ GELDİ: Kalibrasyon → RMA sırasıyla (ADIM 6)', () => {
    // ADIM 5'te boşalmıştı, başlık çizilmiyordu; ADIM 6 iki kalem taşıdı.
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()
    acFormlarGrubunu()
    const kaliteKutu = screen.getByTestId('form-subgroup-kalite').parentElement as HTMLElement
    expect(
      Array.from(kaliteKutu.querySelectorAll('a')).map((a) => a.textContent?.trim()),
    ).toEqual(['Kalibrasyon', 'RMA/SMA İade Formu'])
  })

  it('aramada "insan varlıkları" yazınca Vardiya Formu sonuçlarda gelir (grup adıyla eşleşme)', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()
    fireEvent.change(screen.getByLabelText('Menüde ara'), {
      target: { value: 'insan varlıkları' },
    })
    expect(screen.getByText('Vardiya Formu')).toBeInTheDocument()
  })
})

describe('Sidebar — ADIM 2: form olmayan öğelerin taşınması', () => {
  it('Mesai Performansı Formlar › Üretim ALTINDA, İV grubunda değil ve tek kopya (ADIM 4 geri alımı)', () => {
    // ADIM 2'de İV grubuna alınmıştı; ADIM 4'te Formlar'a döndü. Formlar kapalıyken
    // görünmemesi, artık üst seviyede ayrı render EDİLMEDİĞİNİN kanıtı.
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()
    expect(screen.queryByText('Mesai Performansı')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Formlar'))
    const uretimKutu = screen.getByTestId('form-subgroup-uretim').parentElement as HTMLElement
    expect(
      Array.from(uretimKutu.querySelectorAll('a')).map((a) => a.textContent?.trim()),
    ).toEqual(['Mesai Formu', 'Mesai Performansı'])
    expect(screen.getAllByText('Mesai Performansı')).toHaveLength(1)
  })

  it('yalnız amir bayrağı olan kullanıcıda Stratejik İK grubu görünür ve "Onayımdaki İş Analizleri" ORADA', async () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    // Sunucu bayrağı: amir=true, ik=false. Diğer menü-bayrak uçları kapalı.
    global.fetch = vi.fn().mockImplementation((url: string) =>
      String(url).includes('/api/strategic-hr/is-analizi/menu-bayrak')
        ? Promise.resolve({ ok: true, json: async () => ({ amir: true, ik: false }) })
        : Promise.reject(new Error('test ortamında fetch yok'))
    ) as unknown as typeof fetch
    renderSidebar()

    // İV grubu YALNIZ bu öğe sayesinde açılır (filteredStrategicHrItems.length > 0).
    fireEvent.click(await screen.findByText('İV'))
    fireEvent.click(screen.getByText('Stratejik İK'))

    const link = screen.getByText('Onayımdaki İş Analizleri').closest('a')
    expect(link).toHaveAttribute('href', '/strategic-hr/is-analizi/onaylarim')
  })
})

describe('Sidebar — ADIM 3: Genel alt grubu + Üretim alt grubu', () => {
  it('Genel alt grubu TAM 5 öğe ve istenen sırada (Öneri, IT Destek Talebi, Ziyaret, Toplantı, Zimmetlerim)', () => {
    // Beşi de roles:["*"] → sıradan kullanıcıda hepsi görünür.
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()
    fireEvent.click(screen.getByText('Formlar'))

    // Başlık + öğeleri saran <div key={g.key}> kutusu: içindeki <a>'lar
    // alt grubun öğeleridir, DOM sırası = dizideki sıra.
    const genelKutu = screen.getByTestId('form-subgroup-genel').parentElement as HTMLElement
    const adlar = Array.from(genelKutu.querySelectorAll('a')).map((a) => a.textContent?.trim())
    expect(adlar).toEqual([
      'Öneri Sistemi',
      'IT Destek Talebi',
      'Ziyaret Raporları',
      'Toplantı Raporu',
      'Zimmetlerim',
    ])

    // Taşınan iki öğe eski yerlerinde DEĞİL: mainMenuItems ve bottomMenuItems
    // her zaman çizildiği için isim tek kopya kalmalı (yalnız Formlar › Genel'de).
    expect(screen.getAllByText('Öneri Sistemi')).toHaveLength(1)
    expect(screen.getAllByText('IT Destek Talebi')).toHaveLength(1)
  })

  it('Üretim başlığı ARTIK çizilir (2 öğe) ve İV alt grubu 4 öğeye düştü; "it destek" araması çalışıyor', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()
    fireEvent.click(screen.getByText('Formlar'))

    expect(screen.getByTestId('form-subgroup-genel')).toBeInTheDocument()
    // ADIM 3'te boştu, başlık çizilmiyordu; ADIM 4 iki öğe taşıdı.
    const uretimKutu = screen.getByTestId('form-subgroup-uretim').parentElement as HTMLElement
    expect(uretimKutu.querySelectorAll('a')).toHaveLength(2)

    // Mesai Formu + Mesai Performansı çıkınca İV'de koşulsuz 3 kalem kalır;
    // Personel Talep Formu sunucu bayrağına bağlı (testte kapalı).
    const ivKutu = screen.getByTestId('form-subgroup-iv').parentElement as HTMLElement
    expect(
      Array.from(ivKutu.querySelectorAll('a')).map((a) => a.textContent?.trim()),
    ).toEqual(['Vardiya Formu', 'Kart Okutamama', 'İş Analizi Formu'])

    // Arama kaynağı formsBySubgroup'tan besleniyor → öğe "Formlar › Genel" grubunda.
    fireEvent.change(screen.getByLabelText('Menüde ara'), { target: { value: 'it destek' } })
    expect(screen.getByText('IT Destek Talebi')).toBeInTheDocument()
  })
})

describe('Sidebar — ADIM 5/6: Kalite grubu toparlama', () => {
  it('gizlenen üç ölçüm kalemi ARAMADA da çıkmaz (izinli kullanıcıda bile)', () => {
    // searchableItems filterItems'tan geçen listelerden besleniyor → hidden
    // kalem ağaçta olmadığı gibi aramada da yok. Üçünün de izni verildi.
    mockSession({
      role: 'KULLANICI',
      permissions: ['quality.symbol.manage', 'quality.report.read', 'quality.report.create'],
    })
    renderSidebar()
    for (const q of ['ölçüm', 'sembol']) {
      fireEvent.change(screen.getByLabelText('Menüde ara'), { target: { value: q } })
      expect(screen.queryByText('Ölçüm Şablonları')).not.toBeInTheDocument()
      expect(screen.queryByText('Ölçüm Raporları')).not.toBeInTheDocument()
      expect(screen.queryByText('Semboller')).not.toBeInTheDocument()
    }
  })

  // (a) ADIM 6 — yetkisiz kullanıcı
  it('yetkisiz kullanıcıda Kalite GRUBU yok; Kalibrasyon + RMA Formlar › Kalite\'de ve tek kopya', () => {
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: [] })
    renderSidebar()

    // Formlar kapalıyken ikisi de DOM'da değil → Kalite grubundan çıktıklarının kanıtı.
    expect(screen.queryByText('Kalibrasyon')).not.toBeInTheDocument()
    expect(screen.queryByText('RMA/SMA İade Formu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Formlar'))
    const kaliteKutu = screen.getByTestId('form-subgroup-kalite').parentElement as HTMLElement
    expect(
      Array.from(kaliteKutu.querySelectorAll('a')).map((a) => a.textContent?.trim()),
    ).toEqual(['Kalibrasyon', 'RMA/SMA İade Formu'])
    expect(screen.getAllByText('Kalibrasyon')).toHaveLength(1)
    expect(screen.getAllByText('RMA/SMA İade Formu')).toHaveLength(1)
    expect(screen.getByText('RMA/SMA İade Formu').closest('a')).toHaveAttribute('href', '/kalite/rma')
    expect(screen.getByText('Kalibrasyon').closest('a')).toHaveAttribute('href', '/calibration')
  })

  // (b) ADIM 6 — koşullu kalem yetkilisi: grup toggle koşulu DEĞİŞMEDİ
  it('quality.hatakodu.manage izinlisinde Kalite grubu VAR ve içinde YALNIZ koşullu öğeler', () => {
    // canSeeHataKodu = canAccessKalite VEYA quality.hatakodu.manage; bu kullanıcıda
    // yalnız izin kolu doğru. canSeeUygunsuzluk de canSeeHataKodu'ndan geliyor.
    // filteredKaliteItems (3 hidden) ve filteredQdmsItems/Audits boş → grup YALNIZ
    // bu iki koşullu kalemle çiziliyor; toggle koşuluna hiç dokunulmadı.
    mockSession({ role: 'KULLANICI', department: 'Üretim', permissions: ['quality.hatakodu.manage'] })
    renderSidebar()

    fireEvent.click(screen.getByText('Kalite'))
    expect(screen.getByText('Hata Kodları')).toBeInTheDocument()
    expect(screen.getByText('Uygunsuzluk Kayıtları')).toBeInTheDocument()
    // Taşınan iki kalem grupta DEĞİL (Formlar açılmadı, hiç görünmemeliler).
    expect(screen.queryByText('Kalibrasyon')).not.toBeInTheDocument()
    expect(screen.queryByText('RMA/SMA İade Formu')).not.toBeInTheDocument()
    // Gizli üçlü de yok.
    expect(screen.queryByText('Semboller')).not.toBeInTheDocument()
  })
})
