'use client'

import Link from 'next/link'
import { User, Mail, Phone, Building2, MapPin, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Employee {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
  location: string | null
  phone: string | null
  avatar: string | null
}

interface EmployeeCardProps {
  employee: Employee
  className?: string
}

// Avatar renkleri (ismin ilk harfine göre)
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

export function EmployeeCard({ employee, className }: EmployeeCardProps) {
  return (
    <Link
      href={`/employees/${employee.id}`}
      className={cn(
        'group block rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/30',
        className
      )}
    >
      {/* Avatar ve İsim */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold shrink-0',
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
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {employee.name}
          </h3>
          {employee.title && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {employee.title}
            </p>
          )}
        </div>
      </div>

      {/* Detaylar */}
      <div className="mt-4 space-y-2">
        {employee.department && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{employee.department}</span>
          </div>
        )}
        {employee.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{employee.location}</span>
          </div>
        )}
        {employee.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{employee.email}</span>
          </div>
        )}
        {employee.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{employee.phone}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
