import { cn } from '@/lib/utils';

const tones: Record<string, string> = {
  NORMAL: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  AVAILABLE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  VERIFIED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ONLINE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  HIGH: 'bg-orange-50 text-orange-800 ring-orange-200',
  WARNING: 'bg-orange-50 text-orange-800 ring-orange-200',
  PENDING: 'bg-orange-50 text-orange-800 ring-orange-200',
  ASSIGNED: 'bg-sky-50 text-sky-800 ring-sky-200',
  ACTIVE: 'bg-sky-50 text-sky-800 ring-sky-200',
  COLLECTING: 'bg-sky-50 text-sky-800 ring-sky-200',
  CRITICAL: 'bg-red-50 text-red-800 ring-red-200',
  REJECTED: 'bg-red-50 text-red-800 ring-red-200',
  OFFLINE: 'bg-slate-100 text-slate-700 ring-slate-200',
  MAINTENANCE: 'bg-slate-100 text-slate-700 ring-slate-200',
  CANCELLED: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset', tones[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200', className)}><span className="size-1.5 rounded-full bg-current" />{status.replaceAll('_', ' ')}</span>;
}

