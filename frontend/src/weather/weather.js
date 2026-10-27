// Pure weather utilities (also unit-tested using Node's built-in test runner).
// Weather codes follow Open-Meteo's WMO interpretation code table.
export function weatherCondition(code, isDay = true) {
  const n = Number(code);
  if (n === 0) return { label: 'Clear skies', icon: isDay ? '☀️' : '🌙' };
  if (n === 1) return { label: 'Mostly clear', icon: isDay ? '🌤️' : '🌙' };
  if (n === 2) return { label: 'Partly cloudy', icon: isDay ? '⛅' : '☁️' };
  if (n === 3) return { label: 'Overcast', icon: '☁️' };
  if (n === 45 || n === 48) return { label: 'Fog', icon: '🌫️' };
  if ([51, 53, 55, 56, 57].includes(n)) return { label: 'Drizzle', icon: '🌦️' };
  if ([61, 63, 65, 66, 67].includes(n)) return { label: 'Rain', icon: '🌧️' };
  if ([71, 73, 75, 77, 85, 86].includes(n)) return { label: 'Snow', icon: '🌨️' };
  if ([80, 81, 82].includes(n)) return { label: 'Showers', icon: '🌦️' };
  if ([95, 96, 99].includes(n)) return { label: 'Thunderstorms', icon: '⛈️' };
  return { label: 'Weather unavailable', icon: '🌡️' };
}

export function roundLocation(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Invalid location coordinates.');
  }
  // A tenth of a degree is typically several miles. For general weather,
  // there is no need to send the browser's precise GPS fix to Open-Meteo.
  return { latitude: Math.round(latitude * 10) / 10, longitude: Math.round(longitude * 10) / 10 };
}

export function formatTemp(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°F` : '—';
}

export function parseForecast(payload) {
  if (!payload || !payload.current || !payload.daily ||
      !Array.isArray(payload.daily.time) || payload.daily.time.length < 5 ||
      typeof payload.current.temperature_2m !== 'number') {
    throw new Error('Weather service returned an incomplete forecast.');
  }
  const current = payload.current;
  const daily = payload.daily;
  const days = daily.time.slice(0, 5).map((date, index) => ({
    date,
    code: daily.weather_code?.[index] ?? -1,
    high: daily.temperature_2m_max?.[index] ?? null,
    low: daily.temperature_2m_min?.[index] ?? null,
    rainChance: daily.precipitation_probability_max?.[index] ?? null,
  }));
  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature ?? null,
    humidity: current.relative_humidity_2m ?? null,
    windMph: current.wind_speed_10m ?? null,
    condition: weatherCondition(current.weather_code, Boolean(current.is_day)),
    days, // Today + next four calendar days, in the location's own timezone.
    timezone: payload.timezone || '',
  };
}

export function formatLocationName(place) {
  return [place.name, place.admin1, place.country_code || place.country]
    .filter(Boolean).filter((item, index, items) => items.indexOf(item) === index).join(', ');
}
