import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather, searchCities } from './weatherApi.js';

const mockWeather = {
  timezone: 'America/Detroit',
  current: { temperature_2m: 68, weather_code: 0, is_day: 1 },
  daily: {
    time: ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'],
    weather_code: [0, 1, 2, 3, 45],
    temperature_2m_max: [70, 71, 72, 73, 74],
    temperature_2m_min: [50, 51, 52, 53, 54],
  },
};

test('weather request uses rounded coordinates, Fahrenheit, and five days', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => mockWeather };
  };
  try {
    const data = await fetchWeather(42.2808, -83.7430);
    assert.equal(requested.searchParams.get('latitude'), '42.3');
    assert.equal(requested.searchParams.get('longitude'), '-83.7');
    assert.equal(requested.searchParams.get('forecast_days'), '5');
    assert.equal(requested.searchParams.get('temperature_unit'), 'fahrenheit');
    assert.equal(requested.searchParams.get('timezone'), 'auto');
    assert.equal(data.days.length, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('city lookup limits results and does not request one-letter names', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async (url) => {
    callCount += 1;
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('name'), 'Ann Arbor');
    assert.equal(parsed.searchParams.get('count'), '5');
    return { ok: true, json: async () => ({ results: [
      { name: 'Ann Arbor', latitude: 42.28, longitude: -83.74 },
      { name: 'Bad coords', latitude: null, longitude: undefined },
    ] }) };
  };
  try {
    assert.deepEqual(await searchCities('A'), []);
    assert.equal(callCount, 0);
    const matches = await searchCities('Ann Arbor');
    assert.equal(matches.length, 1);
    assert.equal(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
