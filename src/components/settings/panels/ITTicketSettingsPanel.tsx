"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Tag, Layers, Trash2, Users, X, Crown, UserCheck } from "lucide-react"
import { Subsection } from "../CollapsibleSection"
import type { TicketCategory, TicketTeam, AssignableUser } from "@/types/settings"

interface ITTicketSettingsPanelProps {
  ticketCategories: TicketCategory[]
  newTicketCategory: {
    name: string
    description: string
    color: string
    defaultPriority: string
    defaultTeamId: string
    defaultAssigneeEmail: string
  }
  setNewTicketCategory: (cat: { name: string; description: string; color: string; defaultPriority: string; defaultTeamId: string; defaultAssigneeEmail: string }) => void
  addingTicketCategory: boolean
  ticketCategorySearch: string
  setTicketCategorySearch: (search: string) => void
  onAddCategory: () => void
  onDeleteCategory: (id: string) => void
  /** Mevcut kategoriyi bir takıma bağla / bağı kaldır (PUT ?id=) */
  onUpdateCategoryTeam: (id: string, teamId: string | null) => void
  /** Mevcut kategoriyi bir KİŞİYE ata / atamayı kaldır (PUT ?id=) */
  onUpdateCategoryAssignee: (id: string, email: string | null) => void

  // ── IT Takımları (Faz 1: takım verisi + CRUD; ticket akışı Faz 2-4) ──
  ticketTeams: TicketTeam[]
  assignableUsers: AssignableUser[]
  newTicketTeam: { name: string; description: string; memberEmails: string[] }
  setNewTicketTeam: (team: { name: string; description: string; memberEmails: string[] }) => void
  addingTicketTeam: boolean
  onAddTeam: () => void
  onDeleteTeam: (id: string) => void
  /** Üye ekle/çıkar → PUT (members tam liste olarak gönderilir) */
  onUpdateTeamMembers: (id: string, memberEmails: string[]) => void
  /** Ekip lideri ata/kaldır → PUT */
  onSetTeamLead: (id: string, email: string | null) => void
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
  onDeleteCategory,
  onUpdateCategoryTeam,
  onUpdateCategoryAssignee,
  ticketTeams,
  assignableUsers,
  newTicketTeam,
  setNewTicketTeam,
  addingTicketTeam,
  onAddTeam,
  onDeleteTeam,
  onUpdateTeamMembers,
  onSetTeamLead,
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
              {/* Havuz: kategori bir takıma bağlanırsa ticket o takıma düşer */}
              <select
                value={newTicketCategory.defaultTeamId}
                onChange={(e) => setNewTicketCategory({ ...newTicketCategory, defaultTeamId: e.target.value })}
                className="h-9 px-3 rounded-md border bg-background text-sm"
                title="Bu kategoride açılan ticket hangi takıma düşsün?"
              >
                <option value="">Takım yok</option>
                {ticketTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {/* Tek kişi: takım seçilmediyse ticket doğrudan bu kişiye atanır.
                  İkisi de seçilirse create'te TAKIM önceliklidir. */}
              <select
                value={newTicketCategory.defaultAssigneeEmail}
                onChange={(e) => setNewTicketCategory({ ...newTicketCategory, defaultAssigneeEmail: e.target.value })}
                className="h-9 px-3 rounded-md border bg-background text-sm"
                title="Takım yoksa ticket doğrudan bu kişiye atansın"
              >
                <option value="">Kişi yok</option>
                {assignableUsers.map((u) => (
                  <option key={u.email} value={u.email}>{u.name}</option>
                ))}
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
                      {/* Bu kategoride açılan ticket KİME gidiyor — tek bakışta.
                          Takım varsa havuza düşer (takım > kişi önceliği), yoksa kişiye
                          atanır, ikisi de yoksa sahipsiz kalır. */}
                      {(() => {
                        const takim = ticketTeams.find((t) => t.id === cat.defaultTeamId)
                        if (takim) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              <Users className="h-3 w-3" />
                              {takim.name} havuzu
                            </span>
                          )
                        }
                        if (cat.defaultAssigneeEmail) {
                          const kisi = assignableUsers.find((u) => u.email === cat.defaultAssigneeEmail)
                          return (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                              <UserCheck className="h-3 w-3" />
                              {kisi?.name ?? cat.defaultAssigneeEmail}
                            </span>
                          )
                        }
                        return (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            sahipsiz
                          </span>
                        )
                      })()}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Mevcut kategoriyi takıma bağla — asıl ihtiyaç bu:
                          kategoriler zaten var, takım bağı sonradan kuruluyor. */}
                      <select
                        value={cat.defaultTeamId ?? ""}
                        onChange={(e) => onUpdateCategoryTeam(cat.id, e.target.value || null)}
                        className="h-8 px-2 rounded-md border bg-background text-xs max-w-[11rem]"
                        title="Bu kategoride açılan ticket hangi takıma düşsün?"
                      >
                        <option value="">Takım yok</option>
                        {ticketTeams.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {/* Tek kişi ataması. DİKKAT: mevcut deger assignableUsers'ta
                          olmayabilir (ör. super-admin rolündeki biri SQL ile atanmışsa)
                          — o durumda e-posta ayrı bir seçenek olarak eklenir ki
                          seçici boş görünüp atamayı gizlemesin. */}
                      <select
                        value={cat.defaultAssigneeEmail ?? ""}
                        onChange={(e) => onUpdateCategoryAssignee(cat.id, e.target.value || null)}
                        className="h-8 px-2 rounded-md border bg-background text-xs max-w-[11rem]"
                        title="Takım yoksa ticket doğrudan bu kişiye atansın"
                      >
                        <option value="">Kişi yok</option>
                        {assignableUsers.map((u) => (
                          <option key={u.email} value={u.email}>{u.name}</option>
                        ))}
                        {cat.defaultAssigneeEmail &&
                          !assignableUsers.some((u) => u.email === cat.defaultAssigneeEmail) && (
                            <option value={cat.defaultAssigneeEmail}>
                              {cat.defaultAssigneeEmail} (liste dışı)
                            </option>
                          )}
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteCategory(cat.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Subsection>

      {/* IT Takımları — HAVUZ modeli: ticket takıma düşer, üyelerden biri
          devralana kadar havuzda kalır. Faz 1'de yalnız takım/üye verisi
          yönetilir; ticket akışı (havuz ataması, görünürlük, kapatma, bildirim)
          Faz 2-4'te eklenecek. */}
      <Subsection title="IT Takımları" icon={Users} count={ticketTeams.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Ticket&apos;ın tek kişi yerine bir ekibe düşmesi için takım tanımlayın (örn: IFS/ERP Ekibi).
            Üyeler yalnız IT ekibi kullanıcıları arasından seçilir.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Takım adı *"
                value={newTicketTeam.name}
                onChange={(e) => setNewTicketTeam({ ...newTicketTeam, name: e.target.value })}
                className="flex-1"
              />
              <Button
                onClick={onAddTeam}
                disabled={addingTicketTeam || !newTicketTeam.name.trim()}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ekle
              </Button>
            </div>
            <Input
              placeholder="Açıklama (isteğe bağlı)"
              value={newTicketTeam.description}
              onChange={(e) => setNewTicketTeam({ ...newTicketTeam, description: e.target.value })}
            />
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground mb-1.5">Üyeler</p>
              {assignableUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">Atanabilir IT kullanıcısı bulunamadı.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {assignableUsers.map((u) => {
                    const secili = newTicketTeam.memberEmails.includes(u.email)
                    return (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() =>
                          setNewTicketTeam({
                            ...newTicketTeam,
                            memberEmails: secili
                              ? newTicketTeam.memberEmails.filter((e) => e !== u.email)
                              : [...newTicketTeam.memberEmails, u.email],
                          })
                        }
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          secili
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-accent"
                        }`}
                        title={u.email}
                      >
                        {u.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-3 max-h-72 overflow-y-auto">
          {ticketTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Henüz takım eklenmemiş</p>
          ) : (
            <div className="space-y-2">
              {ticketTeams.map((team) => {
                const uyeEmails = team.members.map((m) => m.email)
                const eklenebilir = assignableUsers.filter((u) => !uyeEmails.includes(u.email))
                return (
                  <div key={team.id} className="rounded-lg border bg-background p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{team.name}</span>
                        {team.description && (
                          <p className="text-xs text-muted-foreground">{team.description}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {team.members.length} üye
                          </span>
                          {team._count && team._count.categories > 0 && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              {team._count.categories} kategori
                            </span>
                          )}
                          {team._count && team._count.tickets > 0 && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              {team._count.tickets} ticket
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteTeam(team.id)}
                        className="h-8 w-8 p-0 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                        title="Takımı sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Üye rozetleri — çıkarma (×) + lider atama (taç) */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {team.members.map((m) => {
                        const lider = team.leadEmail === m.email
                        return (
                          <span
                            key={m.email}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                              lider ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-background"
                            }`}
                            title={m.email}
                          >
                            <button
                              type="button"
                              onClick={() => onSetTeamLead(team.id, lider ? null : m.email)}
                              title={lider ? "Ekip liderliğini kaldır" : "Ekip lideri yap"}
                              className="hover:text-amber-600"
                            >
                              <Crown className={`h-3 w-3 ${lider ? "fill-amber-400" : ""}`} />
                            </button>
                            {m.name}
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTeamMembers(
                                  team.id,
                                  uyeEmails.filter((e) => e !== m.email),
                                )
                              }
                              title="Üyeyi çıkar"
                              className="hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      })}
                      {team.members.length === 0 && (
                        <span className="text-xs text-muted-foreground">Üye yok</span>
                      )}
                    </div>

                    {/* Üye ekleme */}
                    {eklenebilir.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return
                          onUpdateTeamMembers(team.id, [...uyeEmails, e.target.value])
                        }}
                        className="mt-2 h-8 px-2 rounded-md border bg-background text-xs"
                      >
                        <option value="">+ Üye ekle…</option>
                        {eklenebilir.map((u) => (
                          <option key={u.email} value={u.email}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    )}
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
