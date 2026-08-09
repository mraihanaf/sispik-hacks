'use client';

import mqtt from 'mqtt';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { REALTIME_SUBSCRIPTION, RealtimeEventSchema, type RealtimeEvent } from '@sispik-hacks/iot-contracts';
import orpc from '@/lib/orpc/client';

type RealtimeState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';
const RealtimeContext = createContext<RealtimeState>('OFFLINE');
const RealtimeEventContext = createContext<RealtimeEvent | null>(null);
export const useRealtimeState = () => useContext(RealtimeContext);
export const useRealtimeEvent = () => useContext(RealtimeEventContext);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RealtimeState>('CONNECTING');
  const [event, setEvent] = useState<RealtimeEvent | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    let client: mqtt.MqttClient | undefined;
    let stopped = false;
    void (async () => {
      try {
        const credentials = await orpc.realtime.createConnectionToken.call();
        if (stopped) return;
        client = mqtt.connect(credentials.brokerUrl, { clientId: credentials.clientId, username: 'dashboard', password: credentials.token, reconnectPeriod: 2_000 });
        client.on('connect', () => { if (!stopped) { setState('CONNECTED'); client?.subscribe(REALTIME_SUBSCRIPTION, { qos: 0 }); void queryClient.invalidateQueries(); } });
        client.on('reconnect', () => { if (!stopped) setState('RECONNECTING'); });
        client.on('offline', () => { if (!stopped) setState('OFFLINE'); });
        client.on('message', (_topic, payload) => { try { const event = RealtimeEventSchema.parse(JSON.parse(payload.toString('utf8'))); if (!stopped) { setEvent(event); if (event.type !== 'vehicle.location.updated') void queryClient.invalidateQueries(); } } catch { /* reject untrusted realtime message */ } });
      } catch { if (!stopped) setState('OFFLINE'); }
    })();
    return () => { stopped = true; client?.removeAllListeners(); client?.end(true); };
  }, [queryClient]);
  return <RealtimeContext.Provider value={state}><RealtimeEventContext.Provider value={event}>{children}</RealtimeEventContext.Provider></RealtimeContext.Provider>;
}
