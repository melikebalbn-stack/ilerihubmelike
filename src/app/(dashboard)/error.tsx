"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <h2 className="text-xl font-semibold">Bir hata olustu</h2>
      <p className="text-muted-foreground text-center max-w-md">
        {error.message || "Sayfa yuklenirken beklenmeyen bir hata olustu."}
      </p>
      <pre className="text-xs text-muted-foreground bg-muted p-3 rounded max-w-lg overflow-auto max-h-40">
        {error.stack?.slice(0, 500)}
      </pre>
      <Button onClick={reset}>Tekrar Dene</Button>
    </div>
  )
}
