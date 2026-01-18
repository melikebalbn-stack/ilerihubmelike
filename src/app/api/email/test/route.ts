import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

// POST - Test e-postası gönder (SADECE ADMIN)
export async function POST(request: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SADECE ADMIN erişebilir
    const userRole = session.user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json(
        { error: 'E-posta adresi gerekli' },
        { status: 400 }
      )
    }

    const result = await sendEmail(
      [{ email, name: name || 'Test Kullanıcı' }],
      '✅ ILERIHub E-posta Sistemi Test',
      `
Merhaba ${name || 'Test Kullanıcı'},

Bu e-posta ILERIHub e-posta sisteminin test mesajıdır.

Eğer bu e-postayı aldıysanız, sistem başarıyla yapılandırılmış demektir.

Sistem özellikleri:
• Kalibrasyon süresi dolacak uyarı e-postaları
• Kalibrasyon süresi dolmuş acil bildirimler
• Özelleştirilebilir e-posta şablonları
• Otomatik bildirim sistemi

--
Bu e-posta ILERIHub tarafından otomatik olarak gönderilmiştir.
© 2026 İleri Group - System Development Team
      `.trim()
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test e-postası başarıyla gönderildi',
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'E-posta gönderilemedi',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Test e-postası gönderme hatası:', error)
    return NextResponse.json(
      { error: 'E-posta gönderilirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
