'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Bell, Building2, ChevronRight, CircleUserRound, LayoutDashboard, Map, Menu, RadioTower, Route, Search, Settings2, ShieldCheck, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OperationsStatus } from '@/components/operations-status';
import { SignOutButton } from '@/components/sign-out-button';
import orpc from '@/lib/orpc/client';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/fleet', label: 'Fleet Map', icon: Map },
  { href: '/dashboard/sites', label: 'Waste Sensors', icon: RadioTower },
  { href: '/dashboard/routes', label: 'Routes & Dispatch', icon: Route },
  { href: '/dashboard/drivers', label: 'Driver Verification', icon: ShieldCheck },
  { href: '/dashboard/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/admin', label: 'Management', icon: Settings2 },
];

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const alerts = useQuery(orpc.alerts.list.queryOptions());
  const urgent = alerts.data?.filter((item) => !item.acknowledged && item.severity === 'CRITICAL').length ?? 0;
  return <div className="flex h-full flex-col bg-[#161e21] text-slate-200"><div className="flex h-16 items-center border-b border-white/10 px-5"><div><p className="font-bold leading-tight text-white">Rotom</p><p className="text-[10px] text-slate-400">Municipal Oversight</p></div></div><nav className="flex-1 space-y-1 px-3 py-5" aria-label="Dashboard navigation">{navigation.map(({ href, label, icon: Icon, exact }) => { const active = exact ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} onClick={onNavigate} className={cn('relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white', active && 'bg-white/10 text-white before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-full before:bg-accent')}><Icon className="size-4" />{label}{href === '/dashboard/incidents' && urgent > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">{urgent}</span>}</Link>; })}</nav><div className="space-y-3 border-t border-white/10 p-3"><Link href="/dashboard/incidents?severity=CRITICAL" onClick={onNavigate} className="flex h-10 items-center justify-center gap-2 rounded-md bg-destructive text-xs font-bold text-white hover:bg-red-700"><AlertTriangle className="size-4" />Urgent alerts {urgent > 0 ? `(${urgent})` : ''}</Link><Link href="/dashboard/account" onClick={onNavigate} className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-slate-300 hover:bg-white/8 hover:text-white"><CircleUserRound className="size-4" />Account</Link></div></div>;
}

function GlobalSearch() {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const normalized = value.trim();
  const results = useQuery({ ...orpc.search.global.queryOptions({ input: { query: normalized.length >= 2 ? normalized : '__' } }), enabled: normalized.length >= 2 });
  useEffect(() => { const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  return <div ref={container} className="relative w-full max-w-md"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Global search" value={value} onFocus={() => setOpen(true)} onChange={(event) => { setValue(event.target.value); setOpen(true); }} className="h-10 rounded-full border-transparent bg-muted pl-9" placeholder="Search trucks, sites, drivers, routes…" />{open && normalized.length >= 2 && <div className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-lg border bg-popover shadow-lg">{results.isLoading && <p className="p-4 text-sm text-muted-foreground">Searching…</p>}{results.data?.map((item) => <Link key={`${item.type}-${item.id}`} href={item.href} onClick={() => { setOpen(false); setValue(''); }} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted"><span className="grid size-8 place-items-center rounded-md bg-muted text-secondary">{item.type === 'vehicle' ? <Truck className="size-4" /> : item.type === 'site' ? <Building2 className="size-4" /> : <Search className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block text-xs text-muted-foreground">{item.subtitle}</span></span><ChevronRight className="size-4 text-muted-foreground" /></Link>)}{!results.isLoading && results.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching operational records.</p>}</div>}</div>;
}

export function DashboardShell({ user, children }: { user: { name: string; email: string }; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="min-h-screen bg-background"><aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] lg:block"><Sidebar pathname={pathname} /></aside>{mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/45" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /><aside role="dialog" aria-modal="true" aria-label="Navigation" className="relative h-full w-[280px]"><button className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-md text-white hover:bg-white/10" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X className="size-5" /></button><Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} /></aside></div>}<header role="banner" className="fixed top-0 right-0 left-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:left-[220px] lg:px-6"><Button className="lg:hidden" variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu /></Button><span className="hidden text-sm font-semibold xl:block">Rotom Central</span><GlobalSearch /><div className="ml-auto flex items-center gap-2"><span className="hidden md:block"><OperationsStatus /></span><Button variant="ghost" size="icon" asChild aria-label="View incidents"><Link href="/dashboard/incidents"><Bell /></Link></Button><div className="hidden text-right xl:block"><p className="text-xs font-semibold">{user.name}</p><p className="max-w-36 truncate text-[10px] text-muted-foreground">{user.email}</p></div><SignOutButton /></div></header><main className="min-h-screen pt-16 lg:ml-[220px]"><div className="mx-auto grid max-w-[1600px] gap-6 p-4 md:p-6 lg:p-8">{children}</div></main></div>;
}
