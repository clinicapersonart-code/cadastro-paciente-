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

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

function resolveGroqApiKey() {
  return process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
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

  const apiKey = resolveGroqApiKey();
  if (!apiKey) {
    return res.status(503).json({ ok: false, error: 'IA não configurada no servidor: defina GROQ_API_KEY.' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
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
      throw new Error('Resposta vazia da IA.');
    }

    return res.status(200).json({ ok: true, content });
  } catch (error: any) {
    console.error('Erro medical-record-ai:', error);
    return res.status(502).json({ ok: false, error: error?.message || 'Falha ao gerar prontuário com IA.' });
  }
}
