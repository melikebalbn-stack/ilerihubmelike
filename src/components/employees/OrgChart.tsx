'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, Maximize2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface OrgNode {
  id: string
  name: string
  title: string | null
  department: string | null
  email: string | null
  children: OrgNode[]
}

interface OrgChartProps {
  tree: OrgNode[]
  className?: string
}

// Avatar renkleri
const avatarColors = [
  'bg-blue-100 text-blue-600 border-blue-200',
  'bg-green-100 text-green-600 border-green-200',
  'bg-purple-100 text-purple-600 border-purple-200',
  'bg-orange-100 text-orange-600 border-orange-200',
  'bg-pink-100 text-pink-600 border-pink-200',
  'bg-teal-100 text-teal-600 border-teal-200',
  'bg-indigo-100 text-indigo-600 border-indigo-200',
  'bg-rose-100 text-rose-600 border-rose-200',
]

function getAvatarColor(name: string): string {
  const charCode = name.charCodeAt(0) || 0
  return avatarColors[charCode % avatarColors.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Tek düğüm bileşeni
function OrgNodeComponent({
  node,
  level = 0,
  isLast = false,
}: {
  node: OrgNode
  level?: number
  isLast?: boolean
}) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasChildren = node.children.length > 0

  return (
    <div className="flex flex-col items-center">
      {/* Düğüm */}
      <div className="relative">
        {/* Üst çizgi */}
        {level > 0 && (
          <div className="absolute -top-6 left-1/2 w-px h-6 bg-border" />
        )}

        {/* Düğüm kartı */}
        <div
          className={cn(
            'group relative flex flex-col items-center rounded-xl border-2 bg-card p-4 shadow-sm transition-all hover:shadow-md min-w-[160px]',
            hasChildren ? 'cursor-pointer' : '',
            level === 0 && 'border-primary/50 bg-primary/5'
          )}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          {/* Avatar */}
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold border-2',
              getAvatarColor(node.name)
            )}
          >
            {getInitials(node.name)}
          </div>

          {/* İsim */}
          <Link
            href={`/employees/${node.id}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 text-sm font-semibold text-center hover:text-primary transition-colors"
          >
            {node.name}
          </Link>

          {/* Unvan */}
          {node.title && (
            <p className="text-xs text-muted-foreground text-center mt-1 max-w-[140px] truncate">
              {node.title}
            </p>
          )}

          {/* Departman */}
          {node.department && level === 0 && (
            <p className="text-xs text-primary/70 text-center mt-1">
              {node.department}
            </p>
          )}

          {/* Expand/Collapse butonu */}
          {hasChildren && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full border bg-card shadow-sm">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          )}

          {/* Çocuk sayısı badge */}
          {hasChildren && !expanded && (
            <div className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {node.children.length}
            </div>
          )}
        </div>
      </div>

      {/* Çocuklar */}
      {hasChildren && expanded && (
        <div className="mt-6 relative">
          {/* Yatay çizgi */}
          {node.children.length > 1 && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border"
              style={{
                width: `calc(100% - ${160 / node.children.length}px)`,
              }}
            />
          )}

          {/* Dikey çizgi (ortadaki) */}
          <div className="absolute top-0 left-1/2 w-px h-6 bg-border -translate-x-1/2" />

          {/* Çocuk düğümleri */}
          <div className="flex gap-8 pt-6">
            {node.children.map((child, index) => (
              <OrgNodeComponent
                key={child.id}
                node={child}
                level={level + 1}
                isLast={index === node.children.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function OrgChart({ tree, className }: OrgChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 2))
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.3))
  const handleReset = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setScale((s) => Math.min(Math.max(s + delta, 0.3), 2))
    }
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">Organizasyon şeması bulunamadı</p>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* Kontroller */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomOut} title="Uzaklaştır">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomIn} title="Yakınlaştır">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleReset} title="Sıfırla">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Ölçek göstergesi */}
      <div className="absolute bottom-4 left-4 z-10 text-sm text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {Math.round(scale * 100)}%
      </div>

      {/* Ağaç container */}
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing bg-muted/20 rounded-lg border"
        style={{ height: '600px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="inline-flex p-8 transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <div className="flex gap-12">
            {tree.map((node) => (
              <OrgNodeComponent key={node.id} node={node} level={0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
