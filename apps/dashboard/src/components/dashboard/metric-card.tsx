import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function MetricCard({ label, value, detail, icon: Icon, tone = 'default' }: { label: string; value: string | number; detail?: string; icon: LucideIcon; tone?: 'default' | 'critical' | 'positive' }) {
  return <Card className={cn(tone === 'critical' && 'ring-red-200', tone === 'positive' && 'ring-emerald-200')}><CardContent><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{label}</p><p className={cn('mt-2 text-2xl font-bold data-mono', tone === 'critical' && 'text-destructive', tone === 'positive' && 'text-primary')}>{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div><span className={cn('grid size-9 place-items-center rounded-lg bg-muted text-secondary', tone === 'critical' && 'bg-red-50 text-destructive', tone === 'positive' && 'bg-emerald-50 text-primary')}><Icon className="size-4" /></span></div></CardContent></Card>;
}

