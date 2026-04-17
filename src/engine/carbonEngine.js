const EMISSION_WEIGHTS = {
  industry: 10,
  skyscraper: 6,
  house: 3,
  road: 4,
};

const ABSORPTION_WEIGHTS = {
  forest: 8,
  park: 5,
  water: 2,
};

const DEFAULT_WEATHER = {
  temperature: 30,
  humidity: 50,
};

function getWeatherForCarbon(weather) {
  if (!weather) return DEFAULT_WEATHER;
  return {
    temperature: Number.isFinite(weather.temperature) ? weather.temperature : DEFAULT_WEATHER.temperature,
    humidity: Number.isFinite(weather.humidity) ? weather.humidity : DEFAULT_WEATHER.humidity,
  };
}

export function calculateCarbon(grid, weather) {
  let emission = 0;
  let absorption = 0;

  if (!Array.isArray(grid) || grid.length === 0) {
    return {
      emission,
      absorption,
      netCarbon: 0,
      CO2_tons: 0,
      carbonHotspots: 0,
    };
  }

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      const type = row[c]?.type;
      emission += EMISSION_WEIGHTS[type] || 0;
      absorption += ABSORPTION_WEIGHTS[type] || 0;
    }
  }

  const effectiveWeather = getWeatherForCarbon(weather);
  const temperatureFactor = effectiveWeather.temperature / 35;
  const humidityFactor = effectiveWeather.humidity / 100;

  emission *= 1 + 0.2 * temperatureFactor;
  absorption *= 1 + 0.1 * humidityFactor;

  const netCarbon = emission - absorption;
  const CO2_tons = netCarbon * 10;

  return {
    emission,
    absorption,
    netCarbon,
    CO2_tons,
    carbonHotspots: 0,
  };
}
