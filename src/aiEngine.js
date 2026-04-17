export const generateAISuggestions = (grid, metrics, airflowData) => {
  const suggestions = [];

  const numCells = grid.length * grid[0].length;
  if (!metrics || numCells === 0) return suggestions;

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
         message: 'Wind flow is severely obstructed. Bulldoze solid blocks to create ventilation corridors.',
         severity: 'red'
       });
    }
  }

  // Sort by severity (red = highest priority)
  const priority = { 'red': 1, 'yellow': 2, 'green': 3 };
  suggestions.sort((a, b) => priority[a.severity] - priority[b.severity]);

  // Limit to 4 max
  return suggestions.slice(0, 4);
};
