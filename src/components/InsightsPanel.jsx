import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { formatMetricTooltipCalculation } from '../metrics';
import CarbonPanel from './CarbonPanel';

const SectionHeading = ({ children }) => (
  <h2 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
    <div className="h-px bg-slate-700 flex-1" />
    <span className="text-slate-300 drop-shadow-md">{children}</span>
    <div className="h-px bg-slate-700 flex-1" />
  </h2>
);

/** Definition → formula → live numbers → impact */
const MetricTooltipContent = ({ title, definition, formula, calculation, impact }) => (
  <>
    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-300">{title}</p>
    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Definition</p>
    <p className="mb-3 text-[11px] leading-snug text-slate-300">{definition}</p>
    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300/90">Formula</p>
    <pre className="mb-2 whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900 p-2.5 font-mono text-[10px] leading-relaxed text-slate-200">
      {formula}
    </pre>
    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-300/90">Your city (live)</p>
    <pre className="mb-3 whitespace-pre-wrap rounded-lg border border-amber-900/50 bg-slate-900/95 p-2.5 font-mono text-[10px] leading-relaxed text-amber-50/95">
      {calculation}
    </pre>
    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Why it matters</p>
    <p className="text-[11px] leading-snug text-slate-300">{impact}</p>
  </>
);

const TOOLTIP_MAX_W = 320;

const InfoButton = ({ tooltip }) => {
  const anchorRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140);
  };

  const placeTooltip = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(TOOLTIP_MAX_W, vw - margin * 2);
    let left = r.right + margin;
    if (left + w > vw - margin) {
      left = r.left - w - margin;
    }
    if (left < margin) left = margin;
    let top = r.bottom + margin;
    const estH = 380;
    if (top + estH > vh - margin) {
      top = Math.max(margin, r.top - estH - margin);
    }
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    placeTooltip();
    const onScrollOrResize = () => placeTooltip();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, placeTooltip]);

  const portal =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        role="tooltip"
        className="fixed z-[10050] w-[min(20rem,calc(100vw-1rem))] max-h-[min(75vh,26rem)] overflow-y-auto rounded-xl border border-slate-600 bg-slate-950 p-3 text-left text-slate-100 shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
      >
        <MetricTooltipContent {...tooltip} />
      </div>,
      document.body
    );

  return (
    <>
      <div
        ref={anchorRef}
        className="ml-1.5 flex cursor-help items-center rounded-md outline-none focus-within:ring-2 focus-within:ring-indigo-500/40"
        tabIndex={0}
        onMouseEnter={() => {
          clearCloseTimer();
          setOpen(true);
          queueMicrotask(placeTooltip);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          clearCloseTimer();
          setOpen(true);
          queueMicrotask(placeTooltip);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) scheduleClose();
        }}
      >
        <Info size={12} className="text-slate-500 transition-colors hover:text-cyan-400" aria-hidden />
      </div>
      {portal}
    </>
  );
};

