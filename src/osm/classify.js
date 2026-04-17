import { ZONE } from './zone.js';

/**
 * Map OSM tags → simulation zone type (priority handled in rasterizer).
 */
export function classifyOsmFeature(tags) {
  const t = tags || {};
  if (
    t.natural === 'water' ||
    t.natural === 'bay' ||
    t.waterway === 'riverbank' ||
    t.waterway === 'dock' ||
    t.natural === 'wetland'
  )
    return ZONE.WATER;
  if (t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'nature_reserve') return ZONE.PARK;
  if (t.natural === 'wood' || t.landuse === 'forest' || t.natural === 'grassland' || t.landuse === 'meadow')
    return ZONE.FOREST;
  if (t.landuse === 'industrial' || t.landuse === 'railway') return ZONE.INDUSTRY;
  if (t.landuse === 'construction') return ZONE.HOUSE;
  if (t.landuse === 'commercial' || t.landuse === 'retail') return ZONE.SKYSCRAPER;
  if (t.landuse === 'residential') return ZONE.HOUSE;
  if (t.highway) return ZONE.ROAD;
  if (t.building) {
    const levels = parseInt(t['building:levels'], 10);
    const h = parseFloat(t.height);
    const kind = `${t.building}`.toLowerCase();
    if (
      (!Number.isNaN(levels) && levels >= 10) ||
      (!Number.isNaN(h) && h >= 35) ||
      /(commercial|retail|office|industrial|warehouse|apartments|hotel)/.test(kind)
    )
      return ZONE.SKYSCRAPER;
    return ZONE.HOUSE;
  }
  return ZONE.EMPTY;
}

export { ZONE_PRIORITY } from './zone.js';
