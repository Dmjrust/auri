// Vercel Serverless Function — proxy autenticado para OpenAI Chat Completions.
// O cliente monta o payload completo (prompts vivem em src/lib/ai.ts); aqui só
// validamos sessão, restringimos o modelo e injetamos a OPENAI_API_KEY server-side.

// Auth inline (sem import relativo: com "type":"module" o runtime ESM do
// Vercel falha ao resolver './_auth' sem extensão e derruba a função no load).
async function requireSupabaseUser(req: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: 'Supabase não configurado no servidor (SUPABASE_URL / SUPABASE_ANON_KEY).' };
  }
  const authHeader = req.headers?.authorization as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: 'Não autenticado.' };
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!res.ok) return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
  return { ok: true };
}

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
