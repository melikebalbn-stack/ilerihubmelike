"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Users, Trash2 } from "lucide-react"
import { Subsection } from "../CollapsibleSection"
import type { SuggestionBoardMember } from "@/types/settings"

interface SuggestionSettingsPanelProps {
  boardMembers: SuggestionBoardMember[]
  newBoardMember: {
    email: string
    name: string
    department: string
    role: string
  }
  setNewBoardMember: (member: { email: string; name: string; department: string; role: string }) => void
  addingBoardMember: boolean
  boardMemberSearch: string
  setBoardMemberSearch: (search: string) => void
  onAddMember: () => void
  onDeleteMember: (id: string) => void
}

export function SuggestionSettingsPanel({
  boardMembers,
  newBoardMember,
  setNewBoardMember,
  addingBoardMember,
  boardMemberSearch,
  setBoardMemberSearch,
  onAddMember,
  onDeleteMember
}: SuggestionSettingsPanelProps) {
  const filteredMembers = boardMembers.filter(member =>
    member.name.toLowerCase().includes(boardMemberSearch.toLowerCase()) ||
    member.email.toLowerCase().includes(boardMemberSearch.toLowerCase()) ||
    (member.department && member.department.toLowerCase().includes(boardMemberSearch.toLowerCase()))
  )

  return (
    <div className="space-y-3">
      {/* Öneri Kurulu Üyeleri */}
      <Subsection title="Öneri Kurulu Üyeleri" icon={Users} count={boardMembers.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Öneri Kurulu, departman yöneticilerinin onayladığı önerileri değerlendirir ve son kararı verir.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="E-posta adresi *"
                value={newBoardMember.email}
                onChange={(e) => setNewBoardMember({ ...newBoardMember, email: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Ad Soyad *"
                value={newBoardMember.name}
                onChange={(e) => setNewBoardMember({ ...newBoardMember, name: e.target.value })}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Departman"
                value={newBoardMember.department}
                onChange={(e) => setNewBoardMember({ ...newBoardMember, department: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Rol (Başkan, Üye, vb.)"
                value={newBoardMember.role}
                onChange={(e) => setNewBoardMember({ ...newBoardMember, role: e.target.value })}
                className="flex-1"
              />
              <Button
                onClick={onAddMember}
                disabled={addingBoardMember || !newBoardMember.email || !newBoardMember.name}
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
            placeholder="Üye ara..."
            value={boardMemberSearch}
            onChange={(e) => setBoardMemberSearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {boardMemberSearch ? "Sonuç bulunamadı" : "Henüz Öneri Kurulu üyesi eklenmemiş"}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{member.name}</span>
                        {member.role && (
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                            {member.role}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                      {member.department && (
                        <p className="text-xs text-muted-foreground">{member.department}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteMember(member.id)}
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
