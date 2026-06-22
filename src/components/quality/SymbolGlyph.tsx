import { cn } from '@/lib/utils'

/**
 * GD&T sembol görsel render helper'ı. svgContent alanı bir <svg> elementinin
 * iç içeriği (path/line/circle) olarak saklanır ve burada sabit 24x24 viewBox
 * içine mount edilir. currentColor kullandığı için parent text rengiyle renklenir.
 *
 * Server ve client component'lerde aynen kullanılabilir (sadece JSX).
 */
export function SymbolGlyph({
  svg,
  className,
}: {
  svg: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('text-current', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
