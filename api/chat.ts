// Vercel Serverless Function — proxy autenticado para OpenAI Chat Completions.
// O cliente monta o payload completo (prompts vivem em src/lib/ai.ts); aqui só
// validamos sessão, restringimos o modelo e injetamos a OPENAI_API_KEY server-side.

// Auth inline (sem import relativo: com "type":"module" o runtime ESM do
// Vercel falha ao resolver './_auth' sem extensão e derruba a função no load).
async function requireSupabaseUser(req: any): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
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
  const user = await res.json().catch(() => null);
  if (!user?.id) return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };

  // Conta desativada por admin não pode consumir a API paga até o token expirar.
  // RLS "leitura própria" permite ler o próprio active com o token do usuário.
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${user.id}&select=active`,
    { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } },
  );
  const profiles = profileRes.ok ? await profileRes.json().catch(() => null) : null;
  if (Array.isArray(profiles) && profiles[0]?.active === false) {
    return { ok: false, status: 403, error: 'Conta desativada. Contate o administrador do consultório.' };
  }
  return { ok: true, userId: user.id as string };
}

// Rate limit in-memory por usuário (janela deslizante de 1 min). Em serverless
// o estado vive por instância — suficiente para conter abuso de custo no piloto.
const RATE_LIMIT_PER_MIN = 15;
const rateWindow = new Map<string, number[]>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateWindow.get(userId) || []).filter(t => now - t < 60_000);
  if (hits.length >= RATE_LIMIT_PER_MIN) { rateWindow.set(userId, hits); return true; }
  hits.push(now);
  rateWindow.set(userId, hits);
  return false;
}

const ALLOWED_MODELS = new Set(['gpt-4o', 'gpt-4o-mini']);
const MAX_MESSAGES = 50;

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
  if (isRateLimited(auth.userId)) {
    return res.status(429).json({ error: 'Muitas requisições. Aguarde um minuto e tente novamente.' });
  }

  try {
    const payload = req.body as { model?: string; messages?: unknown[] };
    if (!payload?.model || !Array.isArray(payload.messages)) {
      return res.status(400).json({ error: 'Payload inválido: "model" e "messages" são obrigatórios.' });
    }
    if (payload.messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: `Payload inválido: no máximo ${MAX_MESSAGES} mensagens por requisição.` });
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
