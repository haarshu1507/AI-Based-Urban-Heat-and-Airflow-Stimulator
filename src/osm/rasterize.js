import { ZONE } from './zone.js';
import { classifyOsmFeature, ZONE_PRIORITY } from './classify.js';

function pointToSegDistLatLon(lat, lon, a, b) {
  const [alat, alon] = a;
  const [blat, blon] = b;
  const px = lon,
    py = lat;
  const x1 = alon,
    y1 = alat,
    x2 = blon,
    y2 = blat;
  const dx = x2 - x1,
    dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1e-12;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx,
    ny = y1 + t * dy;
  const d = Math.hypot(px - nx, py - ny);
  return d;
}

function minDistToPolyline(lat, lon, pts) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointToSegDistLatLon(lat, lon, pts[i], pts[i + 1]);
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
    const xi = ring[i][1],
      yi = ring[i][0];
    const xj = ring[j][1],
      yj = ring[j][0];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 0e-18) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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
  const classified = polygons.map((f) => ({
    ...f,
    zone: classifyOsmFeature(f.tags),
    ring: f.latlngs.slice(0, -1),
  }));
  const roadLines = lines.filter((l) => l.tags?.highway);

  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      const lat = south + (y + 0.5) * dLat;
      const lon = west + (x + 0.5) * dLon;
      let best = ZONE.EMPTY;
      let bestP = -1;
      for (const f of classified) {
        if (f.zone === ZONE.EMPTY) continue;
        if (pointInPolygon(lat, lon, f.ring)) {
          const p = ZONE_PRIORITY[f.zone] ?? 0;
          if (p >= bestP) {
            bestP = p;
            best = f.zone;
          }
        }
      }
      grid[y][x] = best;
    }
  }

  const roadThreshold = Math.max(dLat, dLon) * 0.35;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== ZONE.EMPTY) continue;
      const lat = south + (y + 0.5) * dLat;
      const lon = west + (x + 0.5) * dLon;
      for (const ln of roadLines) {
        if (minDistToPolyline(lat, lon, ln.latlngs) < roadThreshold) {
          grid[y][x] = ZONE.ROAD;
          break;
        }
      }
    }
  }
  return grid;
}
