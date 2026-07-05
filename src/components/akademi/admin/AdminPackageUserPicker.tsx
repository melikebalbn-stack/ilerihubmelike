"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface UserAssignment {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  assignedAt: string;
}

interface Props {
  packageId: string;
  assignments: UserAssignment[];
  onSaved: () => void;
}

interface UserSearchResult {
  id: string;
  name: string | null;
  email: string | null;
  department: string | null;
}

export function AdminPackageUserPicker({
  packageId,
  assignments,
  onSaved,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(
      `/api/akademi/admin/users?search=${encodeURIComponent(q)}`
    );
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.users ?? []);
    }
  }, []);

  const addUser = async (user: UserSearchResult) => {
    if (assignments.find((a) => a.userId === user.id)) {
      toast.error("Bu kullanıcı zaten atanmış");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/packages/${packageId}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: [user.id], dueDate: dueDate || null }),
        }
      );
      if (!res.ok) throw new Error("add failed");
      toast.success(`${user.name ?? user.email} eklendi`);
      setPickerOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      setDueDate("");
      onSaved();
    } catch {
      toast.error("Eklenemedi");
    } finally {
      setAdding(false);
    }
  };

  const removeUser = async (assignment: UserAssignment) => {
    if (
      !confirm(
        `${assignment.userName ?? assignment.userEmail} pakettan çıkarılacak. Devam edilsin mi?`
      )
    )
      return;
    try {
      const res = await fetch(
        `/api/akademi/admin/packages/${packageId}/users/${assignment.userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("remove failed");
      toast.success("Kullanıcı kaldırıldı");
      onSaved();
    } catch {
      toast.error("Kaldırılamadı");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Bölüm dışında bireysel olarak pakete eklenecek kullanıcılar.
        </p>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Kullanıcı Ekle
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Bireysel atama yok.
        </div>
      ) : (
        <div className="ak-card-static p-3">
          <div className="space-y-1">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--ak-surface-2)]"
              >
                <div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {a.userName ?? a.userEmail}
                  </div>
                  {a.userEmail && a.userName && (
                    <div
                      className="text-xs"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {a.userEmail}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeUser(a)}
                  className="p-1.5 rounded-md hover:bg-red-500/10"
                  style={{ color: "var(--ak-text-secondary)" }}
                  aria-label="Kaldır"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kullanıcı Seç</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-user-due">Son Tarih (opsiyonel)</Label>
            <Input
              id="pkg-user-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            <p className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
              Boş = süresiz. Seçili tarih, eklenen kullanıcının paket
              atamalarına uygulanır (yalnızca öne çeker, uzatmaz).
            </p>
          </div>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="İsim veya email ile ara (en az 2 karakter)..."
              value={searchQuery}
              onValueChange={(v) => {
                setSearchQuery(v);
                searchUsers(v);
              }}
            />
            <CommandList>
              <CommandEmpty>
                {searchQuery.length < 2
                  ? "Aramaya başlayın"
                  : "Kullanıcı bulunamadı"}
              </CommandEmpty>
              <CommandGroup>
                {searchResults.map((u) => (
                  <CommandItem
                    key={u.id}
                    onSelect={() => !adding && addUser(u)}
                    value={u.name ?? u.email ?? u.id}
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {u.name ?? u.email}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--ak-text-tertiary)" }}
                      >
                        {u.department ?? "Bölümsüz"} • {u.email}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
