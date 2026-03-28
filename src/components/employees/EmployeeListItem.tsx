'use client'

import Link from 'next/link'
import { Mail, Building2, Phone, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Employee {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
  phone: string | null
  avatar: string | null
}

interface EmployeeListItemProps {
  employee: Employee
  className?: string
}

// Avatar renkleri
const avatarColors = [
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
  'bg-orange-100 text-orange-600',
  'bg-pink-100 text-pink-600',
  'bg-teal-100 text-teal-600',
  'bg-indigo-100 text-indigo-600',
  'bg-rose-100 text-rose-600',
]

function getAvatarColor(name: string): string {
  const charCode = name.charCodeAt(0) || 0
  return avatarColors[charCode % avatarColors.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function EmployeeListItem({ employee, className }: EmployeeListItemProps) {
  return (
    <Link
      href={`/employees/${employee.id}`}
      className={cn(
        'group flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30',
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold shrink-0',
          getAvatarColor(employee.name)
        )}
      >
        {employee.avatar ? (
          <img
            src={employee.avatar}
            alt={employee.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          getInitials(employee.name)
        )}
      </div>

      {/* Bilgiler */}
      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-1 md:gap-4">
        {/* İsim ve Unvan */}
        <div className="min-w-0">
          <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {employee.name}
          </h3>
          {employee.title && (
            <p className="text-sm text-muted-foreground truncate">
              {employee.title}
            </p>
          )}
        </div>

        {/* Departman */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{employee.department || '-'}</span>
        </div>

        {/* E-posta */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">{employee.email || '-'}</span>
        </div>

        {/* Dahili */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4 shrink-0" />
          <span>{employee.phone || '-'}</span>
        </div>
      </div>

      {/* Ok ikonu */}
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </Link>
  )
}
