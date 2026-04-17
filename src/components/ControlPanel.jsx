import React, { useState, useRef, useEffect } from 'react';
import { Home, Building2, TreeDeciduous, Trees, Waves, Factory, Grid2X2, Map, Flame, Wind, Cloud, Box, Eraser, ChevronDown, Globe } from 'lucide-react';
import GridCanvas from './GridCanvas';

const TOOLS = [
  { id: 'house', label: 'House', icon: <Home size={18} /> },
  { id: 'skyscraper', label: 'Tower', icon: <Building2 size={18} /> },
  { id: 'park', label: 'Park', icon: <TreeDeciduous size={18} /> },
  { id: 'forest', label: 'Forest', icon: <Trees size={18} /> },
  { id: 'water', label: 'Lake', icon: <Waves size={18} /> },
  { id: 'road', label: 'Road', icon: <Grid2X2 size={18} /> },
  { id: 'industry', label: 'Industry', icon: <Factory size={18} /> },
  { id: 'empty', label: 'Erase', icon: <Eraser size={18} /> },
];

const VIEWS = [
  { id: '2D', label: '2D View', icon: <Map size={18} /> },
  { id: 'heatmap', label: 'Heatmap', icon: <Flame size={18} /> },
  { id: 'airflow', label: 'Airflow', icon: <Wind size={18} /> },
  { id: 'weather', label: 'Weather', icon: <Cloud size={18} /> },
  { id: '3D', label: '3D View', icon: <Box size={18} /> },
  { id: 'select', label: 'Select', icon: <Globe size={18} /> },
];

const WEATHER = [
  { id: 'sunny', label: 'Sunny', icon: '☀️' },
  { id: 'rainy', label: 'Rainy', icon: '🌧️' },
  { id: 'windy', label: 'Windy', icon: '🌫️' },
];

