import type { ReactNode } from 'react'
// @ts-expect-error react-dom is installed without @types/react-dom
import { createPortal } from 'react-dom'

export function ConfettiHost({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return children
  return createPortal(children, document.body)
}
