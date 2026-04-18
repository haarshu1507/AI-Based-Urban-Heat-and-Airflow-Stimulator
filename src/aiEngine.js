import { AI_HIGH_CO2_TONS, AI_HIGH_INDUSTRY_CELLS } from './aiConstants.js';

export const generateAISuggestions = (grid, metrics, airflowData, carbonContext = null) => {
  const suggestions = [];

  const numCells = grid.length * grid[0].length;
  if (!metrics || numCells === 0) return suggestions;

  const co2Tons = Number(carbonContext?.CO2_tons ?? 0);
  let industryCount = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c].type === 'industry') industryCount += 1;
    }
  }
  const highCarbon =
    co2Tons >= AI_HIGH_CO2_TONS || industryCount >= AI_HIGH_INDUSTRY_CELLS;

  // If grid is empty or minimal
  if (metrics.buildingCount === 0 && metrics.greenPercent === 0) {
    suggestions.push({
      id: 'empty-grid',
      type: 'info',
      icon: '💡',
      message: 'City is empty. Start placing zones to see dynamic AI insights.',
      severity: 'green'
    });
    return suggestions;
  }

  // High CO₂ — mitigation first (rule-based)
  if (highCarbon) {
    const co2Label =
      co2Tons > 0 ? ` Modeled CO₂ score ~${Math.round(co2Tons)}.` : '';
    suggestions.push({
      id: 'carbon-high-mitigation',
      type: 'carbon',
      icon: '♻️',
      severity: 'red',
      message: `High net CO₂.${co2Label} Solution: replace some industrial cells with parks, forests, or water buffers; reduce dense road grids where possible; add mixed housing/park ribbons to cut travel-related emissions. Set a greener baseline, then compare Before/After.`,
    });
  }

  // 1. Heat Analysis
  if (metrics.avgHeat > 30) {
    suggestions.push({
      id: 'heat-critical',
      type: 'heat',
      icon: '🔥',
      message: 'Critical heat levels detected. Add deep forests and water bodies to cool the city center.',
      severity: 'red'
    });
  } else if (metrics.heatHotspots >= 2) {
    suggestions.push({
      id: 'heat-hotspots',
      type: 'heat',
      icon: '🌡',
      message: 'Isolated heat hotspots identified. Target dense concrete clusters with new parks.',
      severity: 'yellow'
    });
  }

  // 2. Greenery Analysis
  if (metrics.greenPercent < 15) {
    suggestions.push({
      id: 'greenery-low',
      type: 'greenery',
      icon: '🌳',
      message: 'Green coverage is hazardously low. Plant trees immediately to improve air quality.',
      severity: 'red'
    });
  } else if (metrics.greenPercent >= 40 && metrics.avgHeat < 20) {
    suggestions.push({
      id: 'greenery-good',
      type: 'greenery',
      icon: '✨',
      message: 'Excellent green coverage. Urban design is naturally combating thermal accumulation.',
      severity: 'green'
    });
  }

  // 3. Pollution Analysis
  if (metrics.pollutionIndex === 'High') {
    suggestions.push({
      id: 'pollution-high',
      type: 'pollution',
      icon: '🏭',
      message: 'Hazardous pollution index. Urgent: reduce industrial density or increase cross-ventilation.',
      severity: 'red'
    });
  } else if (metrics.pollutionIndex === 'Medium') {
    suggestions.push({
      id: 'pollution-medium',
      type: 'pollution',
      icon: '🌫',
      message: 'Rising pollution levels. Buffer industrial zones with large parks to filter toxins.',
      severity: 'yellow'
    });
  }

  // 4. Urban Density Rules
  if (metrics.urbanDensity > 75) {
    suggestions.push({
      id: 'density-high',
      type: 'density',
      icon: '🏙',
      message: 'Dangerous overpopulation limit approaching. Widen main roads to stop heat-trapping.',
      severity: 'yellow'
    });
  } else if (metrics.urbanDensity > 20 && metrics.sustainabilityScore > 80) {
    suggestions.push({
      id: 'density-good',
      type: 'density',
      icon: '🏆',
      message: 'Highly sustainable layout achieved. Balanced development with great eco-harmony.',
      severity: 'green'
    });
  }

  // 5. Airflow Analysis
  if (airflowData && airflowData.length > 0) {
    let totalAirflow = 0;
    for (let r=0; r<grid.length; r++) {
      for (let c=0; c<grid[r].length; c++) {
        totalAirflow += airflowData[r][c];
      }
    }
    const avgAir = totalAirflow / numCells;
    
    if (avgAir < 1.5 && metrics.buildingCount > 15) {
       suggestions.push({
         id: 'airflow-low',
         type: 'airflow',
         icon: '🌬',
         message: 'Wind flow is severely obstructed. Create a few targeted ventilation corridors while preserving core buildings.',
         severity: 'red'
       });
    }
  }

  // Sort by severity (red first); tie-break: carbon suggestions before others
  const priority = { 'red': 1, 'yellow': 2, 'green': 3 };
  suggestions.sort((a, b) => {
    const pa = priority[a.severity] ?? 9;
    const pb = priority[b.severity] ?? 9;
    if (pa !== pb) return pa - pb;
    if (a.type === 'carbon' && b.type !== 'carbon') return -1;
    if (b.type === 'carbon' && a.type !== 'carbon') return 1;
    return 0;
  });

  return suggestions.slice(0, 5);
};
