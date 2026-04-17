import { generateAISuggestions as fallbackAISuggestions } from './aiEngine';

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
  throw new Error('Gemini API did not return a JSON array');
}

export async function getAISuggestions(grid, metrics, airflowData) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY is missing. Falling back to rule-based engine.");
    return Promise.resolve(fallbackAISuggestions(grid, metrics, airflowData));
  }

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

  const promptText = `
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

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Invalid response format from Gemini API");
    }

    const suggestions = parseSuggestionsFromModelText(rawText);
    return suggestions.slice(0, 5);

  } catch (error) {
    console.error("Gemini API Error:", error);
    console.warn("Falling back to rule-based engine.");
    return fallbackAISuggestions(grid, metrics, airflowData);
  }
}
