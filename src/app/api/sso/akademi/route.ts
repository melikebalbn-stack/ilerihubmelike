import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'crypto'

// Shared secret for SSO token validation (must match Akademi)
// FIX #1: Hardcoded fallback kaldırıldı - secret sadece env'den gelir
const SSO_SECRET = process.env.AKADEMI_SSO_SECRET
// Internal IP kullanıyoruz - Cloudflare bypass ve SSL sorunu önlemek için
const AKADEMI_INTERNAL_URL = 'https://172.16.16.30'
// Kullanıcının browser'ında açılacak URL (Cloudflare üzerinden)
const AKADEMI_PUBLIC_URL = 'https://akademi.ilerigroup.com'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // FIX #1: Environment variable kontrolü
    if (!SSO_SECRET) {
      console.error('[SSO] AKADEMI_SSO_SECRET environment variable is not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const email = session.user.email
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const token = crypto.randomBytes(16).toString('hex')

    // Create signature
    const signature = crypto
      .createHmac('sha256', SSO_SECRET)
      .update(token + email + timestamp)
      .digest('hex')

    // Build SSO URL - Public URL üzerinden (browser redirect için)
    const ssoUrl = new URL('/api/auth/sso', AKADEMI_PUBLIC_URL)
    ssoUrl.searchParams.set('token', token)
    ssoUrl.searchParams.set('email', email)
    ssoUrl.searchParams.set('timestamp', timestamp)
    ssoUrl.searchParams.set('signature', signature)

    // Redirect to Akademi SSO endpoint
    return NextResponse.redirect(ssoUrl.toString())

  } catch (error) {
    console.error('Akademi SSO error:', error)
    return NextResponse.json({ error: 'SSO hatası' }, { status: 500 })
  }
}
