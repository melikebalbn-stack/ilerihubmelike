'use client'

// PR-JOBAPP-RENDERER: Koşullu alan wrapper. when=true ise children render edilir,
// false ise null. Conditional state cleanup orchestrator'a bırakılır (renderer
// gizli alanın değerini submit'ten önce null'lar veya gönderilmez kabul eder).

import { ReactNode } from 'react'

interface Props {
  when: boolean
  children: ReactNode
}

export function FormConditionalField({ when, children }: Props) {
  if (!when) return null
  return <>{children}</>
}
