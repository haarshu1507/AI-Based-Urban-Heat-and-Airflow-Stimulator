const emptyBreakdown = () => ({
  numCells: 0,
  totalHeat: 0,
  greenCount: 0,
  buildingCount: 0,
  emptyCount: 0,
  industryCount: 0,
  heatHotspots: 0,
  totalAirflow: 0,
  avgAirflow: 0,
  nonEmptyCells: 0,
  pollutionScore: 0,
  greenPoints: 0,
  heatPoints: 0,
  pollPoints: 0,
});



export const calculateMetrics = (grid, heatData, airflowData) => {
  if (!grid || grid.length === 0) {
    return {
      avgHeat: 0,
      greenPercent: 0,
      buildingCount: 0,
      heatScore: 0,
      urbanDensity: 0,
      heatHotspots: 0,
      pollutionIndex: 'Low',
      sustainabilityScore: 0,
      breakdown: emptyBreakdown(),
    };
  }

  let totalHeat = 0;
  let greenCount = 0;
  let buildingCount = 0;
  let emptyCount = 0;
  let industryCount = 0;
  let heatHotspots = 0;
  let totalAirflow = 0;
  const numCells = grid.length * grid[0].length;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const type = grid[r][c].type;

      if (type === 'empty') emptyCount++;
      if (type === 'industry') industryCount++;
      if (type === 'park' || type === 'forest') greenCount++;
      if (type === 'house' || type === 'skyscraper' || type === 'industry') buildingCount++;

      if (heatData?.normalizedGrid?.length > 0) {
        const temp = heatData.normalizedGrid[r][c].val;
        totalHeat += temp;
        if (temp > 30) heatHotspots++;
      }

      if (airflowData && airflowData.length > 0) {
        totalAirflow += airflowData[r][c];
      }
    }
  }

  const avgHeat = totalHeat / numCells;
  const greenPercent = (greenCount / numCells) * 100;

  let heatScore = (avgHeat / 25) * 100;
  if (heatScore < 0) heatScore = 0;
  if (heatScore > 100) heatScore = 100;

  const nonEmptyCells = numCells - emptyCount;
  const urbanDensity = (nonEmptyCells / numCells) * 100;

  const avgAirflow = numCells > 0 ? totalAirflow / numCells : 0;
  let pollutionScore = (industryCount / 30) * 50;
  if (avgHeat > 0) pollutionScore += (avgHeat / 40) * 25;
  pollutionScore += ((5 - avgAirflow) / 5) * 25;

  let pollutionIndex = 'Low';
  if (pollutionScore >= 60) pollutionIndex = 'High';
  else if (pollutionScore >= 30) pollutionIndex = 'Medium';

  const greenPoints = Math.min((greenPercent / 50) * 40, 40);
  const heatPoints = 30 - (heatScore / 100) * 30;
  const pollPoints = 30 - (Math.min(100, pollutionScore) / 100) * 30;
  const sustainabilityScore = Math.min(100, Math.max(0, greenPoints + heatPoints + pollPoints));

  const breakdown = {
    numCells,
    totalHeat,
    greenCount,
    buildingCount,
    emptyCount,
    industryCount,
    heatHotspots,
    totalAirflow,
    avgAirflow,
    nonEmptyCells,
    pollutionScore,
    greenPoints,
    heatPoints,
    pollPoints,
  };

  return {
    avgHeat,
    greenPercent,
    buildingCount,
    heatScore,
    urbanDensity,
    heatHotspots,
    pollutionIndex,
    sustainabilityScore,
    breakdown,
  };
};

const nf = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '0');

/**
 * Worked numbers for Live Statistics ⓘ tooltips (must match calculateMetrics).
 */
export function formatMetricTooltipCalculation(metricId, metrics) {
  const b = metrics?.breakdown;
  if (!b || !b.numCells) {
    return 'Place tiles on the grid to see step-by-step numbers for your layout.';
  }

  switch (metricId) {
    case 'avgHeat':
      return [
        `Σ (per-cell heat index) = ${nf(b.totalHeat, 2)}`,
        `Cells = ${b.numCells}`,
        `Average = ${nf(b.totalHeat, 2)} ÷ ${b.numCells} = ${nf(metrics.avgHeat, 2)}`,
        '',
        'Each cell index = sum of land-use heat weights in its 3×3 neighborhood × current weather (see heat engine).',
      ].join('\n');
    case 'greenPercent':
      return [
        `Park + forest cells = ${b.greenCount}`,
        `Total cells = ${b.numCells}`,
        `Greenery % = (${b.greenCount} ÷ ${b.numCells}) × 100 = ${nf(metrics.greenPercent, 1)}%`,
      ].join('\n');
    case 'buildingCount':
      return [`House + skyscraper + industry = ${b.buildingCount}`, '(Counted on the grid.)'].join('\n');
    case 'urbanDensity':
      return [
        `Non-empty cells = ${b.nonEmptyCells}`,
        `Total cells = ${b.numCells}`,
        `Density = (${b.nonEmptyCells} ÷ ${b.numCells}) × 100 = ${nf(metrics.urbanDensity, 1)}%`,
      ].join('\n');
    case 'heatHotspots':
      return [
        'Rule: cells with heat index > 30',
        `Count = ${b.heatHotspots}`,
      ].join('\n');
    case 'pollutionIndex': {
      const ind = (b.industryCount / 30) * 50;
      const heatPart = metrics.avgHeat > 0 ? (metrics.avgHeat / 40) * 25 : 0;
      const airPart = ((5 - b.avgAirflow) / 5) * 25;
      return [
        'Internal score (higher → worse):',
        `  Industry  = (${b.industryCount} ÷ 30) × 50 = ${nf(ind, 2)}`,
        metrics.avgHeat > 0
          ? `  Heat      = (${nf(metrics.avgHeat, 2)} ÷ 40) × 25 = ${nf(heatPart, 2)}`
          : `  Heat      = 0`,
        `  Airflow   = ((5 − ${nf(b.avgAirflow, 2)}) ÷ 5) × 25 = ${nf(airPart, 2)}`,
        `  Sum       = ${nf(b.pollutionScore, 2)}`,
        `Bands: <30 Low · 30–59 Medium · ≥60 High → ${metrics.pollutionIndex}`,
      ].join('\n');
    }
    case 'heatScore':
      return [
        `Raw scale = (${nf(metrics.avgHeat, 2)} ÷ 25) × 100 = ${nf((metrics.avgHeat / 25) * 100, 2)}`,
        `Capped to 0–100 → ${nf(metrics.heatScore, 1)}`,
      ].join('\n');
    case 'sustainabilityScore':
      return [
        `Green pts  = min((greenery% ÷ 50) × 40, 40) = ${nf(b.greenPoints, 2)}`,
        `Heat pts   = 30 − (heat intensity ÷ 100) × 30 = ${nf(b.heatPoints, 2)}`,
        `Pollution pts = 30 − (min(score,100) ÷ 100) × 30 = ${nf(b.pollPoints, 2)}`,
        `Sum → clamp 0–100 = ${nf(metrics.sustainabilityScore, 1)}`,
      ].join('\n');
    default:
      return '';
  }
}
