import { cn } from '@/lib/utils';

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const normalized = Math.max(0, Math.min(100, value));
  const tone = normalized > 90 ? 'bg-[#c0392b]' : normalized > 75 ? 'bg-[#d35400]' : normalized > 50 ? 'bg-[#e8873c]' : 'bg-primary';
  return <div className={cn('h-2 overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(normalized)} aria-valuemin={0} aria-valuemax={100}><div className={cn('h-full rounded-full transition-[width]', tone)} style={{ width: `${normalized}%` }} /></div>;
}

