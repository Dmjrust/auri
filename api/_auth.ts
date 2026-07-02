// Helper compartilhado das funções serverless: valida o JWT do Supabase
// enviado pelo cliente antes de repassar qualquer chamada à OpenAI.
// Sem isso o proxy seria um endpoint aberto para consumo da quota.
// (Arquivos iniciados com "_" não viram rotas no Vercel.)

export async function requireSupabaseUser(req: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
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
