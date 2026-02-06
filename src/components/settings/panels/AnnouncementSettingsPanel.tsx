"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Tag, ClipboardList, Eye, BarChart3, Calendar, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Subsection } from "../CollapsibleSection"
import { SettingsList, ColorBadge } from "../SettingsList"
import type { AnnouncementCategory, Survey } from "@/types/settings"

interface AnnouncementSettingsPanelProps {
  categories: AnnouncementCategory[]
  surveys: Survey[]
  newCategory: { name: string; color: string }
  setNewCategory: (cat: { name: string; color: string }) => void
  addingCategory: boolean
  categorySearch: string
  setCategorySearch: (search: string) => void
  surveySearch: string
  setSurveySearch: (search: string) => void
  onAddCategory: () => void
  onDeleteCategory: (id: string) => void
  onDeleteSurvey: (id: string) => void
}

const getSurveyStatusBadge = (status: string) => {
  switch (status) {
    case 'DRAFT': return { label: 'Taslak', color: 'bg-gray-100 text-gray-800' }
    case 'ACTIVE': return { label: 'Aktif', color: 'bg-green-100 text-green-800' }
    case 'CLOSED': return { label: 'Kapalı', color: 'bg-red-100 text-red-800' }
    case 'ARCHIVED': return { label: 'Arşivlendi', color: 'bg-purple-100 text-purple-800' }
    default: return { label: status, color: 'bg-gray-100 text-gray-800' }
  }
}

const getSurveyTypeBadge = (type: string) => {
  switch (type) {
    case 'POLL': return { label: 'Oylama', color: 'bg-blue-100 text-blue-800' }
    case 'FEEDBACK': return { label: 'Geri Bildirim', color: 'bg-amber-100 text-amber-800' }
    case 'QUESTIONNAIRE': return { label: 'Anket', color: 'bg-indigo-100 text-indigo-800' }
    default: return { label: type, color: 'bg-gray-100 text-gray-800' }
  }
}

export function AnnouncementSettingsPanel({
  categories,
  surveys,
  newCategory,
  setNewCategory,
  addingCategory,
  categorySearch,
  setCategorySearch,
  surveySearch,
  setSurveySearch,
  onAddCategory,
  onDeleteCategory,
  onDeleteSurvey
}: AnnouncementSettingsPanelProps) {
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  )

  const filteredSurveys = surveys.filter(s =>
    s.title.toLowerCase().includes(surveySearch.toLowerCase()) ||
    s.surveyNumber.toLowerCase().includes(surveySearch.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(surveySearch.toLowerCase()))
  )

  return (
    <div className="space-y-3">
      {/* Duyuru Kategorileri */}
      <Subsection title="Duyuru Kategorileri" icon={Tag} count={categories.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Duyuruları kategorize etmek için etiketler oluşturun (örn: Genel, İK, IT, Kalite).
          </p>
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
            <Button onClick={onAddCategory} disabled={addingCategory || !newCategory.name} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Ekle
            </Button>
          </div>
        </div>
        <SettingsList
          items={filteredCategories}
          searchValue={categorySearch}
          onSearchChange={setCategorySearch}
          searchPlaceholder="Kategori ara..."
          emptyMessage="Henüz kategori eklenmemiş"
          getItemId={(cat) => cat.id}
          onDelete={onDeleteCategory}
          renderItem={(cat) => (
            <ColorBadge
              color={cat.color}
              name={cat.name}
              count={cat._count?.announcements}
              countLabel="duyuru"
            />
          )}
        />
      </Subsection>

      {/* Anketler */}
      <Subsection title="Anketler" icon={ClipboardList} count={surveys.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Sistemdeki tüm anketleri görüntüleyin ve yönetin.{' '}
            <Link href="/announcements/manage" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              Yeni anket oluşturmak için tıklayın
            </Link>
          </p>
        </div>
        <SettingsList
          items={filteredSurveys}
          searchValue={surveySearch}
          onSearchChange={setSurveySearch}
          searchPlaceholder="Anket ara..."
          emptyMessage="Henüz anket oluşturulmamış"
          getItemId={(s) => s.id}
          onDelete={onDeleteSurvey}
          renderItem={(survey) => {
            const statusBadge = getSurveyStatusBadge(survey.status)
            const typeBadge = getSurveyTypeBadge(survey.surveyType)
            return (
              <div className="py-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{survey.surveyNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadge.color}`}>
                    {typeBadge.label}
                  </span>
                  {survey.isAnonymous && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                      Anonim
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium truncate">{survey.title}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" />
                    {survey._count.questions} soru
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {survey._count.responses} yanıt
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(survey.createdAt).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </div>
            )
          }}
        />
      </Subsection>
    </div>
  )
}
