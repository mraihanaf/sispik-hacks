'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as maplibregl from 'maplibre-gl';

type MapEntity = {
  id: string;
  code: string;
  latitude?: number | null;
  longitude?: number | null;
  fleetId?: string;
  kind?: 'truck';
  maxCapacityKg?: number;
};

const DEFAULT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'openstreetmap', type: 'raster' as const, source: 'openstreetmap' }],
};

function markerFor(entity: MapEntity) {
  if (entity.kind === 'truck') return { icon: '🚛', label: 'Truck', color: '#fbbf24' };
  if (entity.maxCapacityKg) return { icon: '🗑️', label: 'Waste site', color: '#22d3ee' };
  return { icon: '🏭', label: 'Facility', color: '#a78bfa' };
}

export function SimulatorMap({ entities, selectedFleetId, onSelectFleet, children }: { entities: MapEntity[]; selectedFleetId?: string; onSelectFleet: (fleetId: string) => void; children?: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef(false);
  const [status, setStatus] = useState('Loading map base…');

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: DEFAULT_STYLE, center: [106.84, -6.2], zoom: 11 });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), 'top-right');
    instance.on('load', () => setStatus('OpenStreetMap base active'));
    instance.on('error', () => setStatus('Map base unavailable — operational locations remain visible'));
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    markers.current.forEach((marker) => marker.remove());
    const located = entities.filter((entity) => entity.latitude != null && entity.longitude != null);
    markers.current = located.map((entity) => {
      const marker = markerFor(entity);
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `map-marker${entity.fleetId && entity.fleetId === selectedFleetId ? ' selected' : ''}`;
      element.style.setProperty('--marker-color', marker.color);
      element.setAttribute('aria-label', `${marker.label}: ${entity.code}`);
      element.innerHTML = `<span aria-hidden="true">${marker.icon}</span><small>${entity.code}</small>`;
      if (entity.fleetId) element.addEventListener('click', () => onSelectFleet(entity.fleetId!));
      return new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([entity.longitude!, entity.latitude!]).addTo(instance);
    });
    if (!fitted.current && located.length) {
      const bounds = new maplibregl.LngLatBounds();
      located.forEach((entity) => bounds.extend([entity.longitude!, entity.latitude!]));
      instance.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 0 });
      fitted.current = true;
    }
  }, [entities, onSelectFleet, selectedFleetId]);

  return <div className="map" aria-label="Interactive simulator map" data-map-status={status}><div className="map-canvas" ref={container} /><div className="map-status" aria-live="polite">{status}</div><div className="map-legend" aria-label="Map legend"><span>🚛 Fleet</span><span>🗑️ Waste site</span><span>🏭 Facility</span></div>{children}</div>;
}
