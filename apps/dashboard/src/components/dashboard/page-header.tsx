import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div>{eyebrow && <p className="mb-1 text-xs font-bold tracking-[0.08em] text-primary uppercase">{eyebrow}</p>}<h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p></div>{actions && <div className="no-print flex shrink-0 flex-wrap gap-2">{actions}</div>}</div>;
}

