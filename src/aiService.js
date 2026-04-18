import { generateAISuggestions as fallbackAISuggestions } from './aiEngine';
import { AI_HIGH_CO2_TONS, AI_HIGH_INDUSTRY_CELLS } from './aiConstants.js';

const GEMINI_MODEL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GROQ_MODEL_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_ICON_BY_TYPE = {
  heat: '🔥',
  airflow: '🌬',
  sustainability: '✨',
  pollution: '🏭',
  greenery: '🌳',
  density: '🏙',
  carbon: '♻️',
};

/** Remove ``` / ```json fences if the model wrapped the payload. */
function stripMarkdownFence(text) {
  const t = text.trim();
  if (!t.startsWith('```')) return t;
  let rest = t.replace(/^```(?:json)?\s*\n?/i, '');
  const end = rest.indexOf('```');
  if (end !== -1) rest = rest.slice(0, end);
  return rest.trim();
}

/**
 * Gemini often appends prose after a valid JSON array. JSON.parse on the full
 * string then fails ("Unexpected non-whitespace character after JSON").
 * Extract the first top-level [...] by bracket depth, respecting strings.
 */
function extractFirstJsonArray(raw) {
  const s = raw.trim();
  const start = s.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '\\' && i + 1 < s.length) {
        i += 1;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseSuggestionsFromModelText(rawText) {
  let cleanText = stripMarkdownFence(rawText.trim());

  const arraySlice = extractFirstJsonArray(cleanText);
  if (arraySlice) {
    const suggestions = JSON.parse(arraySlice);
    if (Array.isArray(suggestions)) return suggestions;
  }

  const trimmed = cleanText.trim();
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.suggestions)) return parsed.suggestions;
    if (Array.isArray(parsed.data)) return parsed.data;
  }
  throw new Error('Model did not return a JSON array');
}

function normalizeSuggestionType(type, message = '') {
  const explicit = `${type || ''}`.toLowerCase().trim();
  if (explicit === 'carbon') return 'carbon';

  const raw = `${type || ''} ${message || ''}`.toLowerCase().replace(/[^a-z\s-]/g, ' ');
  if (/(air\s*flow|airflow|ventilation|ventilate|wind|breeze)/.test(raw)) return 'airflow';
  if (/(green|greenery|park|forest|trees?|plant|vegetation)/.test(raw)) return 'greenery';
  if (/(co2|decarbon|greenhouse|\bghg\b|net\s*zero|climate\s*mitigation)/.test(raw)) return 'carbon';
  if (/(pollution|air\s*quality|emission|industry|industrial|smog|toxin)/.test(raw)) return 'pollution';
  if (/(density|dense|crowd|congestion|overbuild|overpopulation|compact)/.test(raw)) return 'density';
  if (/(sustain|efficien|resilien|eco|climate)/.test(raw)) return 'sustainability';
  if (/(heat|hot|cool|thermal|temperature|shade|cooling)/.test(raw)) return 'heat';
  if (/(carbon\s*sink|carbon\s*credit|low\s*carbon)/.test(raw)) return 'carbon';
  return 'sustainability';
}

function normalizeSeverity(severity, type) {
  const raw = `${severity || ''}`.toLowerCase();
  if (/(red|high|critical|urgent|severe)/.test(raw)) return 'red';
  if (/(yellow|medium|moderate|warning|caution)/.test(raw)) return 'yellow';
  if (/(green|low|good|positive|safe)/.test(raw)) return 'green';
  if (type === 'heat' || type === 'pollution' || type === 'carbon') return 'red';
  if (type === 'airflow' || type === 'density') return 'yellow';
  return 'green';
}

function normalizeSuggestions(rawSuggestions) {
  return rawSuggestions
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      const message =
        typeof item.message === 'string' && item.message.trim()
          ? item.message.trim()
          : typeof item.text === 'string' && item.text.trim()
            ? item.text.trim()
            : 'No suggestion provided.';
      const type = normalizeSuggestionType(item.type, message);
      const severity = normalizeSeverity(item.severity, type);
      const icon =
        typeof item.icon === 'string' && item.icon.trim()
          ? item.icon.trim()
          : DEFAULT_ICON_BY_TYPE[type];

      return {
        id: item.id ? String(item.id) : `${type}-${index + 1}`,
        type,
        message: message.replace(/bulldoze|remove all|clear all|erase everything/gi, 'make targeted changes'),
        severity,
        icon,
      };
    });
}