const Button = ({ active, onClick, icon, label, variant = 'default', ...props }) => {
  const baseClasses = "flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 py-3 sm:px-3 sm:py-2.5 rounded-xl font-medium text-[10px] sm:text-xs tracking-wide transition-all duration-300 border active:scale-95 group";
  
  let variantClasses = "";
  if (variant === 'default') {
    variantClasses = active 
      ? "bg-gradient-to-br from-cyan-600 to-blue-600 border-cyan-400/50 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]" 
      : "bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:border-slate-500 hover:text-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:-translate-y-0.5";
  } else if (variant === 'danger') {
    variantClasses = "bg-rose-900/40 border-rose-800/50 text-rose-300 hover:bg-rose-800/60 hover:border-rose-500 hover:text-rose-100 hover:shadow-[0_4px_12px_rgba(225,29,72,0.3)] hover:-translate-y-0.5";
  } else if (variant === 'action') {
    variantClasses = "bg-emerald-900/40 border-emerald-800/50 text-emerald-300 hover:bg-emerald-800/60 hover:border-emerald-500 hover:text-emerald-100 hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:-translate-y-0.5";
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${variantClasses}`} {...props}>
      <div className="text-xl sm:text-lg group-hover:scale-110 drop-shadow-md transition-transform duration-300 flex items-center justify-center">{icon}</div>
      {label && <span>{label}</span>}
    </button>
  );
};

const SectionHeading = ({ children }) => (
  <h2 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
    <div className="h-px bg-slate-700 flex-1" />
    <span className="text-slate-300 drop-shadow-md">{children}</span>
    <div className="h-px bg-slate-700 flex-1" />
  </h2>
);

const WEATHER_MODE_LABELS = {
  sunny: 'Sunny',
  rainy: 'Rainy',
  windy: 'Windy',
};

const ControlPanel = ({ 
  selectedTool, setSelectedTool, 
  viewMode, setViewMode, 
  weatherMode, setWeatherMode,
  liveWeather,
  weatherCity,
  weatherCityInput,
  setWeatherCityInput,
  onWeatherCitySubmit,
  weatherLoading,
  weatherError,
  effectiveWeatherMode,
  windDirection, setWindDirection,
  grid, heatData, airflowData, onCellClick,
  onRandomCity, onResetGrid,
  comparisonMode, setComparisonMode, hasPreviousGrid,
  panelWidthPx,
}) => {
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [vizMenuOpen, setVizMenuOpen] = useState(false);
  const toolDropdownRef = useRef(null);
  const vizDropdownRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!toolDropdownRef.current?.contains(e.target)) setToolMenuOpen(false);
      if (!vizDropdownRef.current?.contains(e.target)) setVizMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const activeTool = TOOLS.find((tool) => tool.id === selectedTool) || TOOLS[0];
  const activeView = VIEWS.find((v) => v.id === viewMode) || VIEWS[0];
  const showPanel2dMap =
    viewMode === 'select' ||
    viewMode === 'heatmap' ||
    viewMode === 'airflow' ||
    viewMode === '3D';
  const showEnvironmentSection = viewMode === 'weather' || viewMode === 'airflow';
  return (
    <div
      className={`z-20 flex h-auto w-full shrink-0 flex-col overflow-y-auto overflow-x-hidden border-slate-700/90 bg-slate-900/90 p-5 backdrop-blur-lg md:h-full md:border-l md:border-slate-700 md:p-6 ${panelWidthPx == null ? 'md:w-[350px]' : 'md:min-w-0'}`}
      style={panelWidthPx != null ? { width: panelWidthPx, flexShrink: 0 } : undefined}
    >
      <div className="space-y-8 md:space-y-10">
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => (viewMode === 'select' ? setViewMode('2D') : setViewMode('select'))}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold tracking-wide transition active:scale-[0.99] ${
              viewMode === 'select'
                ? 'border-slate-500 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-cyan-500/50 bg-gradient-to-r from-cyan-700/90 to-blue-700/90 text-white hover:from-cyan-600 hover:to-blue-600'
            }`}
          >
            <Globe size={18} className="shrink-0 opacity-90" aria-hidden />
            {viewMode === 'select' ? 'Close map' : 'Select location'}
          </button>
        </div>

        <section>
          <SectionHeading>Live Weather</SectionHeading>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onWeatherCitySubmit?.();
            }}
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={weatherCityInput}
                onChange={(e) => setWeatherCityInput(e.target.value)}
                placeholder="Enter city"
                className="min-w-0 flex-1 rounded-xl border border-slate-700/70 bg-slate-950/90 px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500/70"
              />
              <button
                type="submit"
                disabled={weatherLoading}
                className="rounded-xl border border-cyan-500/40 bg-cyan-700/80 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {weatherLoading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </form>

          <div className="mt-3 rounded-2xl border border-slate-700/70 bg-slate-950/80 p-4 shadow-inner">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">City</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{weatherCity}</p>
              </div>
              <span className="rounded-full border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                {WEATHER_MODE_LABELS[effectiveWeatherMode] || effectiveWeatherMode}
              </span>
            </div>

            {liveWeather ? (
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Temp</p>
                  <p className="mt-1 text-base font-bold text-rose-300">{liveWeather.temperature.toFixed(1)}°C</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Wind</p>
                  <p className="mt-1 text-base font-bold text-cyan-300">{liveWeather.windSpeed.toFixed(1)} m/s</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Humidity</p>
                  <p className="mt-1 text-base font-bold text-emerald-300">{Math.round(liveWeather.humidity)}%</p>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-200/90">
                Live weather is unavailable. Simulation is using the fallback weather preset.
              </p>
            )}

            {weatherError ? (
              <p className="mt-3 text-xs text-rose-300">{weatherError}</p>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Temperature and wind speed automatically modify heat buildup and airflow.
              </p>
            )}
          </div>
        </section>

        {/* Tools Section */}
        <section>
          <SectionHeading>Construction</SectionHeading>
          <div className="relative mb-3" ref={toolDropdownRef}>
            <button
              type="button"
              onClick={() => setToolMenuOpen((o) => !o)}
              aria-expanded={toolMenuOpen}
              aria-haspopup="listbox"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-600/70 bg-slate-800/80 px-3 py-3 text-left shadow-inner transition hover:border-slate-500 hover:bg-slate-800 active:scale-[0.99]"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-slate-100">
                <span className="flex shrink-0 text-cyan-300 [&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {activeTool.icon}
                </span>
                <span className="truncate">{activeTool.label}</span>
              </span>
              <ChevronDown
                size={20}
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${toolMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {toolMenuOpen ? (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(70vh,320px)] overflow-auto rounded-xl border border-slate-600/80 bg-slate-900/95 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
              >
                {TOOLS.map((tool) => {
                  const selected = selectedTool === tool.id;
                  return (
                    <li key={tool.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTool(tool.id);
                          setToolMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${
                          selected
                            ? 'bg-cyan-600/25 text-cyan-100'
                            : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
                        }`}
                      >
                        <span className="flex shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{tool.icon}</span>
                        <span className="font-medium">{tool.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>

        {/* Views Section */}
        <section>
          <SectionHeading>Visualization</SectionHeading>
          <div className="relative" ref={vizDropdownRef}>
            <button
              type="button"
              onClick={() => setVizMenuOpen((o) => !o)}
              aria-expanded={vizMenuOpen}
              aria-haspopup="listbox"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-600/70 bg-slate-800/80 px-3 py-3 text-left shadow-inner transition hover:border-slate-500 hover:bg-slate-800 active:scale-[0.99]"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-slate-100">
                <span className="flex shrink-0 text-cyan-300 [&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {activeView.icon}
                </span>
                <span className="truncate">{activeView.label}</span>
              </span>
              <ChevronDown
                size={20}
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${vizMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {vizMenuOpen ? (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(70vh,320px)] overflow-auto rounded-xl border border-slate-600/80 bg-slate-900/95 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
              >
                {VIEWS.map((view) => {
                  const selected = viewMode === view.id;
                  return (
                    <li key={view.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode(view.id);
                          setVizMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${
                          selected
                            ? 'bg-cyan-600/25 text-cyan-100'
                            : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
                        }`}
                      >
                        <span className="flex shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{view.icon}</span>
                        <span className="font-medium">{view.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>

        {showPanel2dMap && grid?.length ? (
          <section aria-label="2D city map">
            <p className="mb-2 text-[8px] font-bold uppercase tracking-widest text-slate-400">
              2D map
            </p>
            <div className="rounded-xl border border-slate-600/70 bg-slate-950/90 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
              <div className="mx-auto flex max-w-full justify-center overflow-hidden rounded-md border border-slate-700/80">
                <GridCanvas
                  grid={grid}
                  heatData={heatData}
                  airflowData={airflowData}
                  windDirection={windDirection}
                  weather={effectiveWeatherMode}
                  viewMode="2D"
                  onCellClick={onCellClick}
                  compact={252}
                />
              </div>
            </div>
          </section>
        ) : null}

        {showEnvironmentSection ? (
          <section>
            <SectionHeading>Environment</SectionHeading>
            {viewMode === 'weather' ? (
              <>
                <p className="mb-3 text-xs text-slate-400">
                  Presets are used as a fail-safe when live weather cannot be loaded.
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {WEATHER.map((w) => (
                    <Button
                      key={w.id}
                      active={weatherMode === w.id}
                      onClick={() => setWeatherMode(w.id)}
                      icon={w.icon}
                      label={w.label}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-3 mt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-shadow-sm">
                  Wind direction
                </h3>
                <div className="grid grid-cols-4 gap-2 opacity-90 transition-opacity hover:opacity-100">
                  <Button active={windDirection === 'up'} onClick={() => setWindDirection('up')} icon="↑" aria-label="North" />
                  <Button active={windDirection === 'down'} onClick={() => setWindDirection('down')} icon="↓" aria-label="South" />
                  <Button active={windDirection === 'left'} onClick={() => setWindDirection('left')} icon="←" aria-label="West" />
                  <Button active={windDirection === 'right'} onClick={() => setWindDirection('right')} icon="→" aria-label="East" />
                </div>
              </>
            )}
          </section>
        ) : null}

        {/* Global Actions Section */}
        <section className="pb-8">
          <SectionHeading>Systems</SectionHeading>

          {hasPreviousGrid ? (
            <div className="mb-4 flex rounded-lg border border-slate-700/50 bg-slate-900 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setComparisonMode('before')}
                className={`flex-1 rounded-md py-2 text-xs font-bold tracking-wide transition-all ${
                  comparisonMode === 'before'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                ◀ Before
              </button>
              <button
                type="button"
                onClick={() => setComparisonMode('after')}
                className={`flex-1 rounded-md py-2 text-xs font-bold tracking-wide transition-all ${
                  comparisonMode === 'after'
                    ? 'border border-cyan-700/50 bg-cyan-900/50 text-cyan-300 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                After ▶
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={onRandomCity}
              icon="🎲"
              label="New City"
              variant="action"
              className="flex-1"
            />
            <Button
              onClick={onResetGrid}
              icon="💥"
              label="Clear All"
              variant="danger"
              className="flex-1"
            />
          </div>
        </section>

      </div>
    </div>
  );
};

export default ControlPanel;
