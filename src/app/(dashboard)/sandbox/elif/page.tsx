import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSandboxBySlug } from '@/lib/sandbox-config'
import SandboxGuard from '@/components/sandbox/SandboxGuard'
import SandboxHeader from '@/components/sandbox/SandboxHeader'
import SandboxWorkspace from '@/components/sandbox/SandboxWorkspace'

export const metadata = { title: 'Sandbox — ILERIHub' }

export default async function ElifSandboxPage() {
  return (
    <SandboxGuard slug="elif">
      <ElifSandboxContent />
    </SandboxGuard>
  )
}

async function ElifSandboxContent() {
  const session = await getServerSession(authOptions)
  const sandboxModule = getSandboxBySlug('elif')

  if (!sandboxModule) return null

  return (
    <div className="space-y-6">
      <SandboxHeader
        module={sandboxModule}
        userName={session?.user?.name ?? 'Elif'}
      />
      <SandboxWorkspace ownerName="Elif" />
    </div>
  )
}
