import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSandboxBySlug } from '@/lib/sandbox-config'
import SandboxGuard from '@/components/sandbox/SandboxGuard'
import SandboxHeader from '@/components/sandbox/SandboxHeader'
import SandboxWorkspace from '@/components/sandbox/SandboxWorkspace'

export const metadata = { title: 'Sandbox — ILERIHub' }

export default async function MelikeSandboxPage() {
  return (
    <SandboxGuard slug="melike">
      <MelikeSandboxContent />
    </SandboxGuard>
  )
}

async function MelikeSandboxContent() {
  const session = await getServerSession(authOptions)
  const sandboxModule = getSandboxBySlug('melike')

  if (!sandboxModule) return null

  return (
    <div className="space-y-6">
      <SandboxHeader
        module={sandboxModule}
        userName={session?.user?.name ?? 'Melike'}
      />
      <SandboxWorkspace ownerName="Melike" />
    </div>
  )
}
