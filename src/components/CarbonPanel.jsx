import React from 'react';

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

const CarbonPanel = ({ carbonData, baselineCO2 = 0, onSetCurrentBaseline }) => {
  const currentCO2 = carbonData?.CO2_tons || 0;
  const carbonCredits =
    carbonData?.carbonCredits != null ? Math.max(0, carbonData.carbonCredits) : Math.max(0, baselineCO2 - currentCO2);
  const treesSaved = carbonCredits * 4;
  const hasImproved = carbonCredits > 0;

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 sm:text-xs">
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-slate-300 drop-shadow-md">Carbon Dashboard</span>
        <div className="h-px flex-1 bg-slate-700" />
      </h2>
      <div className="rounded-2xl border border-emerald-700/35 bg-slate-900/60 p-5 shadow-inner">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">CO2 (tons/year)</span>
            <span className="font-bold text-emerald-300">{formatNumber(currentCO2, 1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Emission</span>
            <span className="font-semibold text-rose-300">{formatNumber(carbonData?.emission, 2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Absorption</span>
            <span className="font-semibold text-cyan-300">{formatNumber(carbonData?.absorption, 2)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-700/80 pt-2">
            <span className="text-slate-200">Carbon Credits Earned</span>
            <span className={`font-bold ${hasImproved ? 'text-emerald-300' : 'text-slate-400'}`}>
              {formatNumber(carbonCredits, 1)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Equivalent Trees Saved</span>
            <span className="font-bold text-green-300">{Math.round(treesSaved)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Carbon Hotspots</span>
            <span className={`font-semibold ${(carbonData?.carbonHotspots || 0) > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {carbonData?.carbonHotspots || 0}
            </span>
          </div>
          <div className="mt-1 rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
            Baseline: {formatNumber(baselineCO2, 1)} t/yr
            {hasImproved ? ' -> improved scenario' : ' -> no positive credits yet'}
          </div>
          <button
            type="button"
            onClick={() => onSetCurrentBaseline?.()}
            className="mt-1 w-full rounded-lg border border-cyan-600/40 bg-cyan-900/30 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-800/35"
          >
            Set current as baseline
          </button>
        </div>
      </div>
    </section>
  );
};

export default CarbonPanel;
