'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface RoleEditDialogProps {
  role: {
    id: string
    slug: string
    name: string
    description: string | null
    isSystem: boolean
  }
  trigger: React.ReactNode
}

export function RoleEditDialog({ role, trigger }: RoleEditDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function reset() {
    setName(role.name)
    setDescription(role.description ?? '')
    setErrorMsg(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  const trimmedName = name.trim()
  const dirty =
    trimmedName !== role.name ||
    (description.trim() || null) !== (role.description ?? null)
  const valid = trimmedName.length >= 2 && trimmedName.length <= 100

  async function handleSubmit() {
    if (!valid || !dirty) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Güncelleme başarısız')
        return
      }
      toast.success('Rol güncellendi')
      setOpen(false)
      router.refresh()
    } catch {
      setErrorMsg('Sunucuya ulaşılamadı')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rol düzenle</DialogTitle>
          <DialogDescription>
            Sadece ad ve açıklama düzenlenebilir. Anahtar (slug) ve sistem rol
            durumu korunur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-slug">Anahtar</Label>
            <Input
              id="role-slug"
              value={role.slug}
              disabled
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {role.isSystem
                ? 'Sistem rollerinin anahtarı değiştirilemez'
                : 'Anahtar oluşturulduktan sonra değiştirilemez'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-name">
              Rol adı <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">2-100 karakter</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-description">Açıklama</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Bu rolün amacı ve kapsamı..."
            />
            <p className="text-xs text-muted-foreground">
              {description.length} / 500 karakter
            </p>
          </div>

          {errorMsg && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {errorMsg}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !valid || !dirty}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
