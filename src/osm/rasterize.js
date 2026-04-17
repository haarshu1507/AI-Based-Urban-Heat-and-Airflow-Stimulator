import { ZONE } from './zone.js';
import { classifyOsmFeature, ZONE_PRIORITY } from './classify.js';

/** 3×3 subsamples per grid cell — reduces “wrong type from center point only” error on coarse grids. */
const SUB = 3;
/** Min subsamples that must be near a road (when polygon zone is empty) to mark the cell road. */
const ROAD_SAMPLE_MIN = 2;
/** Linear OSM waterways (river centerlines) — buffered onto grid when polygons miss large rivers. */
const WATER_SAMPLE_MIN = 2;

/**
 * Approximate planar distance (meters) from (lat,lon) to segment a–b.
 * Uses local scaling at the segment midpoint (adequate for city-scale cells).
 */
function pointToSegDistMeters(lat, lon, a, b) {
  const [alat, alon] = a;
  const [blat, blon] = b;
  const refLat = (alat + blat) * 0.5;
  const cos = Math.max(0.2, Math.cos((refLat * Math.PI) / 180));
  const k = 111320;
  const px = lon * k * cos;
  const py = lat * k;
  const x1 = alon * k * cos;
  const y1 = alat * k;
  const x2 = blon * k * cos;
  const y2 = blat * k;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1e-12;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny);
}

function minDistToPolylineMeters(lat, lon, pts) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointToSegDistMeters(lat, lon, pts[i], pts[i + 1]);
    if (d < m) m = d;
  }
  return m;
}

/**
 * Ray-casting point-in-polygon. ring: [lat, lon][]
 */
export function pointInPolygon(lat, lon, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1];
    const yi = ring[i][0];
    const xj = ring[j][1];
    const yj = ring[j][0];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 0e-18) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ringBoundingBox(ring) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [la, lo] of ring) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  return { minLat, maxLat, minLon, maxLon };
}

function cellBoundingBox(south, west, dLat, dLon, y, x) {
  return {
    minLat: south + y * dLat,
    maxLat: south + (y + 1) * dLat,
    minLon: west + x * dLon,
    maxLon: west + (x + 1) * dLon,
  };
}

function bboxesOverlap(a, b) {
  return !(a.maxLat < b.minLat || a.minLat > b.maxLat || a.maxLon < b.minLon || a.minLon > b.maxLon);
}

/** Signed area in (deg × deg) — only used for relative polygon size / tie-break. */
function ringAbsAreaDeg2(ring) {
  if (!ring || ring.length < 3) return 0;
  let n = ring.length;
  if (ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) n -= 1;
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += ring[j][1] * ring[i][0] - ring[i][1] * ring[j][0];
  }
  return Math.abs(a * 0.5);
}

/**
 * Best zone at a single point: max priority; ties → smaller polygon (more specific feature).
 */
function zoneAtPoint(lat, lon, classified) {
  const tiny = 1e-7;
  const probe = { minLat: lat - tiny, maxLat: lat + tiny, minLon: lon - tiny, maxLon: lon + tiny };
  let best = ZONE.EMPTY;
  let bestP = -1;
  let bestArea = Infinity;
  for (const f of classified) {
    if (f.zone === ZONE.EMPTY) continue;
    if (!bboxesOverlap(f._bbox, probe)) continue;
    if (!pointInPolygon(lat, lon, f.ring)) continue;
    const p = ZONE_PRIORITY[f.zone] ?? 0;
    const area = f._area;
    if (p > bestP || (p === bestP && area < bestArea)) {
      bestP = p;
      bestArea = area;
      best = f.zone;
    }
  }
  return best;
}

/**
 * Majority vote across samples; ties broken by ZONE_PRIORITY (then non-empty preferred).
 */
