const BASE_HEAT = {
  house: 2,
  skyscraper: 5,
  park: -3,
  forest: -5,
  water: -4,
  road: 1,
  industry: 5,
  empty: 0,
};

const LIVE_TEMP_DELTA_SCALE = 0.2;

function toLiveCellTemperature(cellHeatSum, liveWeather) {
  if (!liveWeather) return cellHeatSum;

  const ambientTemperature = liveWeather.temperature;
  const temperatureFactor = ambientTemperature / 40;
  const localizedDelta =
    cellHeatSum * LIVE_TEMP_DELTA_SCALE * (1 + 0.3 * temperatureFactor);

  return ambientTemperature + localizedDelta;
}

export const calculateHeatGrid = (grid, weatherMode, liveWeather = null) => {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0].length;
  
  const heatGrid = [];
  
  for (let r = 0; r < rows; r++) {
    const heatRow = [];
    for (let c = 0; c < cols; c++) {
      let cellHeatSum = 0;
      
      // Look at 3x3 neighborhood (including self)
      for (let nr = Math.max(0, r - 1); nr <= Math.min(rows - 1, r + 1); nr++) {
        for (let nc = Math.max(0, c - 1); nc <= Math.min(cols - 1, c + 1); nc++) {
          const type = grid[nr][nc].type;
          cellHeatSum += (BASE_HEAT[type] || 0);
        }
      }
      
      // Apply weather effect
      if (weatherMode === 'sunny') {
        cellHeatSum *= 1.2;
      } else if (weatherMode === 'rainy') {
        cellHeatSum *= 0.7;
      } else if (weatherMode === 'windy') {
        cellHeatSum *= 0.9;
      }

      cellHeatSum = toLiveCellTemperature(cellHeatSum, liveWeather);
      
      heatRow.push(cellHeatSum);
    }
    heatGrid.push(heatRow);
  }
  
  return heatGrid;
};

export const normalizeHeatGrid = (heatGrid) => {
  const rows = heatGrid.length;
  if (rows === 0) return { normalizedGrid: [], minHeat: 0, maxHeat: 0 };
  const cols = heatGrid[0].length;
  
  let minHeat = Infinity;
  let maxHeat = -Infinity;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = heatGrid[r][c];
      if (val < minHeat) minHeat = val;
      if (val > maxHeat) maxHeat = val;
    }
  }
  
  const range = maxHeat - minHeat;
  const normalizedGrid = [];
  
  for (let r = 0; r < rows; r++) {
    const normRow = [];
    for (let c = 0; c < cols; c++) {
      const val = heatGrid[r][c];
      if (range === 0) {
        normRow.push({ val, norm: 0.5 }); // Default to middle if no variance
      } else {
        normRow.push({ val, norm: (val - minHeat) / range });
      }
    }
    normalizedGrid.push(normRow);
  }
  
  return { normalizedGrid, minHeat, maxHeat };
};
