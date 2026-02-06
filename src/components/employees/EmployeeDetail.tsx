'use client'

import Link from 'next/link'
import { Mail, Phone, Building2, MapPin, Briefcase, User, Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TeamMember {
  id: string
  name: string
  title: string | null
  email: string | null
}

interface Manager {
  id: string
  name: string
  title: string | null
  email: string | null
}

interface EmployeeDetailData {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
  location: string | null
  phone: string | null
  avatar: string | null
  manager: Manager | null
  teamMembers: TeamMember[]
}

interface EmployeeDetailProps {
  employee: EmployeeDetailData
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

export function EmployeeDetail({ employee }: EmployeeDetailProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Sol: Profil Kartı */}
      <div className="lg:col-span-1">
        <Card>
          <CardContent className="pt-6">
            {/* Avatar */}
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  'flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold',
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
              <h1 className="mt-4 text-xl font-bold">{employee.name}</h1>
              {employee.title && (
                <p className="text-muted-foreground">{employee.title}</p>
              )}
            </div>

            {/* İletişim Bilgileri */}
            <div className="mt-6 space-y-3">
              {employee.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${employee.email}`}
                    className="text-primary hover:underline"
                  >
                    {employee.email}
                  </a>
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`tel:${employee.phone}`}
                    className="hover:underline"
                  >
                    {employee.phone}
                  </a>
                </div>
              )}
              {employee.department && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.department}</span>
                </div>
              )}
              {employee.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.location}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sağ: Yönetici ve Ekip */}
      <div className="lg:col-span-2 space-y-6">
        {/* Yönetici */}
        {employee.manager && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Yönetici
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/employees/${employee.manager.id}`}
                className="group flex items-center gap-4 rounded-lg border bg-muted/30 p-4 transition-all hover:bg-muted/50"
              >
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold shrink-0',
                    getAvatarColor(employee.manager.name)
                  )}
                >
                  {getInitials(employee.manager.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium group-hover:text-primary transition-colors">
                    {employee.manager.name}
                  </h3>
                  {employee.manager.title && (
                    <p className="text-sm text-muted-foreground truncate">
                      {employee.manager.title}
                    </p>
                  )}
                  {employee.manager.email && (
                    <p className="text-sm text-muted-foreground truncate">
                      {employee.manager.email}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Ekip Üyeleri */}
        {employee.teamMembers.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ekip Üyeleri ({employee.teamMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {employee.teamMembers.map((member) => (
                  <Link
                    key={member.id}
                    href={`/employees/${member.id}`}
                    className="group flex items-center gap-3 rounded-lg border bg-muted/30 p-3 transition-all hover:bg-muted/50"
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold shrink-0',
                        getAvatarColor(member.name)
                      )}
                    >
                      {getInitials(member.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                        {member.name}
                      </h4>
                      {member.title && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.title}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ekip üyesi yoksa */}
        {employee.teamMembers.length === 0 && !employee.manager && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Ekip bilgisi bulunamadı</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
