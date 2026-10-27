import { useEffect, useState } from 'react';
import { getFishSpecies } from '../api/client.js';
import SpeciesImage from '../components/SpeciesImage.jsx';
import './fish.css';

export default function FishDatabase({ onNavigate, user }) {
  const [query, setQuery] = useState('');
  const [fish, setFish] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      getFishSpecies(query, { signal: controller.signal })
        .then(setFish)
        .catch((err) => {
          if (!controller.signal.aborted) setError(err.message || 'Unable to load fish.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <section className="fish-page">
      <div className="fish-container">
        <p className="eyebrow eyebrow-dark">EXPLORE THE WATER</p>
        <div className="fish-header">
          <div>
            <h1>Fish Database</h1>
            <p>Look up common fish species and their scientific names. This starter catalog will grow with Fishtories.</p>
          </div>
          {user && <button className="button button-primary" type="button" onClick={() => onNavigate('/catches')}>Log a catch</button>}
        </div>
        <label className="fish-search-label" htmlFor="fish-query">Search fish species</label>
        <input id="fish-query" className="fish-search" type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} placeholder="Try bass, trout, walleye or a scientific name" />
        {error && <p role="alert" className="form-error">{error}</p>}
        {loading ? <p role="status" className="fish-status">Searching the Fish Database…</p>
          : !error && fish.length === 0 ? <p className="fish-status">No matching species yet. You can still type a custom species when logging a catch.</p>
          : !error && <>
            <p className="fish-count">{fish.length} matching species{fish.length === 75 ? ' (showing first 75)' : ''}</p>
            <ul className="fish-grid">
              {fish.map((species) => <li key={species.id} className="fish-card">
                <SpeciesImage name={species.common_name} className="fish-card-image" alt={`Illustration of ${species.common_name}`} />
                <h2>{species.common_name}</h2>
                <p>{species.scientific_name || 'Scientific name coming soon'}</p>
              </li>)}
            </ul>
          </>}
        <p className="fish-footnote">Don't see your fish? You can still add any species to your private catch journal.</p>
      </div>
    </section>
  );
}
