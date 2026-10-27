import { useEffect, useRef, useState } from 'react';
import { Map as LibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../pages/catch-map.css';

setWorkerUrl(workerUrl);

const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_STYLE;

function hasCoordinates(latitude, longitude) {
  return latitude !== '' && longitude !== '' && latitude != null && longitude != null &&
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}

/** A controlled, optional location picker. No geolocation or paid geocoding. */
export default function CatchLocationPicker({ latitude, longitude, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [mapError, setMapError] = useState('');

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let map;
    try {
      const hasPin = hasCoordinates(latitude, longitude);
      map = new LibreMap({
        container: containerRef.current,
        style: MAP_STYLE,
        center: hasPin ? [Number(longitude), Number(latitude)] : [-96, 39],
        zoom: hasPin ? 10 : 3.4,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.on('click', (event) => {
        // MapLibre longitudes may wrap past 180 on an infinitely scrolling world.
        const lng = ((event.lngLat.lng + 180) % 360 + 360) % 360 - 180;
        onChangeRef.current({
          latitude: event.lngLat.lat.toFixed(6),
          longitude: lng.toFixed(6),
        });
      });
      map.on('error', () => setMapError('Map tiles could not be loaded. Check your connection or tile provider.'));
    } catch {
      setMapError('Could not initialize the map. Your browser may not support WebGL.');
    }
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // Only create the map once. Form values are synchronized by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (hasCoordinates(latitude, longitude)) {
      markerRef.current = new Marker({ color: '#176d60' })
        .setLngLat([Number(longitude), Number(latitude)])
        .addTo(map);
    }
  }, [latitude, longitude]);

  return (
    <div className="catch-location-picker">
      <div className="map-picker-header">
        <strong>Pin this catch on the map (optional)</strong>
        <span>Click anywhere to drop or move the pin.</span>
      </div>
      <div className="map-picker-canvas" ref={containerRef} aria-label="Select a fishing location on the map" />
      {mapError && <p className="map-error" role="status">{mapError}</p>}
      <div className="map-picker-status">
        {hasCoordinates(latitude, longitude)
          ? <span>📍 {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}</span>
          : <span>No exact location selected. You can save without a pin.</span>}
        {hasCoordinates(latitude, longitude) && (
          <button type="button" className="inline-link" onClick={() => onChange({ latitude: '', longitude: '' })}>
            Remove pin
          </button>
        )}
      </div>
      <small>Your pin is private unless you choose Public on the catch form. Published coordinates can be copied by anyone. OpenFreeMap handles map tile requests.</small>
    </div>
  );
}
