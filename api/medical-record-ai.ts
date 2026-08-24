type Req = {
  method?: string;
  body?: any;
};

type Res = {
  status: (code: number) => Res;
  json: (body: any) => void;
  setHeader: (name: string, value: string) => void;
};

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

function resolveGroqApiKey() {
  return process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
}

function resolveGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
}

async function generateWithGroq(prompt: string) {
  const apiKey = resolveGroqApiKey();
  if (!apiKey) return null;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  const data = await response.json().catch(() => ({})) as GroqResponse;

  if (!response.ok) {
    const message = data.error?.message || `Groq API error (${response.status})`;
    throw new Error(message);
  }

  const content = data.choices?.[0]?.message?.content || '';
  if (!content.trim()) {
    throw new Error('Resposta vazia da Groq.');
  }

  return { provider: 'groq', content };
}

async function generateWithGemini(prompt: string) {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    }),
  });

  const data = await response.json().catch(() => ({})) as GeminiResponse;

  if (!response.ok) {
    const message = data.error?.message || `Gemini API error (${response.status})`;
    throw new Error(message);
  }

  const content = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || '';
  if (!content) {
    throw new Error('Resposta vazia da Gemini.');
  }

  return { provider: 'gemini', content };
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'Prompt vazio.' });
  }

  const configuredProviders = [
    resolveGroqApiKey() ? 'groq' : null,
    resolveGeminiApiKey() ? 'gemini' : null,
  ].filter(Boolean);

  if (configuredProviders.length === 0) {
    return res.status(503).json({
      ok: false,
      error: 'IA não configurada no servidor: defina GROQ_API_KEY ou GEMINI_API_KEY na Vercel.',
    });
  }

  const errors: string[] = [];

  for (const generate of [generateWithGroq, generateWithGemini]) {
    try {
      const result = await generate(prompt);
      if (result) {
        return res.status(200).json({ ok: true, provider: result.provider, content: result.content });
      }
    } catch (error: any) {
      console.error('Erro medical-record-ai provider:', error);
      errors.push(error?.message || 'Erro desconhecido em provedor de IA.');
    }
  }

  return res.status(502).json({
    ok: false,
    error: errors.length ? errors.join(' | ') : 'Falha ao gerar prontuário com IA.',
  });
}
