'use client';

import { useRealtimeState } from './realtime-provider';

export function OperationsStatus() {
  const state = useRealtimeState();
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state === 'CONNECTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>MQTT {state}</span>;
}
