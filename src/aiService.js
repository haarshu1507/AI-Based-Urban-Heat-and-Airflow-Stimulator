import { generateAISuggestions as fallbackAISuggestions } from './aiEngine';

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
  const raw = `${type || ''} ${message || ''}`.toLowerCase().replace(/[^a-z\s-]/g, ' ');
  if (/(air\s*flow|airflow|ventilation|ventilate|wind|breeze)/.test(raw)) return 'airflow';
  if (/(green|greenery|park|forest|trees?|plant|vegetation)/.test(raw)) return 'greenery';
  if (/(pollution|air\s*quality|emission|industry|industrial|smog|toxin)/.test(raw)) return 'pollution';
  if (/(density|dense|crowd|congestion|overbuild|overpopulation|compact)/.test(raw)) return 'density';
  if (/(sustain|efficien|resilien|eco|climate)/.test(raw)) return 'sustainability';
  if (/(heat|hot|cool|thermal|temperature|shade|cooling)/.test(raw)) return 'heat';
  return 'sustainability';
}

function normalizeSeverity(severity, type) {
  const raw = `${severity || ''}`.toLowerCase();
  if (/(red|high|critical|urgent|severe)/.test(raw)) return 'red';
  if (/(yellow|medium|moderate|warning|caution)/.test(raw)) return 'yellow';
  if (/(green|low|good|positive|safe)/.test(raw)) return 'green';
  if (type === 'heat' || type === 'pollution') return 'red';
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
        message,
        severity,
        icon,
      };
    });
}

function buildPromptText(cityContext) {
  return `
Analyze this smart city layout and provide 3-5 actionable suggestions to improve:
* reduce heat
* improve airflow
* increase sustainability
* reduce pollution

City Data:
${JSON.stringify(cityContext, null, 2)}

Respond with ONLY a single JSON array (no markdown fences, no text before or after the array). Follow this exact structure:
[
  {
    "id": "unique-string",
    "type": "heat | airflow | sustainability | pollution | greenery | density",
    "message": "Actionable suggestion text...",
    "severity": "red | yellow | green",
    "icon": "🔥 | 🌬 | 🌳 | 🏭 | 💧 | 🏙 | ✨"
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

export async function getAISuggestions(grid, metrics, airflowData) {
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

  const cityContext = {
    metrics: metrics,
    zoningSummary: gridSummary
  };
  const promptText = buildPromptText(cityContext);

  if (!geminiApiKey && !groqApiKey) {
    console.warn('No LLM API keys found. Falling back to rule-based engine.');
    return Promise.resolve(fallbackAISuggestions(grid, metrics, airflowData));
  }

  try {
    if (geminiApiKey) {
      return await fetchGeminiSuggestions(promptText, geminiApiKey);
    }
    throw new Error('Gemini API key is missing');
  } catch (error) {
    console.error('Gemini API Error:', error);
  }

  try {
    if (groqApiKey) {
      return await fetchGroqSuggestions(promptText, groqApiKey);
    }
    throw new Error('Groq API key is missing');
  } catch (error) {
    console.error('Groq API Error:', error);
    console.warn('Falling back to rule-based engine.');
    return fallbackAISuggestions(grid, metrics, airflowData);
  }
}
