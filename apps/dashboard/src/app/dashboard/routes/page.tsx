import { Suspense } from 'react';
import { OperationsConsole } from '@/components/operations-console';
export default function RoutesPage() { return <Suspense fallback={<div className="h-[640px] animate-pulse rounded-lg bg-muted" />}><OperationsConsole view="routes" /></Suspense>; }