const InsightsPanel = ({
  metrics,
  previousMetrics,
  panelWidthPx,
  grid,
  handleGetAISuggestions,
  aiLoading,
  aiSuggestions,
  onSuggestionClick,
  carbonData,
  baselineCO2,
  onSetCurrentBaseline,
}) => {
  const gridIsEmpty = useMemo(() => {
    if (!grid?.length) return true;
    return grid.every((row) => row.every((cell) => cell.type === 'empty'));
  }, [grid]);

  return (
    <div
      className={`z-20 flex h-[50vh] w-full shrink-0 flex-col overflow-y-auto overflow-x-hidden glass-panel p-5 shadow-xl md:h-full md:bg-slate-900/80 md:backdrop-blur-lg md:border-r md:border-slate-700 ${panelWidthPx == null ? 'md:w-[330px]' : 'md:min-w-0'}`}
      style={panelWidthPx != null ? { width: panelWidthPx, flexShrink: 0 } : undefined}
    >
      
      <div className="mb-6 shrink-0 md:mb-10">
        <h1 className="text-base font-extrabold leading-snug tracking-tight text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text transition-[filter,opacity] duration-300 hover:brightness-110 md:text-lg lg:text-xl">
          Smart Urban Heat and Airflow Simulator
        </h1>
      </div>

      <div className="space-y-8 md:space-y-12">
        {/* Live Metrics Section */}
        <section>
          <SectionHeading>Live Statistics</SectionHeading>
          <div className="flex flex-col gap-4 p-5 md:p-6 bg-slate-900/60 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-inner relative group transition-all duration-300 hover:border-cyan-500/25 hover:shadow-lg hover:shadow-cyan-950/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full group-hover:bg-cyan-500/15 transition-colors duration-700" />

            <div className="flex justify-between items-center text-sm z-10 rounded-lg px-2 py-1 -mx-1 transition-colors duration-200 hover:z-50 hover:bg-slate-800/40">
              <span className="text-slate-300 font-medium flex items-center">
                🌡 Avg Temp
                <InfoButton
                  tooltip={{
                    title: 'Average cell temperature',
                    definition:
                      'Mean of the grid’s cell temperatures. With live weather enabled, each cell starts from the real ambient temperature and is then adjusted by nearby land use.',
                    formula: 'avg = Σ (cell temperature) ÷ (rows × columns)',
                    calculation: formatMetricTooltipCalculation('avgHeat', metrics),
                    impact: 'Shows how hot the whole city runs in this simulation.',
                  }}
                />
              </span>
              {previousMetrics && previousMetrics.avgHeat !== metrics?.avgHeat ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 line-through text-xs font-semibold">{(previousMetrics.avgHeat).toFixed(1)}°C</span>
                  <span className="text-slate-400 text-[10px]">➔</span>
                  <span className={`font-bold tabular-nums text-lg drop-shadow-md ${metrics.avgHeat < previousMetrics.avgHeat ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(metrics?.avgHeat || 0).toFixed(1)}°C
                  </span>
                </div>
              ) : (
                <span className={`font-bold tabular-nums text-lg drop-shadow-md ${metrics?.avgHeat > 20 ? 'text-rose-400' : (metrics?.avgHeat < 10 ? 'text-emerald-400' : 'text-amber-400')}`}>
                  {(metrics?.avgHeat || 0).toFixed(1)}°C
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-sm z-10 rounded-lg px-2 py-1 -mx-1 transition-colors duration-200 hover:z-50 hover:bg-slate-800/40">
              <span className="text-slate-300 font-medium flex items-center">
                🌳 Greenery
                <InfoButton
                  tooltip={{
                    title: 'Greenery percentage',
                    definition: 'Share of grid cells zoned as park or forest.',
                    formula: 'greenery % = (park + forest cells) ÷ total cells × 100',
                    calculation: formatMetricTooltipCalculation('greenPercent', metrics),
                    impact: 'More green usually lowers neighborhood heat in the model.',
                  }}
                />
              </span>
              {previousMetrics && previousMetrics.greenPercent !== metrics?.greenPercent ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 line-through text-xs font-semibold">{Math.round(previousMetrics.greenPercent)}%</span>
                  <span className="text-slate-400 text-[10px]">➔</span>
                  <span className={`font-bold tabular-nums text-lg drop-shadow-md ${metrics.greenPercent > previousMetrics.greenPercent ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Math.round(metrics?.greenPercent || 0)}%
                  </span>
                </div>
              ) : (
                <span className={`font-bold tabular-nums text-lg drop-shadow-md ${metrics?.greenPercent >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {Math.round(metrics?.greenPercent || 0)}%
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-sm z-10 rounded-lg px-2 py-1 -mx-1 transition-colors duration-200 hover:z-50 hover:bg-slate-800/40">
              <span className="text-slate-300 font-medium flex items-center">
                🏢 Built Area
                <InfoButton
                  tooltip={{
                    title: 'Built area',
                    definition: 'Count of house, skyscraper, and industry cells.',
                    formula: 'built = count(house) + count(skyscraper) + count(industry)',
                    calculation: formatMetricTooltipCalculation('buildingCount', metrics),
                    impact: 'Rough footprint of structure cells on the grid.',
                  }}
                />
              </span>
              <span className="font-bold tabular-nums text-lg text-slate-100 drop-shadow-md">
                {metrics?.buildingCount || 0}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm z-10 rounded-lg px-2 py-1 -mx-1 transition-colors duration-200 hover:z-50 hover:bg-slate-800/40">
              <span className="text-slate-300 font-medium flex items-center">
                🏙 Urban Density
                <InfoButton
                  tooltip={{
                    title: 'Urban density',
                    definition: 'Percentage of cells that are not empty (any land use).',
                    formula: 'density % = (total cells − empty cells) ÷ total cells × 100',
                    calculation: formatMetricTooltipCalculation('urbanDensity', metrics),
                    impact: 'Higher values mean less open land; often more heat and blockage.',
                  }}
                />
              </span>
              <span className="font-bold tabular-nums text-lg text-slate-100 drop-shadow-md">
                {Math.round(metrics?.urbanDensity || 0)}%
              </span>
            </div>

            <div className="flex justify-between items-center text-sm z-10 rounded-lg px-2 py-1 -mx-1 transition-colors duration-200 hover:z-50 hover:bg-slate-800/40">
              <span className="text-slate-300 font-medium flex items-center">
                🔥 Heat Hotspots
                <InfoButton
                  tooltip={{
                    title: 'Heat hotspots',
                    definition: 'Cells whose simulated temperature is substantially hotter than the surrounding weather baseline.',
                    formula: 'hotspots = |{ cells : cell temperature > hotspot threshold }|',
                    calculation: formatMetricTooltipCalculation('heatHotspots', metrics),
                    impact: 'Where cooling or greening helps most.',
                  }}
                />
              </span>
              {previousMetrics && previousMetrics.heatHotspots !== metrics?.heatHotspots ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 line-through text-xs font-semibold">{previousMetrics.heatHotspots}</span>
                  <span className="text-slate-400 text-[10px]">➔</span>
                  <span className={`font-bold tabular-nums text-lg drop-shadow-md ${metrics.heatHotspots < previousMetrics.heatHotspots ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {metrics?.heatHotspots || 0}
                  </span>
                </div>
              ) : (
                <span className={`font-bold tabular-nums text-lg drop-shadow-md ${metrics?.heatHotspots > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {metrics?.heatHotspots || 0}
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-sm z-10 rounded-lg px-2 py-1 -mx-1 transition-colors duration-200 hover:z-50 hover:bg-slate-800/40">
              <span className="text-slate-300 font-medium flex items-center">
                🏭 Pollution Index
                <InfoButton
                  tooltip={{
                    title: 'Pollution index',
                    definition: 'Composite stress score from industry count, mean heat index, and mean airflow; mapped to Low / Medium / High.',
                    formula:
                      'score = (industry÷30)×50 + (avgHeat÷40)×25 + ((5−avgAirflow)÷5)×25\n→ Low <30 · Medium <60 · High ≥60',
                    calculation: formatMetricTooltipCalculation('pollutionIndex', metrics),
                    impact: 'Quick read on ventilation + heat stress in the model.',
                  }}
                />
              </span>
              <span className={`font-bold text-sm tracking-wide uppercase drop-shadow-md ${metrics?.pollutionIndex === 'Low' ? 'text-emerald-400' : (metrics?.pollutionIndex === 'Medium' ? 'text-amber-400' : 'text-rose-400')}`}>
                {metrics?.pollutionIndex || 'Low'}
              </span>
            </div>

            <div className="mt-3 pt-4 border-t border-slate-700/80 z-10 hover:z-50 relative">
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-slate-300 font-medium text-sm flex items-center">
                  🔥 Heat Intensity
                  <InfoButton
                    tooltip={{
                      title: 'Heat intensity (0–100)',
                      definition: 'Rescales the city-wide average temperature into a 0–100 stress gauge.',
                      formula: 'intensity = clamp( scaled average temperature, 0, 100 )',
                      calculation: formatMetricTooltipCalculation('heatScore', metrics),
                      impact: 'Single number to compare layouts.',
                    }}
                  />
                </span>
                {previousMetrics && previousMetrics.heatScore !== metrics?.heatScore ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 line-through text-xs font-semibold">{Math.round(previousMetrics.heatScore)}</span>
                    <span className="text-slate-400 text-[10px]">➔</span>
                    <span className={`font-bold tracking-tight text-xl tabular-nums ${metrics.heatScore < previousMetrics.heatScore ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Math.round(metrics?.heatScore || 0)}
                      <span className="text-xs text-slate-500 ml-1 font-normal opacity-70">/100</span>
                    </span>
                  </div>
                ) : (
                  <span className={`font-bold tracking-tight text-xl tabular-nums ${metrics?.heatScore > 65 ? 'text-rose-400' : (metrics?.heatScore < 35 ? 'text-emerald-400' : 'text-amber-400')}`}>
                    {Math.round(metrics?.heatScore || 0)}
                    <span className="text-xs text-slate-500 ml-1 font-normal opacity-70">/100</span>
                  </span>
                )}
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner group-hover:z-0">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out relative ${metrics?.heatScore > 65 ? 'bg-gradient-to-r from-rose-500 to-red-500' : (metrics?.heatScore < 35 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-amber-500 to-yellow-400')}`}
                  style={{ width: `${Math.min(100, Math.max(0, metrics?.heatScore || 0))}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
                </div>
              </div>
            </div>

            <div className="mt-2 pt-4 border-t border-slate-700/80 z-10 hover:z-50 relative">
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-slate-300 font-medium text-sm flex items-center">
                  🌍 Sustainability
                  <InfoButton
                    tooltip={{
                      title: 'Sustainability score (0–100)',
                      definition: 'Blend of greenery reward, heat-intensity penalty, and pollution-score penalty; clamped 0–100.',
                      formula:
                        'greenPts = min((greenery%÷50)×40, 40)\nheatPts = 30 − (heat intensity%)×0.3\npollPts = 30 − min(pollution score,100)/100×30\ntotal = clamp(sum, 0, 100)',
                      calculation: formatMetricTooltipCalculation('sustainabilityScore', metrics),
                      impact: 'Higher = better balance of green, coolth, and airflow in this model.',
                    }}
                  />
                </span>
                {previousMetrics && previousMetrics.sustainabilityScore !== metrics?.sustainabilityScore ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 line-through text-xs font-semibold">{Math.round(previousMetrics.sustainabilityScore)}</span>
                    <span className="text-slate-400 text-[10px]">➔</span>
                    <span className={`font-bold tracking-tight text-xl tabular-nums ${metrics.sustainabilityScore > previousMetrics.sustainabilityScore ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Math.round(metrics?.sustainabilityScore || 0)}
                      <span className="text-xs text-slate-500 ml-1 font-normal opacity-70">/100</span>
                    </span>
                  </div>
                ) : (
                  <span className={`font-bold tracking-tight text-xl tabular-nums ${metrics?.sustainabilityScore >= 65 ? 'text-emerald-400' : (metrics?.sustainabilityScore >= 35 ? 'text-amber-400' : 'text-rose-400')}`}>
                    {Math.round(metrics?.sustainabilityScore || 0)}
                    <span className="text-xs text-slate-500 ml-1 font-normal opacity-70">/100</span>
                  </span>
                )}
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner group-hover:z-0">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out relative ${metrics?.sustainabilityScore >= 65 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : (metrics?.sustainabilityScore >= 35 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-rose-500 to-red-600')}`}
                  style={{ width: `${Math.min(100, Math.max(0, metrics?.sustainabilityScore || 0))}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
                </div>
              </div>
            </div>

          </div>
        </section>

        <section>
          <CarbonPanel
            carbonData={carbonData}
            baselineCO2={baselineCO2}
            onSetCurrentBaseline={onSetCurrentBaseline}
          />
        </section>

        <section>
          <SectionHeading>AI suggestions</SectionHeading>
          <button
            type="button"
            onClick={() => handleGetAISuggestions?.()}
            disabled={aiLoading || gridIsEmpty}
            className="w-full rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-900/50 to-cyan-900/40 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md transition hover:border-cyan-400/50 hover:from-violet-800/60 hover:to-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:from-violet-900/50 disabled:hover:to-cyan-900/40"
          >
            {aiLoading ? 'Analyzing...' : 'Get AI Suggestions'}
          </button>
          {gridIsEmpty ? (
            <p className="mt-2 text-center text-[10px] text-slate-500">
              Place buildings or use New City to enable suggestions.
            </p>
          ) : null}
          {aiLoading ? (
            <p className="mt-3 rounded-lg border border-cyan-500/30 bg-slate-900/50 px-3 py-2.5 text-center text-xs text-cyan-200/90">
              🤖 AI is analyzing your city...
            </p>
          ) : null}
          {!aiLoading && aiSuggestions?.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2.5">
              {aiSuggestions.map((sug) => {
                let borderCol = 'border-slate-700/60';
                let bgCol = 'bg-slate-900/50';
                if (sug.severity === 'red') {
                  borderCol = 'border-rose-500/45 hover:border-rose-400/70';
                  bgCol = 'bg-rose-950/35 hover:bg-rose-900/30';
                } else if (sug.severity === 'yellow') {
                  borderCol = 'border-amber-500/45 hover:border-amber-400/70';
                  bgCol = 'bg-amber-950/30 hover:bg-amber-900/25';
                } else if (sug.severity === 'green') {
                  borderCol = 'border-emerald-500/45 hover:border-emerald-400/70';
                  bgCol = 'bg-emerald-950/25 hover:bg-emerald-900/25';
                }
                return (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => onSuggestionClick?.(sug)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left shadow-inner transition hover:scale-[1.01] active:scale-[0.99] ${borderCol} ${bgCol}`}
                  >
                    {sug.icon ? (
                      <span className="shrink-0 text-lg leading-none" aria-hidden>
                        {sug.icon}
                      </span>
                    ) : null}
                    <span className="text-xs font-medium leading-snug text-slate-200">{sug.message}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default InsightsPanel;
