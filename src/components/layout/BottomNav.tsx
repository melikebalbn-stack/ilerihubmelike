'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Bell, CheckSquare, MessageSquare, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const bottomNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
  { href: '/notifications', icon: Bell, label: 'Bildirimler' },
  { href: '/tasks', icon: CheckSquare, label: 'Görevler' },
  { href: '/messages', icon: MessageSquare, label: 'Mesajlar' },
  { href: '/employees', icon: User, label: 'Rehber' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card lg:hidden">
      <div className="flex items-center justify-around">
        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
