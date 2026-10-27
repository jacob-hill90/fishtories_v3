import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as LibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCatches, getCurrentUser, getPublicCatches } from '../api/client.js';
import './catch-map.css';

setWorkerUrl(workerUrl);
const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

function hasCoordinates(item) {
  return item.latitude != null && item.longitude != null &&
    Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unknown' : new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

// All user-provided strings enter textContent, not innerHTML/setHTML.
// MapLibre's setDOMContent renders these DOM nodes safely.
function createPopupContent(item, community) {
  const element = document.createElement('div');
  element.className = 'catch-popup';
  const add = (tag, content, className) => {
    const node = document.createElement(tag);
    node.textContent = String(content);
    if (className) node.className = className;
    element.appendChild(node);
  };
  add('strong', item.species);
  if (item.photo_url && /^\/api\/catches\/\d+\/photo\/$/.test(item.photo_url)) {
    const photo = document.createElement('img');
    photo.src = item.photo_url;
    photo.alt = `Catch photo: ${item.species}`;
    photo.className = 'catch-popup-photo';
    photo.loading = 'lazy';
    element.appendChild(photo);
  }
  add('p', formatDate(item.caught_at));
  if (item.location_name) add('p', `📍 ${item.location_name}`);
  if (community) {
    add('p', `Coordinates: ${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}`);
  } else {
    add('p', item.is_public ? '🌎 Public catch' : '🔒 Private catch');
  }
  if (item.weight_lb != null || item.length_in != null) {
    const measurements = [
      item.weight_lb != null ? `${item.weight_lb} lb` : null,
      item.length_in != null ? `${item.length_in} in` : null,
    ].filter(Boolean).join(' · ');
    add('p', measurements);
  }
  if (item.notes) add('p', item.notes, 'catch-popup-story');
  return element;
}

/** Both map views share one component, but they use separate API endpoints. */
export default function CatchMap({ user, onNavigate, onSessionExpired }) {
  const [mode, setMode] = useState(user ? 'mine' : 'community');
  const activeMode = user ? mode : 'community';
  const community = activeMode === 'community';
  const containerRef = useRef(null);
  const markerRefs = useRef([]);
  const [catches, setCatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setMapError('');
    setCatches([]);
    const request = community ? getPublicCatches : getCatches;
    request({ signal: controller.signal })
      .then((items) => { if (!controller.signal.aborted) setCatches(items); })
      .catch(async (err) => {
        if (controller.signal.aborted) return;
        if (!community && (err.status === 401 || err.status === 403)) {
          try {
            if (!await getCurrentUser()) { onSessionExpired(); return; }
          } catch { /* Keep the error visible when the API is unavailable. */ }
        }
        if (!controller.signal.aborted) setError(err.message || 'Unable to load this map.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [community, onSessionExpired]);

  useEffect(() => {
    if (loading || error || !containerRef.current) return undefined;
    let map;
    try {
      map = new LibreMap({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [-96, 39], zoom: 3.4, attributionControl: true,
      });
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.on('error', () => setMapError('Map tiles could not load. Check the connection or tile provider.'));
      const pinned = catches.filter(hasCoordinates);
      map.on('load', () => {
        const bounds = new LngLatBounds();
        pinned.forEach((item) => {
          const coords = [Number(item.longitude), Number(item.latitude)];
          bounds.extend(coords);
          const marker = new Marker({ color: community ? '#e08c40' : '#176d60' })
            .setLngLat(coords)
            .setPopup(new Popup({ offset: 20, maxWidth: '320px' }).setDOMContent(createPopupContent(item, community)))
            .addTo(map);
          markerRefs.current.push(marker);
        });
        if (pinned.length === 1) {
          map.jumpTo({ center: [Number(pinned[0].longitude), Number(pinned[0].latitude)], zoom: 10 });
        } else if (pinned.length > 1) {
          map.fitBounds(bounds, { padding: 65, maxZoom: 11, duration: 0 });
        }
      });
    } catch {
      setMapError('Unable to start the map. This browser may not support WebGL.');
    }
    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map?.remove();
    };
  }, [loading, error, catches, community]);

  const pinned = catches.filter(hasCoordinates);

  return (
    <section className="catch-map-page">
      <div className="catch-map-container">
        <div className="catch-map-heading">
          <div>
            <p className="eyebrow eyebrow-dark">{community ? 'DISCOVER FISHING STORIES' : 'YOUR FISHING JOURNAL'}</p>
            <h1>{community ? 'Community catch map' : 'My catch map'}</h1>
            <p>{community
              ? 'Explore catches anglers have chosen to share. Only intentionally public catches appear here.'
              : 'Revisit all your own pinned catches, including ones you have kept private.'}</p>
          </div>
          {user && <button type="button" className="button button-primary" onClick={() => onNavigate('/catches')}>+ Log a catch</button>}
        </div>
        <div className="map-view-switch" role="group" aria-label="Catch map view">
          {user && <button type="button" className={`map-view-button ${!community ? 'active' : ''}`}
            aria-pressed={!community} onClick={() => setMode('mine')}>🔒 My Catch Map</button>}
          <button type="button" className={`map-view-button ${community ? 'active' : ''}`}
            aria-pressed={community} onClick={() => setMode('community')}>🌎 Community Map</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <div className="session-loading">Loading {community ? 'community catches' : 'your catches'}…</div> : !error && (
          <>
            <div className="catch-map-canvas" ref={containerRef} aria-label={community ? 'Map of shared catches' : 'Map of your catches'} />
            {mapError && <p className="map-error" role="status">{mapError}</p>}
            <div className="map-summary">
              <strong>{pinned.length} {community ? 'shared' : 'pinned'} {pinned.length === 1 ? 'catch' : 'catches'}</strong>
              {!community && <span>{catches.length - pinned.length} without map coordinates</span>}
              {community && <span>Showing up to 250 most recent public catches</span>}
            </div>
            {pinned.length === 0 && (
              <div className="map-empty">
                <h2>{community ? 'No public catches on the map yet' : 'Your first map pin is waiting'}</h2>
                <p>{community
                  ? 'Once an angler shares a catch with a map pin, it will appear here.'
                  : 'Open a catch in your journal, select a location, and save it to place your first pin.'}</p>
                {user && <button className="button button-secondary" type="button" onClick={() => onNavigate('/catches')}>Open my catch journal</button>}
              </div>
            )}
          </>
        )}
        <p className="map-privacy-note">{community
          ? '🌎 This map intentionally shows exact locations and stories shared by anglers. Be respectful of fishing spots. Public catch photos are only displayed when an angler chooses to publish their catch.'
          : '🔒 Your private catches stay inside your account. Public catches also appear here and on the Community Map.'}
          {' '}OpenFreeMap receives standard map tile requests, not your entire catch journal.</p>
      </div>
    </section>
  );
}
