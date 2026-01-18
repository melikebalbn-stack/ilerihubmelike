import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Örnek ticketlar oluşturuluyor...')

  // Kategorileri kontrol et, yoksa oluştur
  let categories = await prisma.ticketCategory.findMany({ take: 5 })

  if (categories.length === 0) {
    console.log('Kategoriler oluşturuluyor...')
    const cat1 = await prisma.ticketCategory.create({
      data: { name: 'Donanım', description: 'Bilgisayar, yazıcı, monitör vb.', color: '#ef4444' }
    })
    const cat2 = await prisma.ticketCategory.create({
      data: { name: 'Yazılım', description: 'Uygulama kurulum, güncelleme, hata', color: '#3b82f6' }
    })
    const cat3 = await prisma.ticketCategory.create({
      data: { name: 'Ağ/İnternet', description: 'Bağlantı sorunları, VPN, wifi', color: '#22c55e' }
    })
    const cat4 = await prisma.ticketCategory.create({
      data: { name: 'Erişim İzni', description: 'Yetkilendirme, şifre sıfırlama', color: '#f59e0b' }
    })
    const cat5 = await prisma.ticketCategory.create({
      data: { name: 'E-posta', description: 'Outlook, mail ayarları', color: '#8b5cf6' }
    })
    categories = [cat1, cat2, cat3, cat4, cat5]
    console.log('5 kategori oluşturuldu')
  }

  // Ticket numarası oluştur
  const year = new Date().getFullYear()
  const prefix = `TKT-${year}-`

  const lastTicket = await prisma.ticket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: 'desc' }
  })

  let nextNum = 1
  if (lastTicket) {
    const last = parseInt(lastTicket.ticketNumber.split('-').pop() || '0')
    nextNum = last + 1
  }

  const now = new Date()

  // 5 örnek ticket
  const ticketsData = [
    {
      subject: 'Bilgisayar açılmıyor',
      description: 'Sabahtan beri bilgisayarım açılmıyor. Güç tuşuna basınca hiçbir tepki yok. Acil yardım lütfen!',
      ticketType: 'INCIDENT' as const,
      priority: 'TICKET_HIGH' as const,
      status: 'NEW' as const,
      requesterEmail: 'test@ilerigroup.com',
      requesterName: 'Test Kullanıcı',
      requesterDept: 'Muhasebe',
      location: '2. Kat, Oda 205',
      categoryId: categories[0]?.id,
      slaResponseDue: new Date(now.getTime() + 1*60*60*1000), // 1 saat
      slaResolutionDue: new Date(now.getTime() + 8*60*60*1000), // 8 saat
    },
    {
      subject: 'Office 365 kurulumu gerekiyor',
      description: 'Yeni bilgisayarıma Office 365 kurulması gerekiyor. Word, Excel ve Outlook kullanacağım.',
      ticketType: 'SERVICE_REQUEST' as const,
      priority: 'NORMAL' as const,
      status: 'ASSIGNED' as const,
      assignedTo: 'erdi.ozturk@ilerigroup.com',
      assignedToName: 'Erdi Öztürk',
      requesterEmail: 'ahmet.yilmaz@ilerigroup.com',
      requesterName: 'Ahmet Yılmaz',
      requesterDept: 'İnsan Kaynakları',
      categoryId: categories[1]?.id,
      respondedAt: new Date(now.getTime() - 2*60*60*1000), // 2 saat önce yanıtlandı
      slaResponseDue: new Date(now.getTime() + 4*60*60*1000),
      slaResolutionDue: new Date(now.getTime() + 24*60*60*1000),
    },
    {
      subject: 'VPN bağlantı sorunu - Acil',
      description: 'Evden çalışırken VPN bağlanamıyorum. "Connection timeout" hatası alıyorum. Bugün toplantım var, acil çözülmeli.',
      ticketType: 'INCIDENT' as const,
      priority: 'TICKET_HIGH' as const,
      status: 'IN_PROGRESS' as const,
      assignedTo: 'erdi.ozturk@ilerigroup.com',
      assignedToName: 'Erdi Öztürk',
      requesterEmail: 'mehmet.demir@ilerigroup.com',
      requesterName: 'Mehmet Demir',
      requesterDept: 'Satış',
      categoryId: categories[2]?.id,
      respondedAt: new Date(now.getTime() - 4*60*60*1000),
      slaResponseDue: new Date(now.getTime() - 3*60*60*1000), // SLA aşıldı
      slaResolutionDue: new Date(now.getTime() + 4*60*60*1000),
      slaResponseBreached: true,
    },
    {
      subject: 'SAP erişim yetkisi talebi',
      description: 'Finans modülüne görüntüleme yetkisi almam gerekiyor. Raporları incelemem lazım.',
      ticketType: 'SERVICE_REQUEST' as const,
      priority: 'NORMAL' as const,
      status: 'RESOLVED' as const,
      assignedTo: 'erdi.ozturk@ilerigroup.com',
      assignedToName: 'Erdi Öztürk',
      requesterEmail: 'zeynep.kaya@ilerigroup.com',
      requesterName: 'Zeynep Kaya',
      requesterDept: 'Finans',
      categoryId: categories[3]?.id,
      respondedAt: new Date(now.getTime() - 24*60*60*1000),
      resolvedAt: new Date(now.getTime() - 2*60*60*1000),
      resolutionSummary: 'SAP finans modülü görüntüleme yetkisi başarıyla tanımlandı. Kullanıcı sisteme giriş yaparak test etti.',
      slaResponseDue: new Date(now.getTime() - 20*60*60*1000),
      slaResolutionDue: new Date(now.getTime() + 24*60*60*1000),
    },
    {
      subject: 'E-posta imza güncelleme',
      description: 'Terfi aldım, yeni unvanıma göre e-posta imzamın güncellenmesini istiyorum. Pazarlama Müdürü olarak değiştirilmeli.',
      ticketType: 'SERVICE_REQUEST' as const,
      priority: 'TICKET_LOW' as const,
      status: 'CLOSED' as const,
      assignedTo: 'erdi.ozturk@ilerigroup.com',
      assignedToName: 'Erdi Öztürk',
      requesterEmail: 'ali.veli@ilerigroup.com',
      requesterName: 'Ali Veli',
      requesterDept: 'Pazarlama',
      categoryId: categories[4]?.id,
      respondedAt: new Date(now.getTime() - 48*60*60*1000),
      resolvedAt: new Date(now.getTime() - 46*60*60*1000),
      closedAt: new Date(now.getTime() - 24*60*60*1000),
      resolutionSummary: 'E-posta imzası "Pazarlama Müdürü" olarak güncellendi.',
      satisfactionRating: 5,
      satisfactionComment: 'Çok hızlı çözüldü, teşekkürler!',
      slaResponseDue: new Date(now.getTime() - 40*60*60*1000),
      slaResolutionDue: new Date(now.getTime() - 24*60*60*1000),
    }
  ]

  for (let i = 0; i < ticketsData.length; i++) {
    const ticketNumber = `${prefix}${String(nextNum + i).padStart(4, '0')}`

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ...ticketsData[i],
        source: 'WEB_PORTAL',
      }
    })

    // Timeline kaydı
    await prisma.ticketTimeline.create({
      data: {
        ticketId: ticket.id,
        action: 'created',
        description: 'Ticket oluşturuldu',
        performedBy: ticketsData[i].requesterEmail,
        performedByName: ticketsData[i].requesterName,
      }
    })

    console.log(`✓ Ticket oluşturuldu: ${ticketNumber} - ${ticketsData[i].subject}`)
  }

  console.log('\n✅ 5 örnek ticket başarıyla oluşturuldu!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
