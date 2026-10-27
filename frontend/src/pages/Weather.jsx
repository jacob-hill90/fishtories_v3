import { useEffect, useRef, useState } from 'react';
import { formatTemp, formatLocationName, weatherCondition } from '../weather/weather.js';
import './weather.css';

function dayLabel(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? isoDate
    : new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function Weather({ weather, onUseMyLocation, onChooseCity, searchCities }) {
  const [cityQuery, setCityQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cityError, setCityError] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [runImmediately, setRunImmediately] = useState(0);
  const searchController = useRef(null);
  const searchArea = useRef(null);
  const selectedRef = useRef(false);
  const resultCache = useRef(new Map());

  // Never query for one letter. Debounce and cancel earlier requests, so a
  // slower response for "Ann" cannot overwrite new results for "Ann Arbor".
  useEffect(() => {
    const query = cityQuery.trim();
    if (!suggestionsOpen || selectedRef.current || query.length < 2) return undefined;

    const controller = new AbortController();
    searchController.current?.abort();
    searchController.current = controller;
    const timer = window.setTimeout(async () => {
      const key = query.toLowerCase();
      const cached = resultCache.current.get(key);
      if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
        if (!controller.signal.aborted) setMatches(cached.results);
        return;
      }
      setSearching(true);
      setCityError('');
      try {
        const results = await searchCities(query, { signal: controller.signal });
        if (controller.signal.aborted) return;
        resultCache.current.set(key, { results, time: Date.now() });
        setMatches(results);
        setActiveIndex(-1);
        if (!results.length) setCityError('No cities found. Try adding a state or country.');
      } catch (error) {
        if (!controller.signal.aborted) {
          setMatches([]);
          setCityError(error.message || 'Unable to search cities.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, runImmediately ? 0 : 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [cityQuery, runImmediately, searchCities, suggestionsOpen]);

  useEffect(() => {
    function closeOnOutsidePointer(event) {
      if (!searchArea.current?.contains(event.target)) setSuggestionsOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  function onQueryChange(event) {
    searchController.current?.abort();
    selectedRef.current = false;
    setCityQuery(event.target.value);
    setMatches([]);
    setSearching(false);
    setActiveIndex(-1);
    setCityError('');
    setSuggestionsOpen(true);
    setRunImmediately(0);
  }

  function chooseCity(city) {
    searchController.current?.abort();
    selectedRef.current = true;
    setCityQuery(formatLocationName(city));
    setMatches([]);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    setSearching(false);
    setCityError('');
    onChooseCity(city);
  }

  function onSearch(event) {
    event.preventDefault();
    const query = cityQuery.trim();
    if (suggestionsOpen && matches.length) {
      chooseCity(matches[activeIndex >= 0 ? activeIndex : 0]);
      return;
    }
    if (query.length < 2) {
      setCityError('Enter at least two characters of a city name.');
      return;
    }
    selectedRef.current = false;
    setSuggestionsOpen(true);
    setRunImmediately((previous) => previous + 1);
  }

  function onCityKeyDown(event) {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      return;
    }
    if (!suggestionsOpen || !matches.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((previous) => (previous + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previous) => (previous - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseCity(matches[activeIndex >= 0 ? activeIndex : 0]);
    }
  }

  const { status, data, locationName, error } = weather;
  const busy = status === 'locating' || status === 'loading';
  const showSuggestions = suggestionsOpen && cityQuery.trim().length >= 2 && (matches.length > 0 || searching || cityError);

  return (
    <section className="weather-page">
      <div className="weather-container">
        <p className="eyebrow eyebrow-dark">ANGLER'S WEATHER</p>
        <h1>Weather for your next adventure.</h1>
        <p className="weather-lede">See current conditions and the forecast for the next four days. Your selected location is used for weather only—not shared with the Community Map.</p>

        <div className="weather-location-controls">
          <div>
            <h2>Choose a location</h2>
            <p>Your browser will ask permission the first time you use your location. We use an approximate area, not your precise fishing spot.</p>
            <button type="button" className="button button-primary" onClick={onUseMyLocation} disabled={busy}>
              📍 Use my location
            </button>
          </div>
          <form onSubmit={onSearch} className="weather-city-form" ref={searchArea}>
            <label htmlFor="weather-city">Or find a city</label>
            <div className="weather-city-input-row">
              <input id="weather-city" value={cityQuery} maxLength={100} onChange={onQueryChange}
                onFocus={() => { if (!selectedRef.current) setSuggestionsOpen(true); }}
                onKeyDown={onCityKeyDown} placeholder="Start typing a city…" autoComplete="off"
                role="combobox" aria-autocomplete="list" aria-haspopup="listbox"
                aria-expanded={Boolean(showSuggestions)} aria-controls="weather-city-suggestions"
                aria-activedescendant={showSuggestions && activeIndex >= 0 ? `weather-city-option-${activeIndex}` : undefined} />
              <button className="button button-secondary" type="submit" disabled={searching}>
                {searching ? 'Searching…' : 'Find cities'}
              </button>
            </div>
            <small className="weather-city-hint">Suggestions appear as you type. Select a city to view its forecast.</small>
            {cityError && cityQuery.trim().length < 2 && <p role="alert" className="weather-message weather-error">{cityError}</p>}
            {showSuggestions && (
              <ul id="weather-city-suggestions" className="weather-city-results" role="listbox" aria-label="Matching cities">
                {searching && <li className="weather-city-feedback" role="presentation">Finding cities…</li>}
                {!searching && cityError && <li className="weather-city-feedback" role="presentation">{cityError}</li>}
                {!searching && matches.map((city, index) => (
                  <li key={city.id || `${city.latitude}-${city.longitude}`} role="presentation">
                    <button id={`weather-city-option-${index}`} type="button" role="option"
                      aria-selected={activeIndex === index} className={activeIndex === index ? 'is-active' : ''}
                      onMouseEnter={() => setActiveIndex(index)} onClick={() => chooseCity(city)}>
                      <span>{city.name}</span><small>{[city.admin1, city.country].filter(Boolean).join(', ')}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>

        {busy && <p className="weather-message" role="status">{status === 'locating' ? 'Checking your browser location…' : 'Loading the latest weather…'}</p>}
        {status === 'idle' && <p className="weather-message">Select <strong>Use my location</strong> or search for a city to get started.</p>}
        {status === 'error' && <p className="weather-message weather-error" role="alert">{error}</p>}

        {status === 'ready' && data && <>
          <div className="weather-current">
            <div>
              <p className="eyebrow">CURRENT CONDITIONS</p>
              <h2>{locationName}</h2>
              <div className="weather-current-main">
                <span className="weather-current-icon" role="img" aria-label={data.condition.label}>{data.condition.icon}</span>
                <strong>{formatTemp(data.temperature)}</strong>
              </div>
              <p className="weather-condition-name">{data.condition.label}</p>
            </div>
            <div className="weather-current-details">
              <div><span>Feels like</span><strong>{formatTemp(data.feelsLike)}</strong></div>
              <div><span>Humidity</span><strong>{Number.isFinite(data.humidity) ? `${Math.round(data.humidity)}%` : '—'}</strong></div>
              <div><span>Wind</span><strong>{Number.isFinite(data.windMph) ? `${Math.round(data.windMph)} mph` : '—'}</strong></div>
            </div>
          </div>

          <div className="weather-forecast-header">
            <h2>Next four days</h2>
            <p>Daily highs, lows, and chance of precipitation</p>
          </div>
          <div className="weather-forecast-grid">
            {data.days.slice(1, 5).map((day) => {
              const condition = weatherCondition(day.code);
              return (
                <article className="weather-day" key={day.date}>
                  <time dateTime={day.date}>{dayLabel(day.date)}</time>
                  <span className="weather-day-icon" role="img" aria-label={condition.label}>{condition.icon}</span>
                  <strong>{condition.label}</strong>
                  <div className="weather-day-temps"><span>↑ {formatTemp(day.high)}</span><span>↓ {formatTemp(day.low)}</span></div>
                  <small>☔ {Number.isFinite(day.rainChance) ? `${Math.round(day.rainChance)}%` : 'N/A'} chance</small>
                </article>
              );
            })}
          </div>
        </>}

        <p className="weather-attribution">
          Weather and city data: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">Open-Meteo</a> ·
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer noopener"> CC BY 4.0</a>.
          Weather forecasts are estimates; check local alerts before heading out.
        </p>
      </div>
    </section>
  );
}
