import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocationName, formatTemp, parseForecast, roundLocation, weatherCondition } from './weather.js';

test('converts WMO codes into matching weather icons and labels', () => {
  assert.deepEqual(weatherCondition(0, true), { label: 'Clear skies', icon: '☀️' });
  assert.deepEqual(weatherCondition(0, false), { label: 'Clear skies', icon: '🌙' });
  assert.equal(weatherCondition(95).label, 'Thunderstorms');
  assert.equal(weatherCondition(71).label, 'Snow');
  assert.equal(weatherCondition(999).label, 'Weather unavailable');
});

test('rounds coordinates to reduce precision before weather requests', () => {
  assert.deepEqual(roundLocation(42.2808, -83.7430), { latitude: 42.3, longitude: -83.7 });
  assert.throws(() => roundLocation(91, 0), /Invalid location/);
  assert.throws(() => roundLocation(Infinity, 0), /Invalid location/);
});

test('parses current and five daily forecasts', () => {
  const forecast = parseForecast({
    timezone: 'America/Detroit',
    current: { temperature_2m: 54.9, apparent_temperature: 53, weather_code: 1, is_day: 1, relative_humidity_2m: 70, wind_speed_10m: 4 },
    daily: {
      time: ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'],
      weather_code: [1, 2, 3, 45, 61],
      temperature_2m_max: [50, 55, 60, 65, 70], temperature_2m_min: [31, 35, 40, 45, 50],
      precipitation_probability_max: [5, 10, 15, 20, 70],
    },
  });
  assert.equal(forecast.temperature, 54.9);
  assert.equal(forecast.days.length, 5);
  assert.equal(forecast.days[4].date, '2026-10-31');
  assert.equal(forecast.days[1].high, 55);
  assert.equal(formatTemp(forecast.temperature), '55°F');
});

test('rejects an incomplete forecast gracefully', () => {
  assert.throws(() => parseForecast({ current: { temperature_2m: 75 }, daily: { time: ['2026-10-27'] } }), /incomplete/);
});

test('formats searched city names for the display', () => {
  assert.equal(formatLocationName({ name: 'Ann Arbor', admin1: 'Michigan', country_code: 'US' }), 'Ann Arbor, Michigan, US');
});
