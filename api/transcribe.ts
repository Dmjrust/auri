// Vercel Serverless Function — proxy para OpenAI Whisper
// Recebe multipart/form-data diretamente do cliente (sem base64).
// A chave OPENAI_API_KEY fica server-side, nunca exposta no bundle do cliente.

// Desabilita o body parser padrão do Vercel para receber o stream bruto.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada no servidor. Adicione OPENAI_API_KEY nas variáveis de ambiente do Vercel.' });
  }

  try {
    // Coleta o body bruto (multipart/form-data com o áudio)
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    // Repassa o FormData diretamente ao Whisper (sem decodificar/recodificar)
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': req.headers['content-type'], // mantém o boundary multipart
      },
      body,
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
