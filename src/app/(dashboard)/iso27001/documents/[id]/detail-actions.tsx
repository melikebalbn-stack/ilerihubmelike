"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FileUp, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { NewVersionModal } from "@/components/iso27001/NewVersionModal"

interface DocumentDetailActionsProps {
  documentId: string
  documentNumber: string
  title: string
  version: string
  fileName: string
  canManage: boolean
}

export function DocumentDetailActions({
  documentId,
  documentNumber,
  title,
  version,
  fileName,
  canManage,
}: DocumentDetailActionsProps) {
  const router = useRouter()
  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!canManage) return null

  const handleDelete = async () => {
    if (!confirm("Bu dokümanı silmek istediğinizden emin misiniz?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/iso27001/documents/${documentId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Silinemedi")
        return
      }
      toast.success("Doküman silindi")
      router.push("/iso27001/documents")
      router.refresh()
    } catch (e) {
      console.error("Silme hatası:", e)
      toast.error("Silme sırasında hata oluştu")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex gap-2 shrink-0">
        <Button onClick={() => setVersionModalOpen(true)}>
          <FileUp className="h-4 w-4 mr-2" />
          Yeni Versiyon Yükle
        </Button>
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Sil
        </Button>
      </div>

      <NewVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        document={{ id: documentId, documentNumber, title, version, fileName }}
        onSuccess={() => {
          router.refresh()
        }}
      />
    </>
  )
}