function buildPromptText(cityContext) {
  const highCo2 =
    cityContext?.carbonAnalysis?.isHighNetCo2 === true ||
    Number(cityContext?.carbon?.CO2_tons) >= AI_HIGH_CO2_TONS;

  const carbonBlock = highCo2
    ? `
CRITICAL — HIGH NET CO₂ (simulated CO2_tons ≥ ${AI_HIGH_CO2_TONS} or many industrial cells):
* You MUST include at least ONE object with "type": "carbon".
* That "carbon" suggestion must give CONCRETE mitigation steps for this layout: e.g. reduce industrial / heavy-road footprint, add forests and parks as carbon sinks, shift toward mixed-use or greener zoning, efficiency and electrification in plain language.
* Phrase the message as problem + solution (what to change on the ground and why it lowers emissions).
`
    : `
* If carbon.CO2_tons is elevated or carbonCredits are low, mention emission reduction where relevant.
`;

  return `
Analyze this smart city layout and provide 3-5 actionable suggestions to improve:
* reduce heat
* improve airflow
* increase sustainability
* reduce pollution
* reduce net carbon emissions and increase carbon credits
${carbonBlock}
City Data:
${JSON.stringify(cityContext, null, 2)}

Important constraints:
* Do not suggest removing all buildings.
* Keep a minimum urban density of at least 25% active developed cells.
* Suggest minimal, targeted zoning changes only.
${highCo2 ? `* At least one suggestion MUST use type "carbon" with severity "red" or "yellow".` : ''}

Respond with ONLY a single JSON array (no markdown fences, no text before or after the array). Follow this exact structure:
[
  {
    "id": "unique-string",
    "type": "heat | airflow | sustainability | pollution | greenery | density | carbon",
    "message": "Actionable suggestion text...",
    "severity": "red | yellow | green",
    "icon": "🔥 | 🌬 | 🌳 | 🏭 | 💧 | 🏙 | ✨ | ♻️"
  }
]
`;
}

async function fetchGeminiSuggestions(promptText, apiKey) {
  const response = await fetch(`${GEMINI_MODEL_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API responded with status: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Invalid response format from Gemini API');
  }

  return normalizeSuggestions(parseSuggestionsFromModelText(rawText)).slice(0, 5);
}

/**
 * If layout is high-CO₂, guarantee at least one "carbon" row when the model omitted it.
 */
function ensureCarbonSuggestionIfHigh(suggestions, carbonAnalysis) {
  if (!carbonAnalysis?.isHighNetCo2 || !Array.isArray(suggestions)) return suggestions;
  if (suggestions.some((s) => s.type === 'carbon')) return suggestions.slice(0, 5);
  const co2 = carbonAnalysis.co2Tons != null ? ` (modeled CO₂ score ${Math.round(carbonAnalysis.co2Tons)})` : '';
  const extra = {
    id: 'carbon-mitigation-required',
    type: 'carbon',
    severity: 'red',
    icon: '♻️',
    message: `High net CO₂${co2}: reduce heavy industry and high-traffic road cells where possible; add forest and park buffers as carbon sinks; favor mixed-use and shorter travel paths. Target industrial clusters first, then widen green corridors for lasting emission cuts.`,
  };
  return [extra, ...suggestions].slice(0, 5);
}

async function fetchGroqSuggestions(promptText, apiKey) {
  const response = await fetch(GROQ_MODEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a precise JSON API. Return only the requested JSON array.',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API responded with status: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error('Invalid response format from Groq API');
  }

  return normalizeSuggestions(parseSuggestionsFromModelText(rawText)).slice(0, 5);
}

export async function getAISuggestions(grid, metrics, airflowData, carbonContext = null) {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();

  const gridSummary = {
    house: 0, skyscraper: 0, park: 0, forest: 0, water: 0, road: 0, industry: 0, empty: 0
  };

  if (grid && grid.length > 0) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const type = grid[r][c].type;
        if (gridSummary[type] !== undefined) {
          gridSummary[type]++;
        }
      }
    }
  }

  const co2Tons = Number(carbonContext?.CO2_tons ?? 0);
  const industryCells = gridSummary.industry ?? 0;
  const carbonAnalysis = {
    isHighNetCo2:
      co2Tons >= AI_HIGH_CO2_TONS || industryCells >= AI_HIGH_INDUSTRY_CELLS,
    co2Tons,
    carbonCredits: Number(carbonContext?.carbonCredits ?? 0),
    industryCells,
  };

  const cityContext = {
    metrics: metrics,
    zoningSummary: gridSummary,
    carbon: carbonContext || { CO2_tons: 0, carbonCredits: 0 },
    carbonAnalysis,
  };
  const promptText = buildPromptText(cityContext);

  if (!geminiApiKey && !groqApiKey) {
    console.warn('No LLM API keys found. Falling back to rule-based engine.');
    return Promise.resolve(fallbackAISuggestions(grid, metrics, airflowData, carbonContext));
  }

  try {
    if (geminiApiKey) {
      const out = await fetchGeminiSuggestions(promptText, geminiApiKey);
      return ensureCarbonSuggestionIfHigh(out, carbonAnalysis);
    }
    throw new Error('Gemini API key is missing');
  } catch (error) {
    console.error('Gemini API Error:', error);
  }

  try {
    if (groqApiKey) {
      const out = await fetchGroqSuggestions(promptText, groqApiKey);
      return ensureCarbonSuggestionIfHigh(out, carbonAnalysis);
    }
    throw new Error('Groq API key is missing');
  } catch (error) {
    console.error('Groq API Error:', error);
    console.warn('Falling back to rule-based engine.');
    return fallbackAISuggestions(grid, metrics, airflowData, carbonContext);
  }
}
