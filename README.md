# Urban Heat & Airflow Simulator

Interactive smart-city simulator to explore how land-use choices influence local heat, airflow, pollution, and sustainability scores.

## Project Snapshot

This app combines a manual city builder with real-world OSM import, live weather integration, AI suggestions, and synchronized multi-view visualization.

Main capabilities:

- edit an urban layout on a grid and compare outcomes before/after
- import visible map bounds from OpenStreetMap (Overpass) into the same simulation grid
- run heat and airflow models with weather-aware behavior
- inspect results in `2D`, `Heatmap`, `Airflow`, `Weather`, `3D`, and `Select` (map import) modes
- generate AI optimization suggestions with API fallback logic

## Current Features

### 1) City Editing and Views

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
- weather mode impact (`sunny`, `rainy`, `windy`)
- optional live-weather baseline from OpenWeather

Airflow model:

- wind-direction propagation
- obstacle-based attenuation by urban form
- weather-aware airflow adjustments

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
- app can still run without all keys, but:
  - no OpenWeather key -> live weather fetch fails and fallback weather behavior is used
  - no Gemini/Groq keys -> AI suggestions fall back to rule-based logic

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
- Live weather fails:
  - check `VITE_OPENWEATHER_API_KEY`
  - confirm API key is active in OpenWeather dashboard
- AI suggestions unavailable:
  - verify `VITE_GEMINI_API_KEY` and/or `VITE_GROQ_API_KEY`
  - if both are missing/invalid, rule-based suggestions are used

## Roadmap (Current Direction)

- improve OSM coverage and mapping fidelity
- enhance model realism for climate and airflow dynamics
- expand scoring/analysis capabilities
