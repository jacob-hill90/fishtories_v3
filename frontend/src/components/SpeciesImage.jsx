import speciesImages from '../data/species-images.json';
import { speciesSlug } from '../utils/speciesSlug.js';

/**
 * Static field-guide art. Never use this for private user-uploaded catch images.
 * A blank manifest displays the existing fish.svg until photos are prepared.
 */
export default function SpeciesImage({ name, className = '', alt = '', loading = 'lazy' }) {
  const imageUrl = speciesImages[speciesSlug(name)] || '/fish.svg';
  return <img className={className} src={imageUrl} alt={alt} loading={loading} />;
}