function aggregateZones(sampleZones) {
  const counts = new Map();
  for (const z of sampleZones) {
    if (z === ZONE.EMPTY) continue;
    counts.set(z, (counts.get(z) || 0) + 1);
  }
  if (counts.size === 0) return ZONE.EMPTY;
  let bestZ = ZONE.EMPTY;
  let bestC = -1;
  let bestP = -1;
  for (const [z, c] of counts) {
    const p = ZONE_PRIORITY[z] ?? 0;
    if (c > bestC || (c === bestC && p > bestP)) {
      bestC = c;
      bestZ = z;
      bestP = p;
    }
  }
  return bestZ;
}

function cellMetricDiagonalMeters(midLat, dLat, dLon) {
  const cos = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const k = 111320;
  return Math.hypot(dLat * k, dLon * k * cos);
}

/**
 * @param {{ latlngs: [number, number][], tags: Record<string,string> }[]} polygons
 * @param {{ latlngs: [number, number][], tags: Record<string,string> }[]} [lines]
 */
export function rasterizeToGrid(polygons, rows, cols, bbox, lines = []) {
  const { south, west, north, east } = bbox;
  const dLat = (north - south) / rows;
  const dLon = (east - west) / cols;
  const grid = [];

  const classified = polygons.map((f) => {
    const zone = classifyOsmFeature(f.tags);
    const ring = f.latlngs.slice(0, -1);
    const _bbox = ringBoundingBox(ring);
    const _area = ringAbsAreaDeg2(ring);
    return { ...f, zone, ring, _bbox, _area };
  });

  const roadLines = lines.filter((l) => l.tags?.highway);
  const waterLines = lines.filter((l) => l.tags?.waterway && !l.tags?.highway);

  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      const cbox = cellBoundingBox(south, west, dLat, dLon, y, x);
      const candidates = classified.filter((f) => f.zone !== ZONE.EMPTY && bboxesOverlap(f._bbox, cbox));

      const sampleZones = [];
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const lat = south + y * dLat + ((sy + 0.5) / SUB) * dLat;
          const lon = west + x * dLon + ((sx + 0.5) / SUB) * dLon;
          sampleZones.push(zoneAtPoint(lat, lon, candidates));
        }
      }

      grid[y][x] = aggregateZones(sampleZones);
    }
  }

  const waterLineThresholdMeters = (y, x) => {
    const midLat = south + (y + 0.5) * dLat;
    const diag = cellMetricDiagonalMeters(midLat, dLat, dLon);
    return Math.min(520, Math.max(50, diag * 0.52));
  };

  const roadThresholdMeters = (y, x) => {
    const midLat = south + (y + 0.5) * dLat;
    const diag = cellMetricDiagonalMeters(midLat, dLat, dLon);
    return Math.min(42, Math.max(14, diag * 0.26));
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== ZONE.EMPTY) continue;
      const thresh = waterLineThresholdMeters(y, x);
      let nearWater = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const lat = south + y * dLat + ((sy + 0.5) / SUB) * dLat;
          const lon = west + x * dLon + ((sx + 0.5) / SUB) * dLon;
          let dMin = Infinity;
          for (const ln of waterLines) {
            const d = minDistToPolylineMeters(lat, lon, ln.latlngs);
            if (d < dMin) dMin = d;
          }
          if (dMin < thresh) nearWater += 1;
        }
      }
      if (nearWater >= WATER_SAMPLE_MIN) grid[y][x] = ZONE.WATER;
    }
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== ZONE.EMPTY) continue;
      const thresh = roadThresholdMeters(y, x);
      let near = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const lat = south + y * dLat + ((sy + 0.5) / SUB) * dLat;
          const lon = west + x * dLon + ((sx + 0.5) / SUB) * dLon;
          let dMin = Infinity;
          for (const ln of roadLines) {
            const d = minDistToPolylineMeters(lat, lon, ln.latlngs);
            if (d < dMin) dMin = d;
          }
          if (dMin < thresh) near += 1;
        }
      }
      if (near >= ROAD_SAMPLE_MIN) grid[y][x] = ZONE.ROAD;
    }
  }

  return grid;
}
