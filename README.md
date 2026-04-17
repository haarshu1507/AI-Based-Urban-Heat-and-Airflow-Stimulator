# 🌆 Urban Heat & Airflow Simulator

A **smart-city simulation platform** that allows users to design urban layouts and instantly visualize **heat distribution, airflow patterns, and sustainability metrics**, along with **AI-powered suggestions**.

---

## 🚀 Project Overview

Urban Heat is a browser-based simulation tool where users can:

- 🏙️ Build a custom city using a **2D grid**
- 🌍 Import real-world areas using **OpenStreetMap**
- 🌡️ Visualize **urban heat islands**
- 🌬️ Analyze **airflow and ventilation**
- 📊 Get **real-time sustainability insights**
- 🤖 Receive **AI-driven suggestions**

> Built for **SDG & Social Impact** — focusing on sustainable urban planning.

---

## 🎯 Problem Statement

Modern cities face:

- 🌡️ Rising temperatures (Urban Heat Islands)
- 🌬️ Poor airflow → pollution accumulation
- 🌱 Lack of green spaces

There is no simple tool to **visualize the impact of city design decisions**.

👉 This project solves that with an **interactive simulation platform**.

---

## ✨ Features

### 🏙️ City Builder
- 15×15 interactive grid
- Place different elements:
  - 🏠 House  
  - 🏢 Skyscraper  
  - 🌳 Forest  
  - 🌿 Park  
  - 💧 Water  
  - 🛣️ Road  
  - 🏭 Industry  

---

### 🌡️ Heat Simulation
- Based on:
  - Nearby structures (3×3 influence)
  - Land type contribution
  - Weather conditions

- Visualization:
  - 🔵 Blue → Cool
  - 🔴 Red → Hot

---

### 🌬️ Airflow Simulation
- Wind direction based
- Buildings block airflow
- Visualization:
  - 🔴 Low airflow
  - 🟢 High airflow

---

### 🌍 Real-World Map Integration
- Select any location
- Fetch data from OpenStreetMap
- Convert into simulation grid

---

### 📊 Metrics Dashboard

- 🌡️ Average Heat
- 🌱 Green Coverage %
- 🏢 Urban Density
- 🔥 Heat Hotspots
- 🌫️ Pollution Index
- ♻️ Sustainability Score

---

### 🤖 AI Suggestions
- Uses Google Gemini API (optional)
- Provides:
  - Planning improvements
  - Sustainability advice

- Works without API (rule-based fallback)

---

### 🧊 3D Visualization
- Built with Three.js
- Converts grid into a 3D city
- Heat shown using color intensity

---

## 🧠 How It Works

### Heat Calculation
- Each cell gets heat from surrounding cells
- Weather modifies intensity
- Values normalized for visualization

### Airflow Calculation
- Wind direction determines flow
- Buildings act as obstacles
- Output range: 0–5

### Metrics Calculation
- Based on heat, airflow, greenery, and buildings
- Generates sustainability score (0–100)

---

## 🛠️ Tech Stack

| Layer | Technology |
|------|-----------|
| Frontend | React 19 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS |
| 3D | Three.js |
| Maps | Leaflet + OpenStreetMap |
| AI | Google Gemini API |
| Icons | Lucide React |

> Fully client-side application (no backend required)


---

## ⚙️ Installation & Setup

```bash
# Clone repository
git clone https://github.com/your-username/urban-heat.git

# Navigate to project
cd urban-heat

# Install dependencies
npm install

# Run development server
npm run dev