const OPEN_WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';

export async function fetchWeather(city) {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY?.trim();
  const normalizedCity = city?.trim();

  if (!normalizedCity) {
    throw new Error('City is required to fetch weather.');
  }

  if (!apiKey) {
    throw new Error('VITE_OPENWEATHER_API_KEY is missing.');
  }

  const url = `${OPEN_WEATHER_URL}?q=${encodeURIComponent(normalizedCity)}&appid=${apiKey}&units=metric`;
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'OpenWeatherMap rejected the API key. Verify the key in your OpenWeatherMap account, make sure the account email is confirmed, and wait a few minutes after generating a new key.'
      );
    }
    throw new Error(payload?.message || `OpenWeatherMap responded with status ${response.status}`);
  }

  return {
    temperature: Number(payload?.main?.temp ?? 0),
    windSpeed: Number(payload?.wind?.speed ?? 0),
    humidity: Number(payload?.main?.humidity ?? 0),
  };
}
