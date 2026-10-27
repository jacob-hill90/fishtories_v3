import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWeather, searchCities } from './weatherApi.js';
import { formatLocationName, roundLocation } from './weather.js';

const INITIAL = { status: 'idle', data: null, locationName: '', error: '' };
const CACHE_MILLIS = 10 * 60 * 1000;

/**
 * Keeps current conditions available to both the navbar and weather page.
 * Doesn't store browser coordinates in the backend, cookies, or localStorage.
 * Only calls Geolocation automatically when the permission was already granted.
 */
export default function useWeather(enabled) {
  const [weather, setWeather] = useState(INITIAL);
  const activeRef = useRef(enabled);
  const controllerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const requestIndexRef = useRef(0);

  const loadCoordinates = useCallback(async (latitude, longitude, locationName = 'Near your location') => {
    if (!activeRef.current) return;
    let rounded;
    try {
      rounded = roundLocation(latitude, longitude);
    } catch (err) {
      setWeather((old) => ({ ...old, status: 'error', error: err.message }));
      return;
    }

    const key = `${rounded.latitude},${rounded.longitude}`;
    const cached = cacheRef.current.get(key);
    const thisRequest = ++requestIndexRef.current;
    controllerRef.current?.abort();

    if (cached && Date.now() - cached.at < CACHE_MILLIS) {
      setWeather({ status: 'ready', data: cached.data, locationName, error: '' });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setWeather({ status: 'loading', data: null, locationName, error: '' });
    try {
      const data = await fetchWeather(rounded.latitude, rounded.longitude, { signal: controller.signal });
      if (!controller.signal.aborted && activeRef.current && thisRequest === requestIndexRef.current) {
        cacheRef.current.set(key, { at: Date.now(), data });
        setWeather({ status: 'ready', data, locationName, error: '' });
      }
    } catch (err) {
      if (!controller.signal.aborted && activeRef.current && thisRequest === requestIndexRef.current) {
        setWeather({ status: 'error', data: null, locationName, error: err.message || 'Could not load weather.' });
      }
    }
  }, []);

  const useBrowserLocation = useCallback(() => {
    if (!activeRef.current) return;
    if (!navigator.geolocation || !window.isSecureContext) {
      setWeather((old) => ({ ...old, status: 'error', error: 'Location requires HTTPS (or localhost) and a compatible browser. Try searching for a city instead.' }));
      return;
    }
    const thisRequest = ++requestIndexRef.current;
    controllerRef.current?.abort();
    setWeather({ status: 'locating', data: null, locationName: '', error: '' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (activeRef.current && thisRequest === requestIndexRef.current) {
          void loadCoordinates(position.coords.latitude, position.coords.longitude);
        }
      },
      (error) => {
        if (!activeRef.current || thisRequest !== requestIndexRef.current) return;
        const message = error.code === 1
          ? 'Location permission was denied. You can still search for a city.'
          : 'Could not find your location. Try a city search instead.';
        setWeather({ status: 'error', data: null, locationName: '', error: message });
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: CACHE_MILLIS },
    );
  }, [loadCoordinates]);

  const chooseCity = useCallback((city) => {
    if (!city) return;
    void loadCoordinates(city.latitude, city.longitude, formatLocationName(city));
  }, [loadCoordinates]);

  useEffect(() => {
    activeRef.current = enabled;
    if (!enabled) {
      ++requestIndexRef.current;
      controllerRef.current?.abort();
      cacheRef.current.clear();
      setWeather(INITIAL);
      return undefined;
    }
    let cancelled = false;
    // Avoid a surprise permission prompt on first visit. The page contains an
    // explicit 'Use my location' control for requesting permission.
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then((result) => {
          if (!cancelled && result.state === 'granted') useBrowserLocation();
        })
        .catch(() => {}); // Unsupported Permissions API; manual button still works.
    }
    return () => { cancelled = true; };
  }, [enabled, useBrowserLocation]);

  return { weather, useBrowserLocation, chooseCity, searchCities };
}
