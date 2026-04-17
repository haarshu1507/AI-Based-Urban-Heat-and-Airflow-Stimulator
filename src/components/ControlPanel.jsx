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

const Button = ({ active, onClick, icon, label, variant = 'default', className = '', ...props }) => {
  const baseClasses =
    'flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 py-3 sm:px-3 sm:py-2.5 rounded-xl font-medium text-[10px] sm:text-xs tracking-wide transition-all duration-300 ease-out border active:scale-[0.97] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

  let variantClasses = '';
  if (variant === 'default') {
    variantClasses = active
      ? 'bg-gradient-to-br from-cyan-600 to-blue-600 border-cyan-400/50 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]'
      : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/90 hover:border-cyan-500/35 hover:text-white hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:-translate-y-0.5';
  } else if (variant === 'danger') {
    variantClasses =
      'bg-rose-900/40 border-rose-800/50 text-rose-300 hover:bg-rose-800/70 hover:border-rose-400/60 hover:text-rose-50 hover:shadow-[0_8px_24px_rgba(225,29,72,0.25)] hover:-translate-y-0.5';
  } else if (variant === 'action') {
    variantClasses =
      'bg-emerald-900/40 border-emerald-800/50 text-emerald-300 hover:bg-emerald-800/70 hover:border-emerald-400/50 hover:text-emerald-50 hover:shadow-[0_8px_24px_rgba(16,185,129,0.25)] hover:-translate-y-0.5';
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${variantClasses} ${className}`} {...props}>
      <div className="text-xl sm:text-lg group-hover:scale-110 drop-shadow-md transition-transform duration-300 ease-out flex items-center justify-center">
        {icon}
      </div>
      {label && <span className="transition-colors duration-200">{label}</span>}
    </button>
  );
};

const SectionHeading = ({ children }) => (
  <h2 className="group/head text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-slate-600 transition-all duration-500 group-hover/head:via-cyan-500/40" />
    <span className="text-slate-300 drop-shadow-md transition-colors duration-300 group-hover/head:text-cyan-200/90">
      {children}
    </span>
    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-600 to-slate-600 transition-all duration-500 group-hover/head:via-cyan-500/40" />
  </h2>
);

const ControlPanel = ({ 
  selectedTool, setSelectedTool, 
  viewMode, setViewMode, 
  weatherMode, setWeatherMode,
  effectiveWeatherMode,
  windDirection, setWindDirection,
  grid, heatData, airflowData, onCellClick,
  onRandomCity, onResetGrid,
  comparisonMode, setComparisonMode, hasPreviousGrid,
  panelWidthPx,
}) => {
  const [vizMenuOpen, setVizMenuOpen] = useState(false);
  const vizDropdownRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!vizDropdownRef.current?.contains(e.target)) setVizMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const activeView = VIEWS.find((v) => v.id === viewMode) || VIEWS[0];
  const showPanel2dMap =
    viewMode === 'select' ||
    viewMode === 'heatmap' ||
    viewMode === 'airflow' ||
    viewMode === '3D';
  const showEnvironmentSection = viewMode === 'weather' || viewMode === 'airflow';
  return (
    <div
      className={`z-20 flex h-auto w-full shrink-0 flex-col overflow-y-auto overflow-x-hidden border-slate-700/90 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-5 shadow-[inset_1px_0_0_rgba(34,211,238,0.06)] backdrop-blur-xl transition-colors duration-300 md:h-full md:border-l md:border-slate-700/80 md:p-6 ${panelWidthPx == null ? 'md:w-[350px]' : 'md:min-w-0'}`}
      style={panelWidthPx != null ? { width: panelWidthPx, flexShrink: 0 } : undefined}
    >
      <div className="space-y-8 md:space-y-10">
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => (viewMode === 'select' ? setViewMode('2D') : setViewMode('select'))}
            className={`group flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold tracking-wide shadow-lg transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
              viewMode === 'select'
                ? 'border-slate-500 bg-slate-800 text-slate-200 hover:border-slate-400 hover:bg-slate-700/90'
                : 'border-cyan-400/40 bg-gradient-to-r from-cyan-600 to-blue-700 text-white hover:from-cyan-500 hover:to-blue-600 hover:border-cyan-300/50'
            }`}
          >
            <Globe size={18} className="shrink-0 opacity-90 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
            {viewMode === 'select' ? 'Close map' : 'Select location'}
          </button>
        </div>

        <section>
          <SectionHeading>Construction</SectionHeading>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="listbox"
            aria-label="Construction type"
          >
            {TOOLS.map((tool) => {
              const active = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedTool(tool.id)}
                  className={`group flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                    active
                      ? 'border-cyan-400/70 bg-gradient-to-br from-cyan-600/95 to-blue-700/95 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] ring-1 ring-cyan-400/30'
                      : 'border-slate-700/60 bg-slate-800/70 text-slate-300 hover:border-cyan-500/35 hover:bg-slate-700/85 hover:text-white hover:shadow-md hover:shadow-cyan-950/40'
                  }`}
                >
                  <span className="flex text-cyan-200 transition-transform duration-200 group-hover:scale-105 [&>svg]:h-[20px] [&>svg]:w-[20px]">{tool.icon}</span>
                  <span className="text-[10px] font-semibold leading-tight tracking-wide">{tool.label}</span>
                </button>
              );
            })}
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
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-600/70 bg-slate-800/80 px-3 py-3 text-left shadow-inner transition-all duration-200 ease-out hover:border-cyan-500/40 hover:bg-slate-800 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-slate-100">
                <span className="flex shrink-0 text-cyan-300 [&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {activeView.icon}
                </span>
                <span className="truncate">{activeView.label}</span>
              </span>
              <ChevronDown
                size={20}
                className={`shrink-0 text-slate-400 transition-transform duration-300 ease-out ${vizMenuOpen ? 'rotate-180 text-cyan-400' : ''}`}
                aria-hidden
              />
            </button>
            {vizMenuOpen ? (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(70vh,320px)] origin-top overflow-auto rounded-xl border border-slate-600/80 bg-slate-900/95 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] shadow-cyan-950/20 backdrop-blur-md"
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
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                          selected
                            ? 'bg-cyan-600/25 text-cyan-100'
                            : 'text-slate-300 hover:bg-gradient-to-r hover:from-slate-800/90 hover:to-cyan-950/20 hover:text-white'
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
            <div className="group/map rounded-xl border border-slate-600/70 bg-slate-950/90 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:border-cyan-500/25 hover:shadow-[0_12px_40px_rgba(34,211,238,0.12)]">
              <div className="mx-auto flex max-w-full justify-center overflow-hidden rounded-md border border-slate-700/80 transition-colors duration-300 group-hover/map:border-slate-600">
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
            <div className="mb-4 flex rounded-lg border border-slate-700/50 bg-slate-900 p-1 shadow-inner transition-shadow duration-300 hover:shadow-md">
              <button
                type="button"
                onClick={() => setComparisonMode('before')}
                className={`flex-1 rounded-md py-2 text-xs font-bold tracking-wide transition-all duration-200 ${
                  comparisonMode === 'before'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:scale-[1.02]'
                }`}
              >
                ◀ Before
              </button>
              <button
                type="button"
                onClick={() => setComparisonMode('after')}
                className={`flex-1 rounded-md py-2 text-xs font-bold tracking-wide transition-all duration-200 ${
                  comparisonMode === 'after'
                    ? 'border border-cyan-700/50 bg-cyan-900/50 text-cyan-300 shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:scale-[1.02]'
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
