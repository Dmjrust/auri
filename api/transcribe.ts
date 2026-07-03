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
async function requireSupabaseUser(req: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
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
  return { ok: true };
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

  try {
    const { audioUrl, mimeType } = req.body as { audioUrl: string; mimeType: string };
    if (!audioUrl) return res.status(400).json({ error: 'Campo "audioUrl" ausente.' });

    // Baixa o áudio da URL assinada do Supabase Storage
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return res.status(502).json({ error: `Falha ao baixar áudio do armazenamento (${audioRes.status}).` });
    }
    const audioBuffer = await audioRes.arrayBuffer();

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
