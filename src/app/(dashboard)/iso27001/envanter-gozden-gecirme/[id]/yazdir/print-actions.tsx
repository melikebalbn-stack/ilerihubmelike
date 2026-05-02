"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export default function PrintActions() {
  return (
    <div
      className="print-actions"
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: 9999,
      }}
    >
      <Button onClick={() => window.print()} size="sm">
        <Printer className="h-4 w-4 mr-2" />
        Yazdır / PDF Olarak Kaydet
      </Button>
    </div>
  )
}
