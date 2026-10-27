// Keep in sync with prepare_fish_photos.py's slug function.
export function speciesSlug(name) {
  return String(name ?? '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
