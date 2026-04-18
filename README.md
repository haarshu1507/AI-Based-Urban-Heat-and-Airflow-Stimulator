# Urban Heat & Airflow Simulator

Interactive smart-city simulator to explore how land-use choices influence local heat, airflow, pollution, and sustainability scores.

## Project Snapshot

This app combines a manual city builder with real-world OSM import, **OpenWeatherMap**-backed simulation inputs (fetched automatically on load), AI suggestions, and synchronized multi-view visualization.

**Defaults**

- **Weather API city:** `Allahabad` (used for OpenWeatherMap queries; aligns with the Prayagraj area in common geocoding databases).
- **Map / OSM default view:** centered on the **Prayagraj** region (bounding box in `src/osm/overpass.js`).

Main capabilities:

- edit an urban layout on a grid and compare outcomes before/after
- choose construction types from a **grid of cards** in the right-hand control panel (no dropdown)
- import visible map bounds from OpenStreetMap (Overpass) into the same simulation grid
- run heat and airflow models with weather-aware behavior
- inspect results in `2D`, `Heatmap`, `Airflow`, `Weather`, `3D`, and `Select` (map import) modes
- generate AI optimization suggestions with API fallback logic
- optional carbon / CO₂-style estimates tied to the grid and live weather (see app metrics / insights)

## Current Features

### 1) City Editing and Views

- land-use tools are shown as **small cards in a grid** in the right panel (not a dropdown)
- editable grid with land-use tools:
  - `house`
  - `skyscraper`
  - `park`
  - `forest`
  - `water`
  - `road`
  - `industry`
  - `empty` (erase)
- synchronized rendering across:
  - `2D`
  - `Heatmap`
  - `Airflow`
  - `Weather`
  - `3D`
  - `Select` (real-world map mode)

### 2) Real-World OSM Import

- Leaflet map with pan/zoom based visible-area import
- OSM feature extraction using Overpass for:
  - buildings
  - landuse (including industrial/construction/green landuse tags)
  - parks/greenery
  - water features
  - roads
  - worship and hospital POIs
- adaptive grid sizing based on geographic extent (target meter-sized cells)
- empty cells rendered clearly (black fill with red cross marker)
- roads not shown as icon overlays by default
- hospital POIs rendered with a dedicated hospital icon in map overlay
- worship features mapped into residential/house zoning in simulation

### 3) Simulation Engine

Heat model:

- neighborhood-based influence (`3x3`) over land-use types
- weather mode impact (`sunny`, `rainy`, `windy`) — derived from live readings when available, otherwise from your **Weather preset** in the control panel
- when OpenWeather returns data, **cell temperatures** use the API **ambient temperature** as a baseline and blend in land-use effects (see [OpenWeather and temperature](#openweather-and-temperature))

Airflow model:

- wind-direction propagation
- obstacle-based attenuation by urban form
- when OpenWeather returns data, **wind speed** scales airflow and affects how far “upstream” blockage is felt

### OpenWeather and temperature

**Yes — the weather API is used for temperature calculation when the fetch succeeds.**

Flow:

1. On startup, the app requests weather for the default city (**Allahabad**) using `VITE_OPENWEATHER_API_KEY`.
2. `heatEngine.js` builds a per-cell value from land use (`3x3` neighborhood), applies sunny/rainy/windy multipliers, then calls `toLiveCellTemperature(...)`.
3. If `liveWeather` is present, each cell’s value becomes roughly: **ambient temperature from the API** plus a **localized delta** derived from the land-use sum (so the map reacts to both real outdoor conditions and your urban layout).
4. If the API is missing or fails, `liveWeather` is `null` and the heat model falls back to the raw land-use sum path (no real-world °C baseline).

Wind and humidity from the same API are also used elsewhere: e.g. **airflow** uses `windSpeed` when available; the effective weather mode (sunny / rainy / windy) can be influenced by live wind, humidity, and temperature in `App.jsx`.

### 4) Metrics and Insights

Live metrics include:

- average temperature
- greenery percentage
- building count / urban density
- heat hotspots
- pollution index
- heat intensity
- sustainability score

### 5) AI Suggestions

- tries Gemini first
- falls back to Groq
- falls back to rule-based suggestions if external AI providers are unavailable
- when **net CO₂ is high** (modeled `CO2_tons` ≥ threshold in `src/aiConstants.js`, or many industrial cells), prompts require a **`carbon`** suggestion with **concrete decarbonization steps**; LLM output is padded with a fallback carbon row if missing
- suggestion clicks highlight relevant cells in the grid/map

### 6) 3D Scene

- Three.js city rendering of the active grid state
- consistent with current layout and simulation context

## Tech Stack

- `React 19`
- `Vite 7`
- `Tailwind CSS 4`
- `Leaflet`
- `OpenStreetMap / Overpass`
- `Three.js`
- `Lucide React`
- `Google Gemini API`
- `Groq API`
- `OpenWeatherMap API`

## Setup and Run

### Prerequisites

- Node.js `18+` (recommended: latest LTS)
- npm (comes with Node.js)

### 1) Clone and install

```bash
git clone <your-repository-url>
cd urban-heat-simulator
npm install
```

### 2) Create required API keys

You should create keys for external providers used by this app:

- Gemini key (Google AI Studio): [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- Groq key: [https://console.groq.com/keys](https://console.groq.com/keys)
- OpenWeatherMap key: [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)

### 3) Create local `.env`

Create a `.env` file in the project root:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GROQ_API_KEY=your_groq_api_key
VITE_OPENWEATHER_API_KEY=your_openweather_api_key
```

Important notes:

- never commit `.env` to git
- frontend env vars must be prefixed with `VITE_`
- there is **no city search box** in the UI for weather; the default city is fixed in code (`Allahabad`). To use another city, change `DEFAULT_WEATHER_CITY` in `src/App.jsx` or extend the app with a settings field.
- app can still run without all keys, but:
  - no OpenWeather key → weather fetch fails; simulation uses presets only and no live ambient temperature baseline
  - no Gemini/Groq keys → AI suggestions fall back to rule-based logic

### 4) Run the app

```bash
npm run dev
```

Open the local URL shown in terminal (typically `http://localhost:3002`).

### 5) Build for production

```bash
npm run build
npm run preview
```

## Scripts

- `npm run dev` - start development server
- `npm run build` - create production build
- `npm run preview` - preview production build locally

## Troubleshooting

- OSM import does not load:
  - zoom in and retry (very large areas can be rate-limited or heavy)
  - verify internet access to Overpass endpoints
- OpenWeather fetch fails or wrong location:
  - check `VITE_OPENWEATHER_API_KEY` and that the key is activated on OpenWeather
  - default query city is **Allahabad**; adjust `DEFAULT_WEATHER_CITY` in `src/App.jsx` if needed
- AI suggestions unavailable:
  - verify `VITE_GEMINI_API_KEY` and/or `VITE_GROQ_API_KEY`
  - if both are missing/invalid, rule-based suggestions are used

## Roadmap (Current Direction)

- improve OSM coverage and mapping fidelity
- enhance model realism for climate and airflow dynamics
- expand scoring/analysis capabilities
