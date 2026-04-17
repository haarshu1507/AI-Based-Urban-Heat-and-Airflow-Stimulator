const DEFAULT_BBOX = { south: 28.6, west: 77.2, north: 28.65, east: 77.25 };

/**
 * Overpass QL for bbox: buildings, industry, parks, water, green, roads.
 */
export function buildOverpassQuery(bbox = DEFAULT_BBOX) {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:180];
(
  way["building"](${south},${west},${north},${east});
  way["landuse"="industrial"](${south},${west},${north},${east});
  way["leisure"="park"](${south},${west},${north},${east});
  way["natural"="water"](${south},${west},${north},${east});
  way["natural"="wood"](${south},${west},${north},${east});
  way["landuse"="forest"](${south},${west},${north},${east});
  way["highway"~"primary|secondary|tertiary|residential|unclassified"](${south},${west},${north},${east});
);
out geom;
`;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postOverpass(url, query, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: query,
      signal: controller.signal,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    });
    clearTimeout(id);
    const text = await res.text();
    return { res, text };
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

/**
 * @returns {Promise<{ elements: unknown[] }>}
 */
export async function fetchOverpassJson(query, timeoutMs = 25000) {
  const failures = [];

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const url = OVERPASS_ENDPOINTS[i];
    try {
      const { res, text } = await postOverpass(url, query, timeoutMs);
      if (!res.ok) {
        failures.push(`${new URL(url).host} → HTTP ${res.status}`);
        if (res.status === 429 || res.status >= 500) {
          await delay(800 * (i + 1));
        }
        continue;
      }
      if (text.trim().startsWith('<')) {
        failures.push(`${new URL(url).host} → XML/error body`);
        continue;
      }
      try {
        const data = JSON.parse(text);
        if (i > 0) {
          console.info(`[OSM] Loaded via mirror: ${new URL(url).host}`);
        }
        return data;
      } catch {
        failures.push(`${new URL(url).host} → invalid JSON`);
      }
    } catch (e) {
      const name = new URL(url).host;
      if (e?.name === 'AbortError') {
        failures.push(`${name} → timed out (${timeoutMs / 1000}s)`);
      } else {
        failures.push(`${name} → ${e?.message || 'network error'}`);
      }
    }
  }

  console.warn(
    '[OSM] All Overpass mirrors failed — using empty grid. Details:',
    failures.join(' | ')
  );
  return { elements: [] };
}

export function elementsToFeatures(osmData) {
  const polygons = [];
  const lines = [];
  const elements = osmData?.elements ?? [];
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const latlngs = el.geometry.map((p) => [p.lat, p.lon]);
    const tags = el.tags || {};
    const last = latlngs[latlngs.length - 1];
    const closed =
      latlngs.length > 1 &&
      Math.abs(latlngs[0][0] - last[0]) < 1e-7 &&
      Math.abs(latlngs[0][1] - last[1]) < 1e-7;
    if (tags.highway && !closed) {
      lines.push({ latlngs, tags, id: el.id });
    } else {
      let ring = closed ? latlngs.slice(0, -1) : [...latlngs];
      if (!closed && tags.building && ring.length >= 3) {
        ring = [...ring, ring[0]];
      }
      if (ring.length > 2) {
        const first = ring[0];
        const rlast = ring[ring.length - 1];
        const needClose =
          Math.abs(first[0] - rlast[0]) > 1e-7 || Math.abs(first[1] - rlast[1]) > 1e-7;
        polygons.push({
          latlngs: needClose ? [...ring, first] : ring,
          tags,
          id: el.id,
        });
      }
    }
  }
  return { polygons, lines };
}

export { DEFAULT_BBOX };
