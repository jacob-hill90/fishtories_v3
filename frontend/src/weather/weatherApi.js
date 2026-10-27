import { parseForecast, roundLocation } from './weather.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// Open-Meteo's no-key Free API is for NON-COMMERCIAL use; see WEATHER_STEP_9.md.
export async function fetchWeather(latitude, longitude, { signal } = {}) {
  const approx = roundLocation(latitude, longitude);
  const params = new URLSearchParams({
    latitude: String(approx.latitude),
    longitude: String(approx.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '5',
  });
  const response = await fetch(`${FORECAST_URL}?${params}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('The weather provider is unavailable. Please try again.');
  return parseForecast(await response.json());
}

export async function searchCities(query, { signal } = {}) {
  const trimmed = query.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return [];
  const params = new URLSearchParams({ name: trimmed, count: '5', language: 'en', format: 'json' });
  const response = await fetch(`${GEOCODING_URL}?${params}`, { signal });
  if (!response.ok) throw new Error('City search is unavailable right now.');
  const data = await response.json();
  return (Array.isArray(data.results) ? data.results : []).filter(
    (item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
  );
}
