// Vercel Serverless Function — proxy para OpenAI Whisper
// A chave OPENAI_API_KEY fica server-side, nunca exposta no bundle do cliente.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada no servidor. Adicione OPENAI_API_KEY nas variáveis de ambiente do Vercel.' });
  }

  try {
    const { audio, mimeType } = req.body as { audio: string; mimeType: string };
    if (!audio) return res.status(400).json({ error: 'Campo "audio" ausente no corpo da requisição.' });

    // Decodifica base64 → Buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    const ext = mimeType?.includes('mp4') ? 'mp4' : mimeType?.includes('mp3') ? 'mp3' : 'webm';

    // Constrói FormData para o Whisper (Node 18+ tem FormData nativo)
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
      return res.status(whisperRes.status).json({ error: err?.error?.message || `Whisper retornou ${whisperRes.status}` });
    }

    const data = await whisperRes.json();
    return res.status(200).json({ text: data.text });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erro interno ao transcrever áudio.' });
  }
}
