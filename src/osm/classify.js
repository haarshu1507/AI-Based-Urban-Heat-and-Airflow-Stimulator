import { ZONE } from './zone.js';

/**
 * Map OSM tags → simulation zone type (priority handled in rasterizer).
 */
export function classifyOsmFeature(tags) {
  const t = tags || {};
  if (t.natural === 'water' || t.waterway) return ZONE.WATER;
  if (t.leisure === 'park') return ZONE.PARK;
  if (t.natural === 'wood' || t.landuse === 'forest') return ZONE.FOREST;
  if (t.landuse === 'industrial') return ZONE.INDUSTRY;
  if (t.highway) return ZONE.ROAD;
  if (t.building) {
    const levels = parseInt(t['building:levels'], 10);
    const h = parseFloat(t.height);
    if ((!Number.isNaN(levels) && levels >= 10) || (!Number.isNaN(h) && h >= 35))
      return ZONE.SKYSCRAPER;
    return ZONE.HOUSE;
  }
  return ZONE.EMPTY;
}

export { ZONE_PRIORITY } from './zone.js';
