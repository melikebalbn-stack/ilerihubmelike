"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Tag, Mail, Trash2 } from "lucide-react"
import { Subsection } from "../CollapsibleSection"
import { ColorBadge } from "../SettingsList"
import type { TaskCategory, NotificationEmail } from "@/types/settings"

interface TaskSettingsPanelProps {
  categories: TaskCategory[]
  notificationEmails: NotificationEmail[]
  newCategory: {
    name: string
    description: string
    color: string
  }
  setNewCategory: (cat: { name: string; description: string; color: string }) => void
  addingCategory: boolean
  categorySearch: string
  setCategorySearch: (search: string) => void
  newEmail: string
  setNewEmail: (email: string) => void
  addingEmail: boolean
  onAddCategory: () => void
  onDeleteCategory: (id: string) => void
  onAddEmail: () => void
  onDeleteEmail: (id: string) => void
}

export function TaskSettingsPanel({
  categories,
  notificationEmails,
  newCategory,
  setNewCategory,
  addingCategory,
  categorySearch,
  setCategorySearch,
  newEmail,
  setNewEmail,
  addingEmail,
  onAddCategory,
  onDeleteCategory,
  onAddEmail,
  onDeleteEmail
}: TaskSettingsPanelProps) {
  const filteredCategories = categories.filter(item =>
    item.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(categorySearch.toLowerCase()))
  )

  return (
    <div className="space-y-3">
      {/* Görev Kategorileri */}
      <Subsection title="Görev Kategorileri" icon={Tag} count={categories.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Görevleri gruplamak için kategoriler oluşturun (örn: Sertifikasyonlar, Yasal Denetimler, Bakım).
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Kategori adı *"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="w-9 h-9 rounded cursor-pointer border"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Açıklama (opsiyonel)"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                className="flex-1"
              />
              <Button
                onClick={onAddCategory}
                disabled={addingCategory || !newCategory.name}
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
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {filteredCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {categorySearch ? "Sonuç bulunamadı" : "Henüz kategori eklenmemiş"}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredCategories.map((cat) => (
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
                    {cat._count && cat._count.tasks > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {cat._count.tasks} görev
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
              ))}
            </div>
          )}
        </div>
      </Subsection>

      {/* Bildirim E-postaları */}
      <Subsection title="Bildirim E-postaları" icon={Mail} count={notificationEmails.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Tüm görev bildirimlerinin gönderileceği e-posta adresleri. Bu adresler her görev oluşturulduğunda otomatik olarak bilgilendirilir.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="E-posta adresi"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddEmail()
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={onAddEmail}
              disabled={addingEmail || !newEmail}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ekle
            </Button>
          </div>
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {notificationEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Henüz bildirim e-postası eklenmemiş
            </p>
          ) : (
            <div className="space-y-2">
              {notificationEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{email.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEmail(email.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Subsection>
    </div>
  )
}
