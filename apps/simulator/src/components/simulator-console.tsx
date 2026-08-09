'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';
import { RealtimeEventSchema } from '@sispik-hacks/iot-contracts';
import { api } from '@/lib/api';
import { SimulatorMap } from '@/components/simulator-map';

type Data = { sites: any[]; facilities: any[]; fleets: any[] };
const blank: Data = { sites: [], facilities: [], fleets: [] };
const presets = [{ id: 'LIGHT', label: 'Light', detail: '1 tonne' }, { id: 'STANDARD', label: 'Standard', detail: '2 tonnes' }, { id: 'HEAVY', label: 'Heavy', detail: '4 tonnes' }];
const manualTickSeconds = .18;

export function SimulatorConsole() {
  const [data, setData] = useState<Data>(blank);
  const [selected, setSelected] = useState<string>();
  const [startFacilityId, setStartFacilityId] = useState('');
  const [manual, setManual] = useState(false);
  const [error, setError] = useState('');
  const [routes, setRoutes] = useState<any[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const garbageTimers = useRef<Record<string, number>>({});
  const lease = useRef(crypto.randomUUID());
  const keys = useRef(new Set<string>());
  const current = useRef(data);
  const selectedFleet = useRef<string | undefined>(undefined);
  current.current = data;
  selectedFleet.current = selected;

  const refresh = useCallback(async () => {
    try { setData(await api.snapshot()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Simulator unavailable'); }
  }, []);

  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 2_000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    let client: mqtt.MqttClient | undefined; let stopped = false;
    void api.createRealtimeConnectionToken().then((credentials: any) => {
      if (stopped) return;
      client = mqtt.connect(credentials.brokerUrl, { clientId: credentials.clientId, username: 'dashboard', password: credentials.token, reconnectPeriod: 2_000 });
      client.on('connect', () => client?.subscribe(credentials.topic, { qos: 0 }));
      client.on('message', (_topic, payload) => { try { RealtimeEventSchema.parse(JSON.parse(payload.toString('utf8'))); void refresh(); const fleetId = selectedFleet.current; if (fleetId) void api.routeOptions({ fleetId }).then(setRoutes).catch(() => undefined); } catch { /* ignore invalid broker payloads */ } });
      client.on('error', () => undefined);
    }).catch(() => undefined);
    return () => { stopped = true; client?.end(true); };
  }, [refresh]);
  useEffect(() => {
    if (!startFacilityId && data.facilities.length) setStartFacilityId(data.facilities.find((facility) => facility.code === 'SIM-DEPOT')?.id ?? data.facilities[0].id);
  }, [data.facilities, startFacilityId]);
  useEffect(() => () => Object.values(garbageTimers.current).forEach(clearTimeout), []);
  useEffect(() => {
    const timer = setInterval(() => current.current.fleets.filter((fleet) => fleet.drive?.mode === 'AUTOMATIC').forEach((fleet) => void api.tick({ fleetId: fleet.id }).then(refresh).catch(() => undefined)), 1_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const release = useCallback(async () => { if (selected && manual) await api.releaseControl({ fleetId: selected, lease: lease.current }); setManual(false); }, [selected, manual]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!manual || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === 'Escape') void release();
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.key)) { event.preventDefault(); keys.current.add(event.key); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key);
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  }, [manual, release]);
  useEffect(() => {
    if (!manual || !selected) return;
    const timer = setInterval(() => {
      const fleet = current.current.fleets.find((item) => item.id === selected);
      const forward = +(keys.current.has('w') || keys.current.has('ArrowUp')) - +(keys.current.has('s') || keys.current.has('ArrowDown'));
      const turn = +(keys.current.has('d') || keys.current.has('ArrowRight')) - +(keys.current.has('a') || keys.current.has('ArrowLeft'));
      if (!fleet || (!forward && !turn)) return;
      const speedKph = fleet.drive?.speedKph ?? 40;
      const direction = forward || 1;
      const heading = ((fleet.vehicle.locations?.[0]?.heading ?? 0) + turn * 45 + 360) % 360;
      const metres = speedKph * 1_000 / 3_600 * manualTickSeconds;
      const radians = heading * Math.PI / 180;
      void api.manualMove({ fleetId: selected, lease: lease.current, latitude: fleet.vehicle.lastLatitude + Math.cos(radians) * metres / 111_000 * direction, longitude: fleet.vehicle.lastLongitude + Math.sin(radians) * metres / (111_000 * Math.cos(fleet.vehicle.lastLatitude * Math.PI / 180)) * direction, speedKph, heading }).then(refresh).catch((cause: Error) => { setError(cause.message); void release(); });
    }, manualTickSeconds * 1_000);
    return () => clearInterval(timer);
  }, [manual, selected, refresh, release]);

  const fleet = data.fleets.find((item) => item.id === selected);
  const selectFleet = async (id: string) => { await release(); setSelected(id); setRoutes(await api.routeOptions({ fleetId: id }).catch(() => [])); };
  const setGarbageLive = (siteId: string, percent: number) => {
    setLevels((items) => ({ ...items, [siteId]: percent }));
    clearTimeout(garbageTimers.current[siteId]);
    garbageTimers.current[siteId] = window.setTimeout(() => void api.setGarbage({ siteId, percent }).then(refresh).catch((cause: Error) => setError(cause.message)), 220);
  };
  const mapEntities = [...data.facilities, ...data.sites, ...data.fleets.map((item) => ({ ...item.vehicle, longitude: item.vehicle.lastLongitude, latitude: item.vehicle.lastLatitude, fleetId: item.id, kind: 'truck' as const }))];

  return <main>
    <header><div><p>Development-only simulator</p><h1>Interactive fleet operations</h1></div><div className="toolbar"><button onClick={() => void api.seed().then(refresh)}>Load demo world</button><button className="danger" onClick={() => { if (!confirm('Reset all simulator fleets and demo records?')) return; void api.reset().then(() => { setSelected(undefined); setManual(false); void refresh(); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to reset the simulator.')); }}>Reset simulation</button></div></header>
    {error && <p className="error">{error}</p>}
    <section className="presets"><h2>Add fleet</h2><label className="starting-location">Starting at<select aria-label="Fleet starting location" value={startFacilityId} onChange={(event) => setStartFacilityId(event.target.value)} disabled={!data.facilities.length}><option value="">Load demo world first</option>{data.facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>{presets.map((preset) => <button key={preset.id} disabled={!startFacilityId} onClick={() => void api.addFleet({ preset: preset.id, startFacilityId }).then((created: any) => { void refresh(); void selectFleet(created.id); }).catch((cause: Error) => setError(cause.message))}><b>{preset.label}</b><small>{preset.detail}</small><span>Add truck</span></button>)}</section>
    <section className="layout"><SimulatorMap entities={mapEntities} selectedFleetId={selected} onSelectFleet={(id) => void selectFleet(id)}>{fleet && <FleetControl fleet={fleet} manual={manual} routes={routes} onRefresh={refresh} onError={setError} onManual={async () => { try { if (manual) return void release(); await api.takeControl({ fleetId: fleet.id, lease: lease.current }); setManual(true); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to take control.'); setManual(false); } }} />}</SimulatorMap><aside><h2>Fleet status</h2>{data.fleets.map((item) => <button className={`fleet ${item.id === selected ? 'selected' : ''}`} key={item.id} onClick={() => void selectFleet(item.id)}><b>{item.vehicle.code}</b><small>{item.label} · {item.drive?.mode ?? 'STOPPED'}</small><span>{item.startFacility?.name ?? 'Simulator Depot'} · {item.drive?.routePlan?.status ?? 'No route'}</span></button>) || <p>Load the demo, choose a start location, then add a preset truck.</p>}<h2>Waste sites</h2>{data.sites.map((site) => <SiteControl key={site.id} site={site} level={levels[site.id] ?? Math.round(site.currentCapacityPercent)} onChange={(value) => setGarbageLive(site.id, value)} />)}</aside></section>
    <p className="hint">Automatic fleets continue concurrently at their selected speed. Left/right steer and move diagonally; site capacity changes save automatically.</p>
  </main>;
}

function FleetControl({ fleet, manual, routes, onRefresh, onError, onManual }: any) {
  const [routeId, setRouteId] = useState('');
  const [speedKph, setSpeedKph] = useState(fleet.drive?.speedKph ?? 40);
  const speedTimer = useRef<number | undefined>(undefined);
  const route = fleet.drive?.routePlan;
  const stops = route?.stops ?? [];
  const complete = stops.filter((stop: any) => stop.status === 'COMPLETED').length;
  useEffect(() => { setSpeedKph(fleet.drive?.speedKph ?? 40); }, [fleet.id, fleet.drive?.speedKph]);
  useEffect(() => () => clearTimeout(speedTimer.current), []);
  const changeSpeed = (value: number) => { setSpeedKph(value); clearTimeout(speedTimer.current); speedTimer.current = window.setTimeout(() => void api.setSpeed({ fleetId: fleet.id, speedKph: value }).then(onRefresh).catch((cause: Error) => onError(cause.message)), 180); };
  return <div className="drive"><div><b>{fleet.vehicle.code}</b><small>{fleet.startFacility?.name ?? 'Simulator Depot'} · {route ? `${route.status} · ${complete}/${stops.length} stops` : 'No route assigned'}</small></div><label className="speed-control">Speed <b>{speedKph} km/h</b><input aria-label="Fleet speed" type="range" min="5" max="80" value={speedKph} onChange={(event) => changeSpeed(Number(event.target.value))} /></label><button onClick={() => void api.startDrive({ fleetId: fleet.id }).then(onRefresh).catch((cause: Error) => onError(cause.message))}>Assign demo route</button><select aria-label="Existing route" value={routeId} onChange={(event) => setRouteId(event.target.value)}><option value="">Existing route…</option>{routes.map((item: any) => <option key={item.id} value={item.id}>{item.status} · {item.stops.length} stops</option>)}</select><button disabled={!routeId} onClick={() => void api.startDrive({ fleetId: fleet.id, routeId }).then(onRefresh).catch((cause: Error) => onError(cause.message))}>Use route</button><button disabled={!route || route.status === 'COMPLETED'} onClick={() => void api.scanEktp({ fleetId: fleet.id }).then(onRefresh).catch((cause: Error) => onError(cause.message))}>Scan eKTP</button><button className={manual ? 'active-control' : ''} onClick={() => void onManual()}>{manual ? 'Release control' : 'Take control'}</button>{manual && <div className="pad"><button onMouseDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))} onMouseUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }))}>▲</button><span><button onMouseDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))} onMouseUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }))}>◀</button><button onMouseDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))} onMouseUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }))}>▼</button><button onMouseDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))} onMouseUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }))}>▶</button></span></div>}</div>;
}

function SiteControl({ site, level, onChange }: { site: any; level: number; onChange: (value: number) => void }) { return <div className="site"><div><b>{site.code}</b><span>{level}% · {site.status}</span></div><input aria-label={`${site.code} capacity`} type="range" min="1" max="100" value={level} onChange={(event) => onChange(Number(event.target.value))} /></div>; }
