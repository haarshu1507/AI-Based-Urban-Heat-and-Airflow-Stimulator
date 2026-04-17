import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import GridCanvas from './components/GridCanvas';
import ControlPanel from './components/ControlPanel';
import InsightsPanel from './components/InsightsPanel';
import City3D from './components/City3D';
import { calculateHeatGrid, normalizeHeatGrid } from './heatEngine';
import { calculateAirflowGrid } from './airflowEngine';
import { calculateMetrics } from './metrics';
import { getAISuggestions } from './aiService';
import { getRandomCityLayout } from './cityLayouts';
import { fetchWeather } from './services/weatherService';
import { calculateCarbon } from './engine/carbonEngine';
import WeatherOverlay from './components/WeatherOverlay';
import MapViewLegend from './components/MapViewLegend';
import RealWorldMap from './components/RealWorldMap';

const LEFT_PANEL_KEY = 'uhs-2d-left';
const RIGHT_PANEL_KEY = 'uhs-2d-right';
const LEFT_PANEL_MIN = 260;
const LEFT_PANEL_MAX = 520;
const RIGHT_PANEL_MIN = 280;
const RIGHT_PANEL_MAX = 560;
const LEFT_PANEL_DEFAULT = 330;
const RIGHT_PANEL_DEFAULT = 350;

