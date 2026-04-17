import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet/dist/leaflet-src.js';
import 'leaflet/dist/leaflet.css';
import {
  buildOverpassQuery,
  fetchOverpassJson,
  elementsToFeatures,
  DEFAULT_BBOX,
} from '../osm/overpass.js';
import { rasterizeToGrid } from '../osm/rasterize.js';

const TYPE_ICONS = {
  empty: null,
  house: '🏠',
  skyscraper: '🏢',
  park: '🌳',
  forest: '🌲',
  water: '🟦',
  road: '⬛',
  industry: '🏭',
};

const VIEW_2D_FILL = '#1e293b';

function windToCompass(windDirection) {
  const m = { right: 'E', left: 'W', up: 'N', down: 'S' };
  return m[windDirection] || 'E';
}

function cellBounds(bbox, y, x, rows, cols) {
  const { south, west, north, east } = bbox;
  const dLat = (north - south) / rows;
  const dLon = (east - west) / cols;
  const sw = [south + y * dLat, west + x * dLon];
  const se = [south + y * dLat, west + (x + 1) * dLon];
  const ne = [south + (y + 1) * dLat, west + (x + 1) * dLon];
  const nw = [south + (y + 1) * dLat, west + x * dLon];
  return [nw, ne, se, sw];
}

function cellCenter(bbox, y, x, rows, cols) {
  const { south, west, north, east } = bbox;
  const dLat = (north - south) / rows;
  const dLon = (east - west) / cols;
  return [south + (y + 0.5) * dLat, west + (x + 0.5) * dLon];
}

function latLngToCell(lat, lon, bbox, rows, cols) {
  const { south, west, north, east } = bbox;
  const dLat = (north - south) / rows;
  const dLon = (east - west) / cols;
  let x = Math.floor((lon - west) / dLon);
  let y = Math.floor((lat - south) / dLat);
  x = Math.max(0, Math.min(cols - 1, x));
  y = Math.max(0, Math.min(rows - 1, y));
  return { x, y };
}

function heatFill(norm) {
  const n = Math.max(0, Math.min(1, norm));
  const hue = (1 - n) * 240;
  return `hsl(${hue}, 100%, 50%)`;
}

function airflowFill(flow) {
  const f = Math.max(0, Math.min(5, flow));
  const hue = (f / 5) * 120;
  return `hsl(${hue}, 100%, 35%)`;
}

/**
 * OpenStreetMap view: pan/zoom, load visible area into the shared 15×15 grid.
 * Overlay stays in sync with grid, heat, and airflow from the main app.
 */
const VIZ_LABELS = {
  '2D': '2D View',
  heatmap: 'Heatmap',
  airflow: 'Airflow',
  weather: 'Weather',
  '3D': '3D View',
  select: 'Select',
};

