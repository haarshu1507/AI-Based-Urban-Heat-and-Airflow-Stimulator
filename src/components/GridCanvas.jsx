import React, { useMemo } from 'react';
import {
  Home,
  Building2,
  TreeDeciduous,
  Trees,
  Waves,
  Grid2X2,
  Factory,
} from 'lucide-react';

const EMPTY_CROSS_SVG = (
  <svg
    className="absolute inset-0 h-full w-full pointer-events-none"
    viewBox="0 0 100 100"
    aria-hidden
  >
    <line x1="14" y1="14" x2="86" y2="86" stroke="#dc2626" strokeWidth="9" strokeLinecap="round" />
    <line x1="86" y1="14" x2="14" y2="86" stroke="#dc2626" strokeWidth="9" strokeLinecap="round" />
  </svg>
);

const TYPE_COLORS = {
  empty: { icon: null },
  house: { icon: '🏠' },
  skyscraper: { icon: '🏢' },
  park: { icon: '🌳' },
  forest: { icon: '🌲' },
  water: { icon: '🟦' },
  road: { icon: '⬛' },
  industry: { icon: '🏭' },
};

/** Crisp SVG icons for the 3D-mode minimap only (2D / heatmap / airflow keep emoji). */
const TYPE_VECTOR_ICONS = {
  empty: null,
  house: Home,
  skyscraper: Building2,
  park: TreeDeciduous,
  forest: Trees,
  water: Waves,
  road: Grid2X2,
  industry: Factory,
};