function clampPanel(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function readStoredPanelWidth(key, fallback, lo, hi) {
  if (typeof window === 'undefined') return fallback;
  const n = Number(localStorage.getItem(key));
  if (!Number.isFinite(n)) return fallback;
  return clampPanel(n, lo, hi);
}

const GRID_SIZE = 15;
const DEFAULT_WEATHER_CITY = 'Allahabad';

const AI_HIGHLIGHT_MAX = 48;
const AI_HIGHLIGHT_MS = 4500;
const CARBON_HOTSPOT_HEAT_NORM = 0.7;
const CARBON_HOTSPOT_EMISSION_WEIGHT = 6;

/** Map an AI suggestion type to grid cells so the user can see where it applies. */
function cellsForAISuggestion(suggestion, grid, heatData, airflowData) {
  if (!suggestion?.type || !grid?.length) return [];
  const type = suggestion.type;
  const cells = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      switch (type) {
        case 'pollution':
          if (cell.type === 'industry') cells.push([r, c]);
          break;
        case 'greenery':
          if (cell.type === 'empty' || cell.type === 'park' || cell.type === 'forest') cells.push([r, c]);
          break;
        case 'heat':
          if (heatData?.normalizedGrid?.[r]?.[c]?.norm > 0.55) cells.push([r, c]);
          else if (cell.type === 'industry' || cell.type === 'skyscraper') cells.push([r, c]);
          break;
        case 'airflow':
          if (cell.type === 'skyscraper' || cell.type === 'industry') cells.push([r, c]);
          else if (airflowData?.[r]?.[c] !== undefined && airflowData[r][c] <= 1) cells.push([r, c]);
          break;
        case 'density':
          if (cell.type === 'house' || cell.type === 'skyscraper') cells.push([r, c]);
          break;
        case 'sustainability':
          if (cell.type === 'empty' || cell.type === 'road' || cell.type === 'industry') cells.push([r, c]);
          break;
        default:
          break;
      }
    }
  }
  const seen = new Set();
  const deduped = [];
  for (const [r, c] of cells) {
    const k = `${r},${c}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push([r, c]);
    if (deduped.length >= AI_HIGHLIGHT_MAX) break;
  }
  return deduped;
}

const createEmptyGrid = () => {
  const grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      row.push({ type: 'empty' });
    }
    grid.push(row);
  }
  return grid;
};

function emissionWeightByType(type) {
  switch (type) {
    case 'industry':
      return 10;
    case 'skyscraper':
      return 6;
    case 'house':
      return 3;
    case 'road':
      return 4;
    default:
      return 0;
  }
}

const App = () => {
  const [grid, setGrid] = useState(createEmptyGrid());
  const [selectedTool, setSelectedTool] = useState('house');
  const [viewMode, setViewMode] = useState('2D');
  const [weatherPreset, setWeatherPreset] = useState('sunny');
  const [weather, setWeather] = useState(null);
  const [windDirection, setWindDirection] = useState('right');

  const [previousGrid, setPreviousGrid] = useState(null);
  const [previousMetrics, setPreviousMetrics] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('after');
  const [baselineCO2, setBaselineCO2] = useState(null);
  /** When set, the 15×15 grid aligns to this geographic bbox on the real map & in OSM fetch. */
  const [geoBbox, setGeoBbox] = useState(null);

  const [isMdLayout, setIsMdLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  );
  const [leftPanelW, setLeftPanelW] = useState(() =>
    readStoredPanelWidth(LEFT_PANEL_KEY, LEFT_PANEL_DEFAULT, LEFT_PANEL_MIN, LEFT_PANEL_MAX)
  );
  const [rightPanelW, setRightPanelW] = useState(() =>
    readStoredPanelWidth(RIGHT_PANEL_KEY, RIGHT_PANEL_DEFAULT, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX)
  );

  const leftPanelWRef = useRef(leftPanelW);
  const rightPanelWRef = useRef(rightPanelW);
  leftPanelWRef.current = leftPanelW;
  rightPanelWRef.current = rightPanelW;

  const panelDragRef = useRef(null);
  /** User-selected preset drives heat/airflow; live `weather` still sets ambient temp in engines. */
  const effectiveWeatherMode = weatherPreset;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsMdLayout(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const d = panelDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      if (d.side === 'left') {
        setLeftPanelW(clampPanel(d.startWidth + dx, LEFT_PANEL_MIN, LEFT_PANEL_MAX));
      } else {
        setRightPanelW(clampPanel(d.startWidth - dx, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX));
      }
    };
    const onUp = () => {
      if (!panelDragRef.current) return;
      panelDragRef.current = null;
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      try {
        localStorage.setItem(LEFT_PANEL_KEY, String(leftPanelWRef.current));
        localStorage.setItem(RIGHT_PANEL_KEY, String(rightPanelWRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const loadWeatherForCity = useCallback(async (cityName) => {
    const normalizedCity = cityName.trim();
    if (!normalizedCity) return;

    try {
      const nextWeather = await fetchWeather(normalizedCity);
      setWeather(nextWeather);
    } catch (error) {
      console.error('Weather API Error:', error);
      setWeather(null);
    }
  }, []);

  useEffect(() => {
    loadWeatherForCity(DEFAULT_WEATHER_CITY);
  }, [loadWeatherForCity]);

  const onLeftPanelResizeStart = (e) => {
    e.preventDefault();
    panelDragRef.current = { side: 'left', startX: e.clientX, startWidth: leftPanelWRef.current };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const onRightPanelResizeStart = (e) => {
    e.preventDefault();
    panelDragRef.current = { side: 'right', startX: e.clientX, startWidth: rightPanelWRef.current };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const activeGrid = comparisonMode === 'before' && previousGrid ? previousGrid : grid;

  const airflowData = useMemo(() => {
    return calculateAirflowGrid(activeGrid, windDirection, effectiveWeatherMode, weather);
  }, [activeGrid, windDirection, effectiveWeatherMode, weather]);

  const heatData = useMemo(() => {
    const rawHeat = calculateHeatGrid(activeGrid, effectiveWeatherMode, weather, airflowData);
    return normalizeHeatGrid(rawHeat);
  }, [activeGrid, effectiveWeatherMode, weather, airflowData]);

  const metricsData = useMemo(() => {
    return calculateMetrics(activeGrid, heatData, airflowData, weather);
  }, [activeGrid, heatData, airflowData, weather]);

  const carbonData = useMemo(() => {
    const base = calculateCarbon(activeGrid, weather);
    let carbonHotspots = 0;
    for (let r = 0; r < activeGrid.length; r++) {
      for (let c = 0; c < activeGrid[r].length; c++) {
        const heatNorm = heatData?.normalizedGrid?.[r]?.[c]?.norm ?? 0;
        const emissionWeight = emissionWeightByType(activeGrid[r][c]?.type);
        if (heatNorm >= CARBON_HOTSPOT_HEAT_NORM && emissionWeight >= CARBON_HOTSPOT_EMISSION_WEIGHT) {
          carbonHotspots += 1;
        }
      }
    }
    return { ...base, carbonHotspots };
  }, [activeGrid, weather, heatData]);

  const currentScenarioCarbon = useMemo(() => calculateCarbon(grid, weather), [grid, weather]);
  const effectiveBaselineCO2 = baselineCO2 ?? currentScenarioCarbon.CO2_tons;
  const carbonCredits = Math.max(0, effectiveBaselineCO2 - currentScenarioCarbon.CO2_tons);
  const handleSetCurrentBaseline = useCallback(() => {
    setBaselineCO2(currentScenarioCarbon.CO2_tons);
    setComparisonMode('after');
  }, [currentScenarioCarbon]);

  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const aiRequestInFlightRef = useRef(false);
  const [highlightedCells, setHighlightedCells] = useState([]);
  const highlightTimerRef = useRef(null);

  const handleSuggestionClick = useCallback(
    (suggestion) => {
      const cells = cellsForAISuggestion(suggestion, grid, heatData, airflowData);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedCells(cells.slice(0, AI_HIGHLIGHT_MAX));
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedCells([]);
        highlightTimerRef.current = null;
      }, AI_HIGHLIGHT_MS);
    },
    [grid, heatData, airflowData]
  );

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    []
  );

  const handleGetAISuggestions = useCallback(async () => {
    if (aiRequestInFlightRef.current) return;
    aiRequestInFlightRef.current = true;
    setAiLoading(true);
    try {
      const suggestions = await getAISuggestions(grid, metricsData, airflowData, {
        CO2_tons: currentScenarioCarbon.CO2_tons,
        carbonCredits,
      });
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error('AI suggestions error', err);
    } finally {
      aiRequestInFlightRef.current = false;
      setAiLoading(false);
    }
  }, [grid, metricsData, airflowData, currentScenarioCarbon, carbonCredits]);

  const capturePreviousSnapshot = useCallback(() => {
    setPreviousGrid(grid.map((row) => row.map((cell) => ({ ...cell }))));
    setPreviousMetrics(metricsData);
    setComparisonMode('after');
  }, [grid, metricsData]);

  useEffect(() => {
    if (baselineCO2 != null) return;
    setBaselineCO2(currentScenarioCarbon.CO2_tons);
  }, [baselineCO2, currentScenarioCarbon]);

  const handleCellClick = (row, col) => {
    capturePreviousSnapshot();
    const newGrid = [...grid];
    newGrid[row] = [...newGrid[row]];
    newGrid[row][col] = { type: selectedTool };
    setGrid(newGrid);
  };

  const handleRandomCity = () => {
    capturePreviousSnapshot();
    setGeoBbox(null);
    setGrid(getRandomCityLayout());
    setBaselineCO2(null);
  };

  const handleResetGrid = () => {
    capturePreviousSnapshot();
    setGeoBbox(null);
    setGrid(createEmptyGrid());
    setBaselineCO2(null);
  };

  const handleApplyOsmTypes = useCallback((types) => {
    capturePreviousSnapshot();
    const next = types.map((row) => row.map((t) => ({ type: t })));
    setGrid(next);
    setBaselineCO2(null);
  }, [capturePreviousSnapshot]);

  useEffect(() => {
    if (viewMode === 'realMap') setViewMode('2D');
  }, [viewMode, setViewMode]);

  // CSS filters on an ancestor break WebGL (black/blank canvas). Only apply to 2D canvas views.
  const viewFilter =
    viewMode === '3D' ? 'none' : 'drop-shadow(10px 10px 10px rgba(0,0,0,0.5))';

  const insightsWidthProp = isMdLayout ? leftPanelW : undefined;
  const controlWidthProp = isMdLayout ? rightPanelW : undefined;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans md:flex-row">
      <InsightsPanel
        metrics={metricsData}
        previousMetrics={previousMetrics}
        panelWidthPx={insightsWidthProp}
        grid={grid}
        handleGetAISuggestions={handleGetAISuggestions}
        aiLoading={aiLoading}
        aiSuggestions={aiSuggestions}
        onSuggestionClick={handleSuggestionClick}
        carbonData={{
          ...carbonData,
          carbonCredits: Math.max(0, effectiveBaselineCO2 - (carbonData?.CO2_tons || 0)),
        }}
        baselineCO2={effectiveBaselineCO2}
        onSetCurrentBaseline={handleSetCurrentBaseline}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize insights panel"
        className="relative z-[25] hidden w-2 shrink-0 cursor-col-resize md:block"
        onMouseDown={onLeftPanelResizeStart}
      >
        <div className="absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-full bg-slate-700/50 transition-colors hover:bg-cyan-500/50 active:bg-cyan-400/65" />
      </div>
      <div
        className="relative flex min-h-[50vh] min-w-0 flex-1 flex-col bg-transparent md:min-h-0"
        style={{ filter: viewFilter }}
      >
        <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col pt-14">
          {viewMode === 'select' ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <RealWorldMap
                grid={grid}
                heatData={heatData}
                airflowData={airflowData}
                windDirection={windDirection}
                viewMode={viewMode}
                geoBbox={geoBbox}
                onGeoBboxChange={setGeoBbox}
                onApplyOsmTypes={handleApplyOsmTypes}
                onCellClick={handleCellClick}
                highlightedCells={highlightedCells}
                gridSize={GRID_SIZE}
              />
            </div>
          ) : viewMode === '3D' ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <City3D
                grid={grid}
                onCellClick={handleCellClick}
                viewMode={viewMode}
                heatData={heatData}
                airflowData={airflowData}
                highlightedCells={highlightedCells}
              />
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <GridCanvas
                grid={grid}
                heatData={heatData}
                airflowData={airflowData}
                windDirection={windDirection}
                weather={effectiveWeatherMode}
                viewMode={viewMode}
                onCellClick={handleCellClick}
                highlightedCells={highlightedCells}
              />
            </div>
          )}
        </div>
        <WeatherOverlay
          weather={effectiveWeatherMode}
          windDirection={windDirection}
          viewMode={viewMode}
          mapPickerOpen={viewMode === 'select'}
        />
        <MapViewLegend viewMode={viewMode === 'select' ? '2D' : viewMode} />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize controls panel"
        className="relative z-[25] hidden w-2 shrink-0 cursor-col-resize md:block"
        onMouseDown={onRightPanelResizeStart}
      >
        <div className="absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-full bg-slate-700/50 transition-colors hover:bg-cyan-500/50 active:bg-cyan-400/65" />
      </div>
      <ControlPanel
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        viewMode={viewMode}
        setViewMode={setViewMode}
        weatherMode={weatherPreset}
        setWeatherMode={setWeatherPreset}
        effectiveWeatherMode={effectiveWeatherMode}
        windDirection={windDirection}
        setWindDirection={setWindDirection}
        grid={grid}
        heatData={heatData}
        airflowData={airflowData}
        onCellClick={handleCellClick}
        onRandomCity={handleRandomCity}
        onResetGrid={handleResetGrid}
        comparisonMode={comparisonMode}
        setComparisonMode={setComparisonMode}
        hasPreviousGrid={!!previousGrid}
        panelWidthPx={controlWidthProp}
      />
    </div>
  );
};
export default App;
