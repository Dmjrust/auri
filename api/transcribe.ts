// Vercel Serverless Function — proxy para OpenAI Whisper
//
// Fluxo para áudios grandes (ex: consulta de 60 min ≈ 14 MB):
//   1. Cliente faz upload do áudio diretamente ao Supabase Storage (sem limite de tamanho).
//   2. Cliente gera URL assinada (2h) e envia ao servidor como JSON tiny (~200 bytes).
//   3. Este servidor baixa o áudio via URL assinada e repassa ao Whisper.
//   4. Arquivo deletado pelo cliente após a transcrição (LGPD).
//
// A chave OPENAI_API_KEY fica server-side, nunca exposta no bundle do cliente.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb', // body é só JSON com a URL — nenhum áudio passa aqui
    },
  },
};

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
  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!authRes.ok) return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
  const user = await authRes.json().catch(() => null);
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
// 3/min: uma transcrição cobre a consulta inteira; retries legítimos cabem.
const RATE_LIMIT_PER_MIN = 3;
const rateWindow = new Map<string, number[]>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateWindow.get(userId) || []).filter(t => now - t < 60_000);
  if (hits.length >= RATE_LIMIT_PER_MIN) { rateWindow.set(userId, hits); return true; }
  hits.push(now);
  rateWindow.set(userId, hits);
  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'API key não configurada no servidor. Adicione OPENAI_API_KEY nas variáveis de ambiente do Vercel.',
    });
  }

  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (isRateLimited(auth.userId)) {
    return res.status(429).json({ error: 'Muitas transcrições em sequência. Aguarde um minuto e tente novamente.' });
  }

  try {
    const { audioUrl, mimeType } = req.body as { audioUrl: string; mimeType: string };
    if (!audioUrl) return res.status(400).json({ error: 'Campo "audioUrl" ausente.' });

    // Anti-SSRF: só aceita signed URLs do bucket consult-audio deste projeto —
    // sem isso, qualquer URL do body seria baixada e repassada ao Whisper.
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const allowedPrefix = `${supabaseUrl}/storage/v1/object/sign/consult-audio/`;
    if (!supabaseUrl || !audioUrl.startsWith(allowedPrefix)) {
      return res.status(400).json({ error: 'audioUrl inválida: apenas áudios do bucket consult-audio são aceitos.' });
    }

    // Baixa o áudio da URL assinada do Supabase Storage
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return res.status(502).json({ error: `Falha ao baixar áudio do armazenamento (${audioRes.status}).` });
    }
    const MAX_AUDIO_BYTES = 30 * 1024 * 1024; // Whisper aceita 25MB; margem para headers/container
    const declaredSize = Number(audioRes.headers.get('content-length') || 0);
    if (declaredSize > MAX_AUDIO_BYTES) {
      return res.status(413).json({ error: 'Áudio excede o limite de 30 MB.' });
    }
    const audioBuffer = await audioRes.arrayBuffer();
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      return res.status(413).json({ error: 'Áudio excede o limite de 30 MB.' });
    }

    // Constrói FormData para o Whisper
    const ext = mimeType?.includes('mp4') ? 'mp4' : mimeType?.includes('mp3') ? 'mp3' : 'webm';
    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), `consulta.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'pt');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      return res.status(whisperRes.status).json({
        error: err?.error?.message || `Whisper retornou ${whisperRes.status}`,
      });
    }

    const data = await whisperRes.json();
    return res.status(200).json({ text: data.text });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erro interno ao transcrever áudio.' });
  }
}
