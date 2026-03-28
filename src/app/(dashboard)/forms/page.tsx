"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Users, ClipboardList, Plus } from "lucide-react"
import Link from "next/link"

const formTypes = [
  {
    id: "visit-reports",
    title: "Ziyaret Raporları",
    description: "Müşteri ve tedarikçi ziyaret raporları oluşturun ve yönetin",
    icon: Users,
    href: "/forms/visit-reports",
    color: "bg-blue-500"
  },
  {
    id: "meeting-notes",
    title: "Toplantı Notları",
    description: "Toplantı kayıtları ve kararları (Yakında)",
    icon: ClipboardList,
    href: "#",
    color: "bg-green-500",
    disabled: true
  },
  {
    id: "expense-reports",
    title: "Masraf Raporları",
    description: "Seyahat ve masraf raporları (Yakında)",
    icon: FileText,
    href: "#",
    color: "bg-orange-500",
    disabled: true
  }
]

export default function FormsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold">Formlar</h1>
          <p className="text-muted-foreground">
            Kurumsal formları oluşturun ve yönetin
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {formTypes.map((form) => (
          <Card
            key={form.id}
            className={`relative overflow-hidden ${form.disabled ? "opacity-60" : "hover:shadow-lg transition-shadow cursor-pointer"}`}
          >
            <Link href={form.disabled ? "#" : form.href} className={form.disabled ? "pointer-events-none" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${form.color}`}>
                    <form.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{form.title}</CardTitle>
                    {form.disabled && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Yakında
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{form.description}</CardDescription>
              </CardContent>
            </Link>
            {!form.disabled && (
              <div className="absolute top-4 right-4">
                <Link href={`${form.href}/new`}>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Yeni
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
