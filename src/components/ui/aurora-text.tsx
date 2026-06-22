"use client"

import { cn } from "@/lib/utils"

interface AuroraTextProps {
  className?: string
  children: React.ReactNode
}

export function AuroraText({ className, children }: AuroraTextProps) {
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <span
        className="pointer-events-none absolute inset-0 z-10 animate-aurora-text bg-aurora bg-[length:200%_auto] bg-clip-text text-transparent"
        aria-hidden="true"
      >
        {children}
      </span>
      <span className="pointer-events-none opacity-0">{children}</span>
    </span>
  )
}
