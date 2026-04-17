import React from 'react';

/**
 * Compact legend fixed to the top-right of the main map viewport.
 * Heat scale for all modes except airflow; wind resistance scale in airflow.
 */
const MapViewLegend = ({ viewMode }) => {
  const isAirflow = viewMode === 'airflow';

  return (
    <div
      className="pointer-events-none absolute right-2 top-2 z-[60] w-[min(9.5rem,calc(100%-1rem))] rounded-lg border border-slate-600/60 bg-slate-950/88 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
      aria-hidden
    >
      {isAirflow ? (
        <>
          <div className="mb-1 flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-300">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.75)]" />
            Wind resistance
          </div>
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 shadow-inner" />
          <div className="mt-0.5 flex justify-between text-[7px] font-semibold leading-tight text-slate-400">
            <span className="text-rose-300/90">Turbulent</span>
            <span className="text-emerald-300/90">Smooth</span>
          </div>
        </>
      ) : (
        <>
          <div className="mb-1 flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-300">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.75)]" />
            Heat signature
          </div>
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 via-yellow-400 to-rose-500 shadow-inner" />
          <div className="mt-0.5 flex justify-between text-[7px] font-semibold leading-tight text-slate-400">
            <span className="text-blue-300/90">Cool</span>
            <span className="text-rose-300/90">Hot</span>
          </div>
        </>
      )}
    </div>
  );
};

export default MapViewLegend;
