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

export const calculateAirflowGrid = (grid, windDirection, weather) => {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0].length;
  
  const airflowGrid = [];
  
  for (let r = 0; r < rows; r++) {
    const airflowRow = [];
    for (let c = 0; c < cols; c++) {
      let blockage = 0;
      
      // Look "upstream" to find obstacles blocking wind from reaching this cell.
      // If wind flows 'right', wind comes from the left. Obstacles are at c-1, c-2, c-3.
      if (windDirection === 'right') {
        for (let i = 1; i <= 3; i++) {
          if (c - i >= 0) blockage += BLOCKAGE_VALUES[grid[r][c - i].type] || 0;
        }
      } else if (windDirection === 'left') {
        // Wind flows left, comes from right. Obstacles at c+1, c+2, c+3.
        for (let i = 1; i <= 3; i++) {
          if (c + i < cols) blockage += BLOCKAGE_VALUES[grid[r][c + i].type] || 0;
        }
      } else if (windDirection === 'down') {
        // Wind flows down, comes from up. Obstacles at r-1, r-2, r-3.
        for (let i = 1; i <= 3; i++) {
          if (r - i >= 0) blockage += BLOCKAGE_VALUES[grid[r - i][c].type] || 0;
        }
      } else if (windDirection === 'up') {
        // Wind flows up, comes from down. Obstacles at r+1, r+2, r+3.
        for (let i = 1; i <= 3; i++) {
          if (r + i < rows) blockage += BLOCKAGE_VALUES[grid[r + i][c].type] || 0;
        }
      }
      
      const baseAirflow = weather === 'windy' ? 7 : 5;
      let airflow = baseAirflow - blockage;
      // Clamp between 0 and 5
      if (airflow < 0) airflow = 0;
      if (airflow > 5) airflow = 5;
      
      // Add a tiny variation or self-blockage if needed? 
      // User requested strictly: airflow = base - blockage
      // However the cell itself is an obstacle, but airflow usually measures air REACHING the cell or inside it. 
      // We strictly follow: look ahead 2-3 cells and subtract blockage
      
      airflowRow.push(airflow);
    }
    airflowGrid.push(airflowRow);
  }
  
  return airflowGrid;
};
