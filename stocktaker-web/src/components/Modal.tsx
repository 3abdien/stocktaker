// A tiny, reusable modal shell. Every "New Item", "Check In/Out",
// "Resolve report" dialog in this app is <Modal> wrapping a <form> - the
// modal itself knows nothing about what's inside it, which is what makes
// it reusable instead of writing five near-identical popups.

import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    // Clicking the dark backdrop closes the modal; clicking inside it
    // must NOT close it, so we stop the click from bubbling up to the
    // backdrop's own handler.
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}
