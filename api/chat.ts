// Vercel Serverless Function — proxy autenticado para OpenAI Chat Completions.
// O cliente monta o payload completo (prompts vivem em src/lib/ai.ts); aqui só
// validamos sessão, restringimos o modelo e injetamos a OPENAI_API_KEY server-side.

import { requireSupabaseUser } from './_auth';

const ALLOWED_MODELS = new Set(['gpt-4o', 'gpt-4o-mini']);

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } }, // transcrições longas + laudos grandes
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY não configurada nas variáveis de ambiente do Vercel.' });
  }

  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const payload = req.body as { model?: string; messages?: unknown[] };
    if (!payload?.model || !Array.isArray(payload.messages)) {
      return res.status(400).json({ error: 'Payload inválido: "model" e "messages" são obrigatórios.' });
    }
    if (!ALLOWED_MODELS.has(payload.model)) {
      return res.status(400).json({ error: `Modelo não permitido: ${payload.model}` });
    }

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await gptRes.json().catch(() => ({}));
    if (!gptRes.ok) {
      return res.status(gptRes.status).json({ error: (data as any)?.error?.message || `OpenAI retornou ${gptRes.status}` });
    }
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erro interno no proxy da OpenAI.' });
  }
}