export default function RealWorldMap({
  grid,
  heatData,
  airflowData,
  windDirection,
  viewMode = '2D',
  geoBbox,
  onGeoBboxChange,
  onApplyOsmTypes,
  onCellClick,
  highlightedCells = [],
  gridSize = 15,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const windLayerRef = useRef(null);
  const [loadState, setLoadState] = useState('idle');
  const [loadError, setLoadError] = useState(null);

  const rows = grid?.length || gridSize;
  const cols = grid?.[0]?.length || gridSize;
  const bbox = geoBbox || DEFAULT_BBOX;
  const compass = windToCompass(windDirection);

  const typeGrid = useMemo(
    () => (grid?.length ? grid.map((row) => row.map((c) => c.type)) : null),
    [grid]
  );
  const highlightKeys = useMemo(
    () => new Set((highlightedCells ?? []).map(([r, c]) => `${r},${c}`)),
    [highlightedCells]
  );

  const isAirflowViz = viewMode === 'airflow';
  const isHeatmapViz = viewMode === 'heatmap';
  /** Match GridCanvas: 2D / weather / 3D / select use heat-tinted cells + land-use icons */
  const showLandUseIcons =
    viewMode === '2D' ||
    viewMode === 'weather' ||
    viewMode === '3D' ||
    viewMode === 'select';
  const useHeatFill = isHeatmapViz || showLandUseIcons;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;
    const center = [(bbox.south + bbox.north) / 2, (bbox.west + bbox.east) / 2];
    const map = L.map(el, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(center, geoBbox ? 15 : 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    windLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      windLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoBbox) return;
    try {
      map.fitBounds(
        [
          [geoBbox.south, geoBbox.west],
          [geoBbox.north, geoBbox.east],
        ],
        { padding: [24, 24], maxZoom: 17 }
      );
    } catch {
      /* ignore */
    }
    setTimeout(() => map.invalidateSize(), 200);
  }, [geoBbox]);

  const drawWindArrows = useCallback(() => {
    const map = mapRef.current;
    const wl = windLayerRef.current;
    if (!map || !wl) return;
    wl.clearLayers();
    const { south, west, north, east } = bbox;
    const cx = (south + north) / 2;
    const cy = (west + east) / 2;
    const dir = { N: [0.002, 0], S: [-0.002, 0], E: [0, 0.002], W: [0, -0.002] };
    const [dlat, dlon] = dir[compass] || dir.E;
    const start = [cx - dlat * 3, cy - dlon * 3];
    const end = [cx + dlat * 3, cy + dlon * 3];
    L.polyline([start, end], { color: '#22d3ee', weight: 3, opacity: 0.9 }).addTo(wl);
    L.circleMarker(end, { radius: 4, color: '#06b6d4', fillOpacity: 1 }).addTo(wl);
  }, [bbox, compass]);

  useEffect(() => {
    drawWindArrows();
  }, [drawWindArrows]);

  const redrawCells = useCallback(() => {
    const map = mapRef.current;
    const lg = layerGroupRef.current;
    if (!map || !lg || !typeGrid || !geoBbox) {
      if (lg) lg.clearLayers();
      return;
    }
    lg.clearLayers();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const latlngs = cellBounds(geoBbox, y, x, rows, cols);
        let fill;
        if (isAirflowViz && airflowData?.[y]?.[x] !== undefined) {
          fill = airflowFill(airflowData[y][x]);
        } else if (useHeatFill && heatData?.normalizedGrid?.[y]?.[x]) {
          fill = heatFill(heatData.normalizedGrid[y][x].norm);
        } else {
          fill = VIEW_2D_FILL;
        }
        const isHighlighted = highlightKeys.has(`${y},${x}`);
        const poly = L.polygon(latlngs, {
          color: isHighlighted ? '#22d3ee' : '#0f172a',
          className: isHighlighted ? 'uhi-map-highlight' : '',
          fillColor: fill,
          fillOpacity: isHighlighted ? 0.98 : showLandUseIcons ? 0.88 : 0.82,
          weight: isHighlighted ? 3 : 1,
        });
        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const { lat, lng } = e.latlng;
          const cell = latLngToCell(lat, lng, geoBbox, rows, cols);
          onCellClick?.(cell.y, cell.x);
        });
        const t = typeGrid[y][x];
        const hi = heatData?.normalizedGrid?.[y]?.[x];
        const af = airflowData?.[y]?.[x];
        let tipHtml;
        if (isAirflowViz && af != null) {
          tipHtml = `<div style="font-size:11px;line-height:1.35;color:#0f172a">Type: ${t} | Airflow: ${af}</div>`;
        } else if (useHeatFill && hi != null) {
          tipHtml = `<div style="font-size:11px;line-height:1.35;color:#0f172a">Type: ${t} | Temp: ${hi.val.toFixed(1)}°C</div>`;
        } else {
          tipHtml = `<div style="font-size:11px;line-height:1.35;color:#0f172a">Type: ${t}</div>`;
        }
        poly.bindTooltip(tipHtml, { sticky: true, opacity: 0.95, className: 'uhi-map-tip' });
        poly.addTo(lg);

        if (showLandUseIcons && !isHeatmapViz) {
          const iconChar = TYPE_ICONS[t] ?? null;
          const center = cellCenter(geoBbox, y, x, rows, cols);
          const html = iconChar
            ? `<div style="display:flex;align-items:center;justify-content:center;font-size:16px;width:24px;height:24px;line-height:1;pointer-events:none">${iconChar}</div>`
            : `<div style="width:1px;height:1px;pointer-events:none"></div>`;
          L.marker(center, {
            icon: L.divIcon({
              className: 'uhi-2d-marker',
              html,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
            interactive: false,
          }).addTo(lg);
        }
      }
    }
  }, [
    typeGrid,
    geoBbox,
    isAirflowViz,
    isHeatmapViz,
    showLandUseIcons,
    useHeatFill,
    heatData,
    airflowData,
    highlightKeys,
    onCellClick,
    rows,
    cols,
  ]);

  useEffect(() => {
    redrawCells();
  }, [redrawCells]);

  const handleLoadVisibleArea = async () => {
    const map = mapRef.current;
    if (!map) return;
    setLoadError(null);
    setLoadState('loading');
    try {
      const b = map.getBounds();
      const nextBbox = {
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      };
      const query = buildOverpassQuery(nextBbox);
      const data = await fetchOverpassJson(query, 35000);
      const { polygons, lines } = elementsToFeatures(data);
      const types = rasterizeToGrid(polygons, rows, cols, nextBbox, lines);
      onGeoBboxChange?.(nextBbox);
      onApplyOsmTypes?.(types);
      setLoadState('idle');
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Failed to load OSM data');
      setLoadState('error');
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-slate-700/80 bg-slate-950">
      <div className="flex flex-shrink-0 flex-col gap-2 border-b border-slate-700/80 bg-slate-900/95 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Real world · OpenStreetMap
            </p>
            <p className="text-xs text-slate-300">
              {geoBbox
                ? 'Grid locked to map bounds — same data as 2D / 3D'
                : 'Pan & zoom, then load the visible area into the city grid'}
            </p>
            <p className="mt-1 text-[10px] text-cyan-400/90">
              Mode: <span className="font-semibold text-cyan-300">{VIZ_LABELS[viewMode] || viewMode}</span>
              {viewMode === 'select' ? (
                <>
                  {' · '}
                  After loading OSM, choose <span className="font-semibold text-white">2D View</span> in the
                  dropdown to edit the grid
                </>
              ) : (
                <> · matches visualization</>
              )}
            </p>
            {loadError ? <p className="mt-1 text-[11px] text-rose-400">{loadError}</p> : null}
          </div>
          <button
            type="button"
            disabled={loadState === 'loading'}
            onClick={handleLoadVisibleArea}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white shadow transition hover:bg-cyan-500 disabled:opacity-50"
          >
            {loadState === 'loading' ? 'Loading OSM…' : 'Load visible area → grid'}
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="min-h-[280px] w-full flex-1"
        style={{ minHeight: 'min(52vh, 560px)' }}
      />
    </div>
  );
}
