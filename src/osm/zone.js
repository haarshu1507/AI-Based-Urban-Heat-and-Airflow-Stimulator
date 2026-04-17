/** Zone type strings — matches 2D-Urban grid `cell.type` and OSM classifier. */

export const ZONE = {
  EMPTY: 'empty',
  HOUSE: 'house',
  SKYSCRAPER: 'skyscraper',
  PARK: 'park',
  FOREST: 'forest',
  WATER: 'water',
  ROAD: 'road',
  INDUSTRY: 'industry',
};

/** Higher index wins when multiple polygons cover a point */
export const ZONE_PRIORITY = {
  [ZONE.EMPTY]: 0,
  [ZONE.ROAD]: 1,
  [ZONE.HOUSE]: 2,
  [ZONE.SKYSCRAPER]: 3,
  [ZONE.INDUSTRY]: 4,
  [ZONE.PARK]: 5,
  [ZONE.FOREST]: 6,
  [ZONE.WATER]: 7,
};
