'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export function Modal({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] grid place-items-end bg-black/45 p-0 md:place-items-center md:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl bg-card shadow-xl md:max-w-2xl md:rounded-xl"><header className="flex items-start justify-between gap-4 border-b p-5"><div><h2 id="modal-title" className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div><Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose}><X /></Button></header><div className="overflow-y-auto p-5">{children}</div>{footer && <footer className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 p-4">{footer}</footer>}</section></div>;
}

