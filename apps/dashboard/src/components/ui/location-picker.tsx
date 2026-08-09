'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_STYLE } from '@/lib/maps/style';

type Coordinates = { latitude: number; longitude: number };

const isCoordinate = (value: number | null | undefined) => value != null && Number.isFinite(value);
const rounded = (value: number) => Number(value.toFixed(6));

export function LocationPicker({
  id,
  label = 'Location',
  latitude,
  longitude,
  onChange,
}: {
  id: string;
  label?: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (coordinates: Coordinates) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const chooseRef = useRef<(point: maplibregl.LngLat) => void>(undefined);
  const onChangeRef = useRef(onChange);
  const [locationError, setLocationError] = useState<string>();
  const selected = isCoordinate(latitude) && isCoordinate(longitude);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!container.current) return;
    const initialCenter: [number, number] = selected ? [longitude ?? DEFAULT_MAP_CENTER[0], latitude ?? DEFAULT_MAP_CENTER[1]] : DEFAULT_MAP_CENTER;
    const instance = new maplibregl.Map({
      container: container.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE,
      center: initialCenter,
      zoom: selected ? 15 : 11,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const choose = ({ lng, lat }: maplibregl.LngLat) => {
      const coordinates = { latitude: rounded(lat), longitude: rounded(lng) };
      marker.current?.remove();
      const nextMarker = new maplibregl.Marker({ color: '#059669', draggable: true })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .addTo(instance);
      nextMarker.on('dragend', () => choose(nextMarker.getLngLat()));
      marker.current = nextMarker;
      setLocationError(undefined);
      onChangeRef.current(coordinates);
    };
    chooseRef.current = choose;

    if (selected) choose(new maplibregl.LngLat(longitude ?? DEFAULT_MAP_CENTER[0], latitude ?? DEFAULT_MAP_CENTER[1]));
    instance.on('click', (event) => choose(event.lngLat));
    instance.on('load', () => instance.resize());
    map.current = instance;

    return () => {
      marker.current?.remove();
      marker.current = null;
      chooseRef.current = undefined;
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !selected) return;
    const point: [number, number] = [longitude ?? DEFAULT_MAP_CENTER[0], latitude ?? DEFAULT_MAP_CENTER[1]];
    if (!marker.current) {
      chooseRef.current?.(new maplibregl.LngLat(...point));
    } else {
      marker.current.setLngLat(point);
    }
  }, [latitude, longitude, selected]);

  function selectCenter() {
    const instance = map.current;
    if (instance) chooseRef.current?.(instance.getCenter());
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('Current location is not supported by this browser.');
      return;
    }
    setLocationError(undefined);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { latitude: rounded(coords.latitude), longitude: rounded(coords.longitude) };
        map.current?.flyTo({ center: [coordinates.longitude, coordinates.latitude], zoom: 16 });
        chooseRef.current?.(new maplibregl.LngLat(coordinates.longitude, coordinates.latitude));
      },
      () => setLocationError('Location access was unavailable. Select a point on the map instead.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <fieldset className="grid gap-2 md:col-span-2" aria-describedby={`${id}-help ${id}-status`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label asChild><legend>{label}</legend></Label>
          <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">Click the map or drag the pin. You can also pan with the keyboard and select the map center.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={useCurrentLocation}><LocateFixed />Use my location</Button>
      </div>
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        <div ref={container} id={id} aria-label={`${label} map`} className="h-72 w-full" />
        {!selected && <div className="pointer-events-none absolute inset-x-12 top-3 rounded-md border bg-background/95 px-3 py-2 text-center text-xs font-medium shadow"><MapPin className="mr-1 inline size-3.5 text-primary" />Select a point to continue</div>}
      </div>
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <output id={`${id}-status`} aria-live="polite" className="text-xs">
          {selected ? <><span className="font-medium text-foreground">Selected:</span> <span className="data-mono text-muted-foreground">{(latitude ?? 0).toFixed(6)}, {(longitude ?? 0).toFixed(6)}</span></> : <span className="font-medium text-amber-700">No location selected</span>}
        </output>
        <Button type="button" size="sm" variant="ghost" onClick={selectCenter}><Crosshair />Select map center</Button>
      </div>
      {locationError && <p role="alert" className="text-xs text-destructive">{locationError}</p>}
    </fieldset>
  );
}