const GridCanvas = ({
  grid,
  heatData,
  airflowData,
  windDirection,
  weather,
  viewMode,
  onCellClick,
  compact,
  useVectorIcons = false,
  highlightedCells = [],
}) => {
  const highlightKeys = useMemo(
    () => new Set((highlightedCells ?? []).map(([r, c]) => `${r},${c}`)),
    [highlightedCells]
  );

  /**
   * Rasterize + RealWorldMap: grid row 0 = south (low lat), drawn at the bottom of the map.
   * CSS Grid puts the first row at the top — without this, the preview is flipped N/S vs the map.
   */
  const northUpRowIndices = useMemo(() => {
    const n = grid?.length ?? 0;
    if (!n) return [];
    return Array.from({ length: n }, (_, i) => n - 1 - i);
  }, [grid?.length]);

  const mapPx = typeof compact === 'number' ? compact : null;
  const emojiCellClass = compact
    ? 'text-sm sm:text-base drop-shadow-sm select-none pointer-events-none'
    : 'text-xl md:text-2xl drop-shadow-sm select-none pointer-events-none';
  const vectorIconPx = compact ? 11 : 22;

  return (
    <div
      className={
        mapPx != null
          ? 'flex items-center justify-center p-1 bg-slate-900/95 h-full w-full min-h-0 min-w-0'
          : 'flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto bg-slate-900 p-6 md:p-8 w-full'
      }
    >
      <div
        className="grid shrink-0 gap-[1px] rounded-lg border border-slate-700 bg-slate-800 p-[1px] shadow-2xl transition-shadow duration-500 hover:shadow-[0_0_48px_rgba(34,211,238,0.12)] hover:border-slate-600/90"
        style={
          mapPx != null
            ? {
                gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${grid.length}, minmax(0, 1fr))`,
                width: `${mapPx}px`,
                height: `${mapPx}px`,
              }
            : {
                gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${grid.length}, minmax(0, 1fr))`,
                /* Fit the center column — 85vw ignored sidebars and pushed the grid off-center */
                width: 'min(85vh, 100%)',
                aspectRatio: '1',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
              }
        }
      >
        {northUpRowIndices.map((rIdx) =>
          grid[rIdx].map((cell, cIdx) => {
            const isHeatmap = viewMode === 'heatmap';
            const isAirflow = viewMode === 'airflow';
            const isWeatherWindy = viewMode === 'weather' && weather === 'windy';

            const is2D = viewMode === '2D' || viewMode === 'weather';
            const isHighlighted = highlightKeys.has(`${rIdx},${cIdx}`);
            let cellStyle = {};
            const typeDef = TYPE_COLORS[cell.type] || TYPE_COLORS.empty;
            const isEmpty = cell.type === 'empty';
            let cellClass = `
                cursor-pointer transition-all duration-200 ease-out relative flex items-center justify-center
                border border-slate-900/20 hover:z-[2] hover:border-cyan-400/35 hover:brightness-110 hover:shadow-[inset_0_0_12px_rgba(34,211,238,0.15)]
                ${isEmpty ? 'overflow-hidden' : ''}
                ${isHighlighted ? 'pulse-highlight z-[1]' : ''}
            `;
            let tooltip = `Type: ${cell.type}`;
            let innerContent = null;

            if (!isHeatmap && !isAirflow && useVectorIcons) {
              const IconCmp = TYPE_VECTOR_ICONS[cell.type];
              if (IconCmp) {
                innerContent = (
                  <div className="flex items-center justify-center select-none pointer-events-none">
                    <IconCmp
                      size={vectorIconPx}
                      strokeWidth={2.4}
                      className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                      aria-hidden
                    />
                  </div>
                );
              }
            } else if (!isHeatmap && !isAirflow && typeDef.icon) {
              innerContent = (
                <div className={`flex items-center justify-center ${emojiCellClass}`}>{typeDef.icon}</div>
              );
            }

            if ((isHeatmap || is2D) && heatData?.normalizedGrid?.length > 0) {
              const heatInfo = heatData.normalizedGrid[rIdx][cIdx];
              // hue: 240 = blue (cold), 0 = red (hot)
              const hue = (1 - heatInfo.norm) * 240;
              cellStyle.backgroundColor = `hsl(${hue}, 100%, 50%)`;
              tooltip = `Type: ${cell.type} | Temp: ${heatInfo.val.toFixed(1)}°C`;
            }

            if (isAirflow && airflowData?.length > 0) {
              const flowStr = airflowData[rIdx][cIdx];
              // 0 to 5 mapped to hue 0 (red) to 120 (green)
              const norm = flowStr / 5;
              const hue = norm * 120;
              cellStyle.backgroundColor = `hsl(${hue}, 100%, 35%)`;
              tooltip = `Type: ${cell.type} | Airflow: ${flowStr}`;
            }

            if ((isAirflow || isWeatherWindy) && airflowData?.length > 0) {
              const flowStr = airflowData[rIdx][cIdx];
              let arrow = '';
              if (windDirection === 'right') arrow = '→';
              if (windDirection === 'left') arrow = '←';
              if (windDirection === 'up') arrow = '↑';
              if (windDirection === 'down') arrow = '↓';

              let fontSize = 'text-[10px] text-white/40';
              if (flowStr >= 4) fontSize = 'text-lg font-bold text-white/90 drop-shadow-md';
              else if (flowStr >= 2) fontSize = 'text-sm text-white/70';

              let extraAnim = '';
              if (isWeatherWindy) {
                fontSize = 'text-xl font-bold text-white drop-shadow-[0_0_6px_rgba(255,255,255,1)] z-20';
                if (flowStr > 0) extraAnim = 'animate-pulse';
              }

              innerContent = (
                <div className={`w-full h-full flex items-center justify-center select-none ${fontSize} ${extraAnim}`}>
                  {flowStr > 0 ? arrow : (isAirflow ? '❌' : '')}
                </div>
              );
            }

            if (isEmpty) {
              cellStyle = { ...cellStyle, backgroundColor: '#000000' };
              innerContent = EMPTY_CROSS_SVG;
            }

            return (
              <div
                key={`${rIdx}-${cIdx}`}
                onClick={() => onCellClick(rIdx, cIdx)}
                className={cellClass}
                style={cellStyle}
                title={tooltip}
              >
                {innerContent}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GridCanvas;
