'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- MapLibre GeoJSON accepts heterogeneous operational records. */

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_STYLE } from '@/lib/maps/style';
import { useRealtimeEvent } from './realtime-provider';

type Entity = { id: string; code?: string; name?: string; latitude?: number | null; longitude?: number | null; lastLatitude?: number | null; lastLongitude?: number | null; status?: string; currentCapacityPercent?: number };
/** Browser-only MapLibre view. Realtime events improve presentation; oRPC remains authoritative. */
export function OperationsMap({ sites = [], facilities = [], vehicles = [], route, anomalies = [], onSelect }: { sites?: Entity[]; facilities?: Entity[]; vehicles?: Entity[]; route?: any; anomalies?: any[]; onSelect?: (entity: { type: string; id: string }) => void }) {
  const element = useRef<HTMLDivElement>(null); const map = useRef<maplibregl.Map | null>(null); const markers = useRef<maplibregl.Marker[]>([]); const routeOverlay = useRef<SVGSVGElement | null>(null); const lastFocusKey = useRef<string | null>(null); const event = useRealtimeEvent(); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const style = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE;
    if (!element.current) return;
    const instance = new maplibregl.Map({ container: element.current, style, center: DEFAULT_MAP_CENTER, zoom: 10 });
    instance.addControl(new maplibregl.NavigationControl(), 'top-right'); instance.on('load', () => setLoaded(true));
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); overlay.setAttribute('aria-hidden', 'true'); overlay.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;overflow:visible'; instance.getContainer().append(overlay); routeOverlay.current = overlay; map.current = instance;
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; routeOverlay.current?.remove(); routeOverlay.current = null; instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current; const overlay = routeOverlay.current; const geometry = route?.geometry as any;
    if (!instance || !overlay || !loaded) return;
    const draw = () => {
      overlay.replaceChildren(); const coordinates = geometry?.type === 'LineString' ? geometry.coordinates : [];
      if (!coordinates.length) return;
      const { clientWidth: width, clientHeight: height } = instance.getContainer(); overlay.setAttribute('viewBox', `0 0 ${width} ${height}`); overlay.setAttribute('width', String(width)); overlay.setAttribute('height', String(height));
      const points = coordinates.map(([longitude, latitude]: [number, number]) => { const point = instance.project([longitude, latitude]); return `${point.x},${point.y}`; }).join(' ');
      for (const [stroke, strokeWidth] of [['#ffffff', '14'], ['#f97316', '8']] as const) { const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); line.setAttribute('points', points); line.setAttribute('fill', 'none'); line.setAttribute('stroke', stroke); line.setAttribute('stroke-width', strokeWidth); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round'); overlay.append(line); }
    };
    instance.on('move', draw); instance.on('resize', draw); draw();
    return () => { instance.off('move', draw); instance.off('resize', draw); };
  }, [loaded, route]);
  useEffect(() => {
    const instance = map.current; if (!instance || !loaded) return;
    const liveVehicles = event?.type === 'vehicle.location.updated' ? vehicles.map((vehicle: any) => vehicle.id === event.data.vehicleId ? { ...vehicle, lastLatitude: event.data.latitude, lastLongitude: event.data.longitude, lastSeenAt: event.timestamp, locations: [{ ...(vehicle.locations?.[0] ?? {}), ...event.data, observedAt: event.timestamp }, ...(vehicle.locations ?? [])] } : vehicle) : vehicles;
    const feature = (type: string, item: any, coordinates: number[], properties: Record<string, unknown> = {}) => ({ type: 'Feature', properties: { type, id: item.id, label: item.code ?? item.name ?? type, ...properties }, geometry: { type: 'Point', coordinates } });
    const features: any[] = [
      ...sites.filter((x) => x.longitude != null && x.latitude != null).map((x) => feature('site', x, [x.longitude!, x.latitude!], { status: x.status, capacity: x.currentCapacityPercent })),
      ...facilities.filter((x) => x.longitude != null && x.latitude != null).map((x) => feature('facility', x, [x.longitude!, x.latitude!])),
      ...liveVehicles.filter((x) => x.lastLongitude != null && x.lastLatitude != null).map((x) => feature('vehicle', x, [x.lastLongitude!, x.lastLatitude!], { status: x.status })),
      ...anomalies.filter((x) => x.longitude != null && x.latitude != null).map((x) => feature('anomaly', x, [x.longitude, x.latitude], { title: x.title })),
    ];
    markers.current.forEach((marker) => marker.remove()); markers.current = [];
    const addMarker = (type: string, item: any, longitude: number, latitude: number, color: string) => {
      const label = item.code ?? item.name ?? item.title ?? type;
      const markerElement = document.createElement('div'); markerElement.className = 'flex max-w-28 flex-col items-center gap-0.5 text-center';
      const icon = document.createElement('button'); icon.type = 'button'; icon.title = label; icon.setAttribute('aria-label', `${type}: ${label}`);
      icon.className = 'grid size-10 place-items-center rounded-full border-2 border-white text-xl leading-none shadow-lg'; icon.style.backgroundColor = color;
      icon.textContent = type === 'vehicle' ? '🚛' : type === 'facility' ? '🏭' : type === 'anomaly' ? '⚠️' : '🗑️';
      const caption = document.createElement('span'); caption.className = 'rounded bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-foreground shadow'; caption.textContent = label;
      icon.addEventListener('click', () => onSelect?.({ type, id: item.id })); markerElement.append(icon, caption);
      markers.current.push(new maplibregl.Marker({ element: markerElement, anchor: 'bottom' }).setLngLat([longitude, latitude]).addTo(instance));
    };
    sites.filter((item) => item.longitude != null && item.latitude != null).forEach((item) => addMarker('site', item, item.longitude!, item.latitude!, '#16a34a'));
    facilities.filter((item) => item.longitude != null && item.latitude != null).forEach((item) => addMarker('facility', item, item.longitude!, item.latitude!, '#7c3aed'));
    liveVehicles.filter((item) => item.lastLongitude != null && item.lastLatitude != null).forEach((item) => addMarker('vehicle', item, item.lastLongitude!, item.lastLatitude!, '#2563eb'));
    anomalies.filter((item) => item.longitude != null && item.latitude != null).forEach((item) => addMarker('anomaly', item, item.longitude, item.latitude, '#dc2626'));
    const source = instance.getSource('operations') as maplibregl.GeoJSONSource | undefined;
    const collection = { type: 'FeatureCollection', features } as any;
    if (source) source.setData(collection); else { instance.addSource('operations', { type: 'geojson', data: collection }); instance.addLayer({ id: 'operations-points', type: 'circle', source: 'operations', paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'type'], 'site', '#16a34a', 'vehicle', '#2563eb', 'facility', '#7c3aed', '#dc2626'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } }); instance.on('click', 'operations-points', (click) => { const item = click.features?.[0]?.properties; if (item) onSelect?.({ type: item.type, id: item.id }); }); instance.on('mouseenter', 'operations-points', () => { instance.getCanvas().style.cursor = 'pointer'; }); instance.on('mouseleave', 'operations-points', () => { instance.getCanvas().style.cursor = ''; }); }
    const geometry = route?.geometry as any;
    const routeData = { type: 'FeatureCollection', features: geometry?.type === 'LineString' ? [{ type: 'Feature', properties: {}, geometry }] : [] } as any;
    const routeSource = instance.getSource('selected-route') as maplibregl.GeoJSONSource | undefined;
    if (routeSource) routeSource.setData(routeData); else {
      instance.addSource('selected-route', { type: 'geojson', data: routeData });
      instance.addLayer({ id: 'selected-route-casing', type: 'line', source: 'selected-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 14, 'line-opacity': .95 } });
      instance.addLayer({ id: 'selected-route-line', type: 'line', source: 'selected-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f97316', 'line-width': 9, 'line-opacity': 1 } });
    }
    const paths = liveVehicles.flatMap((vehicle: any) => vehicle.locations?.length > 1 ? [{ type: 'Feature', properties: { vehicleId: vehicle.id }, geometry: { type: 'LineString', coordinates: [...vehicle.locations].reverse().map((location: any) => [location.longitude, location.latitude]) } }] : []);
    const pathData = { type: 'FeatureCollection', features: paths } as any; const pathSource = instance.getSource('vehicle-paths') as maplibregl.GeoJSONSource | undefined;
    if (pathSource) pathSource.setData(pathData); else { instance.addSource('vehicle-paths', { type: 'geojson', data: pathData }); instance.addLayer({ id: 'vehicle-path-lines', type: 'line', source: 'vehicle-paths', paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-opacity': .65 } }); }
    const selectedCoordinates = geometry?.type === 'LineString' ? geometry.coordinates : features.map((item) => item.geometry.coordinates);
    const focusKey = route?.id ?? 'initial-operations-map';
    if (selectedCoordinates.length && lastFocusKey.current !== focusKey) { const bounds = new maplibregl.LngLatBounds(); selectedCoordinates.forEach((coordinates: [number, number]) => bounds.extend(coordinates)); instance.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 400 }); lastFocusKey.current = focusKey; }
  }, [sites, facilities, vehicles, route, anomalies, onSelect, event, loaded]);
  return <div className="relative"><div ref={element} className="min-h-80 overflow-hidden rounded-lg border" aria-label="Operations map" data-selected-route={route?.id ?? ''} /><div className="pointer-events-none absolute bottom-3 left-3 grid gap-1 rounded-md border bg-background/95 px-2 py-1.5 text-xs shadow"><span>🚛 Fleet</span><span>🗑️ Waste site</span><span>🏭 Facility</span><span>⚠️ Anomaly</span></div></div>;
}
