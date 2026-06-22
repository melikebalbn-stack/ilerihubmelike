export type SandboxModule = {
  slug: string
  name: string
  ownerEmail: string
  ownerUsername: string
  description: string
  color: string
  icon: string
}

export const SANDBOX_MODULES: SandboxModule[] = [
  {
    slug: 'elif',
    name: "Elif'in Geliştirici Alanı",
    ownerEmail: 'Elif.yildirim@ilerigroup.com',
    ownerUsername: 'Elif.yildirim',
    description: "Elif Yıldırım'ın kişisel geliştirici çalışma alanı",
    color: 'violet',
    icon: '🔬',
  },
  {
    slug: 'melike',
    name: "Melike'nin Geliştirici Alanı",
    ownerEmail: 'melike.balaban@ilerigroup.com',
    ownerUsername: 'melike.balaban',
    description: "Melike Balaban'ın kişisel geliştirici çalışma alanı",
    color: 'rose',
    icon: '✨',
  },
  {
    slug: 'nurgul',
    name: "Nurgül'ün Geliştirici Alanı",
    ownerEmail: 'nurgul.tastan@ilerigroup.com',
    ownerUsername: 'nurgul.tastan',
    description: "Nurgül Taştan'ın kişisel geliştirici çalışma alanı",
    color: 'amber',
    icon: '🧪',
  },
]

export function getSandboxBySlug(slug: string): SandboxModule | undefined {
  return SANDBOX_MODULES.find((m) => m.slug === slug)
}

export function canAccessSandbox(
  slug: string,
  userEmail: string,
  userRole: string
): boolean {
  if (userRole === 'SUPER_ADMIN') return true

  const sandboxModule = getSandboxBySlug(slug)
  if (!sandboxModule) return false

  return sandboxModule.ownerEmail.toLowerCase() === userEmail.toLowerCase()
}
