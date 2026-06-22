"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Tag, Layers, Trash2 } from "lucide-react"
import { Subsection } from "../CollapsibleSection"
import type { TicketCategory } from "@/types/settings"

interface ITTicketSettingsPanelProps {
  ticketCategories: TicketCategory[]
  newTicketCategory: {
    name: string
    description: string
    color: string
    defaultPriority: string
  }
  setNewTicketCategory: (cat: { name: string; description: string; color: string; defaultPriority: string }) => void
  addingTicketCategory: boolean
  ticketCategorySearch: string
  setTicketCategorySearch: (search: string) => void
  onAddCategory: () => void
  onDeleteCategory: (id: string) => void
}

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'TICKET_CRITICAL':
      return { label: 'Kritik', color: 'bg-red-100 text-red-800' }
    case 'TICKET_HIGH':
      return { label: 'Yüksek', color: 'bg-orange-100 text-orange-800' }
    case 'NORMAL':
      return { label: 'Normal', color: 'bg-blue-100 text-blue-800' }
    default:
      return { label: 'Düşük', color: 'bg-gray-100 text-gray-800' }
  }
}

export function ITTicketSettingsPanel({
  ticketCategories,
  newTicketCategory,
  setNewTicketCategory,
  addingTicketCategory,
  ticketCategorySearch,
  setTicketCategorySearch,
  onAddCategory,
  onDeleteCategory
}: ITTicketSettingsPanelProps) {
  const filteredCategories = ticketCategories.filter(item =>
    item.name.toLowerCase().includes(ticketCategorySearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(ticketCategorySearch.toLowerCase()))
  )

  return (
    <div className="space-y-3">
      {/* Ticket Kategorileri */}
      <Subsection title="Ticket Kategorileri" icon={Tag} count={ticketCategories.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            IT destek taleplerini kategorize etmek için etiketler oluşturun (örn: Donanım, Yazılım, Ağ, Erişim İzni).
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Kategori adı *"
                value={newTicketCategory.name}
                onChange={(e) => setNewTicketCategory({ ...newTicketCategory, name: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={newTicketCategory.color}
                onChange={(e) => setNewTicketCategory({ ...newTicketCategory, color: e.target.value })}
                className="w-9 h-9 rounded cursor-pointer border"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Açıklama (isteğe bağlı)"
                value={newTicketCategory.description}
                onChange={(e) => setNewTicketCategory({ ...newTicketCategory, description: e.target.value })}
                className="flex-1"
              />
              <select
                value={newTicketCategory.defaultPriority}
                onChange={(e) => setNewTicketCategory({ ...newTicketCategory, defaultPriority: e.target.value })}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="TICKET_LOW">Düşük</option>
                <option value="NORMAL">Normal</option>
                <option value="TICKET_HIGH">Yüksek</option>
                <option value="TICKET_CRITICAL">Kritik</option>
              </select>
              <Button
                onClick={onAddCategory}
                disabled={addingTicketCategory || !newTicketCategory.name}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ekle
              </Button>
            </div>
          </div>
        </div>
        <div className="p-3 border-b bg-background">
          <Input
            placeholder="Kategori ara..."
            value={ticketCategorySearch}
            onChange={(e) => setTicketCategorySearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {filteredCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {ticketCategorySearch ? "Sonuç bulunamadı" : "Henüz kategori eklenmemiş"}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredCategories.map((cat) => {
                const priorityBadge = getPriorityBadge(cat.defaultPriority)
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      />
                      <div>
                        <span className="text-sm font-medium">{cat.name}</span>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground">{cat.description}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityBadge.color}`}>
                        {priorityBadge.label}
                      </span>
                      {cat._count && cat._count.tickets > 0 && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {cat._count.tickets} ticket
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteCategory(cat.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Subsection>

      {/* Talep Tipleri */}
      <Subsection title="Talep Tipleri" icon={Layers} count={4}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground">
            ITIL standartlarına uygun talep tipleri. Bu tipler sistem tarafından tanımlıdır.
          </p>
        </div>
        <div className="p-3">
          <div className="space-y-2">
            {/* INCIDENT */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div>
                  <span className="text-sm font-medium">Olay (Incident)</span>
                  <p className="text-xs text-muted-foreground">Hizmet kesintisi veya kalite düşüşü</p>
                </div>
              </div>
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">INCIDENT</span>
            </div>

            {/* SERVICE_REQUEST */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div>
                  <span className="text-sm font-medium">Hizmet Talebi (Service Request)</span>
                  <p className="text-xs text-muted-foreground">Standart hizmet talepleri (yazılım kurulumu, erişim izni vb.)</p>
                </div>
              </div>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">SERVICE_REQUEST</span>
            </div>

            {/* PROBLEM */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div>
                  <span className="text-sm font-medium">Problem</span>
                  <p className="text-xs text-muted-foreground">Tekrarlayan olayların kök neden analizi</p>
                </div>
              </div>
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">PROBLEM</span>
            </div>

            {/* CHANGE_REQUEST */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <div>
                  <span className="text-sm font-medium">Değişiklik Talebi (Change Request)</span>
                  <p className="text-xs text-muted-foreground">Sistem veya altyapı değişiklik talepleri</p>
                </div>
              </div>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">CHANGE_REQUEST</span>
            </div>
          </div>
        </div>
      </Subsection>
    </div>
  )
}
