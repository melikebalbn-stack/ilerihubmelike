import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessSandbox, getSandboxBySlug } from '@/lib/sandbox-config'

interface SandboxGuardProps {
  slug: string
  children: ReactNode
}

export default async function SandboxGuard({ slug, children }: SandboxGuardProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  const userEmail = session.user.email as string
  const userRole = (session.user as { role?: string }).role ?? 'EMPLOYEE'

  // İlk testte email formatını doğrulamak için — test sonrası bu satırı sil
  console.log('[SANDBOX DEBUG] email:', userEmail, '| slug:', slug, '| role:', userRole)

  const sandboxModule = getSandboxBySlug(slug)

  if (!sandboxModule || !canAccessSandbox(slug, userEmail, userRole)) {
    redirect('/')
  }

  return <>{children}</>
}
