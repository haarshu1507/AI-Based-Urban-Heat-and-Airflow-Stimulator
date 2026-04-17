const BLOCKAGE_VALUES = {
  house: 1,
  skyscraper: 4,
  industry: 3,
  road: 0,
  park: 0,
  forest: 1,
  water: 0,
  empty: 0,
};

function getWeightedBlockage(grid, r, c, rows, cols, windDirection, lookAhead, propagationBoost) {
  let blockage = 0;

  for (let i = 1; i <= lookAhead; i++) {
    let cellType = null;
    if (windDirection === 'right' && c - i >= 0) cellType = grid[r][c - i].type;
    else if (windDirection === 'left' && c + i < cols) cellType = grid[r][c + i].type;
    else if (windDirection === 'down' && r - i >= 0) cellType = grid[r - i][c].type;
    else if (windDirection === 'up' && r + i < rows) cellType = grid[r + i][c].type;

    if (!cellType) continue;

    const attenuation = 1 + propagationBoost * (i - 1);
    blockage += (BLOCKAGE_VALUES[cellType] || 0) / attenuation;
  }

  return blockage;
}

export const calculateAirflowGrid = (grid, windDirection, weatherMode, liveWeather = null) => {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0].length;
  
  const airflowGrid = [];
  
  for (let r = 0; r < rows; r++) {
    const airflowRow = [];
    for (let c = 0; c < cols; c++) {
      const windSpeed = liveWeather?.windSpeed ?? null;
      const windFactor = liveWeather ? windSpeed / 10 : 1;
      const highWind = windSpeed != null && windSpeed >= 6;
      const lowWind = windSpeed != null && windSpeed < 1;
      const lookAhead = highWind ? 5 : 3;
      const propagationBoost = highWind ? 0.35 : 0;

      const blockage = getWeightedBlockage(
        grid,
        r,
        c,
        rows,
        cols,
        windDirection,
        lookAhead,
        propagationBoost
      );

      const baseAirflow = weatherMode === 'windy' ? 7 : 5;
      let airflow = baseAirflow - blockage;

      if (liveWeather) {
        airflow *= 1 + windFactor;
        if (lowWind) airflow *= 0.35;
      } else if (weatherMode === 'windy') {
        airflow = Math.min(5, airflow * 1.25 + 0.35);
      }

      if (airflow < 0) airflow = 0;
      if (airflow > 5) airflow = 5;

      airflowRow.push(airflow);
    }
    airflowGrid.push(airflowRow);
  }
  
  return airflowGrid;
};
