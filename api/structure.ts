// Vercel Serverless Function — proxy para GPT-4o (estruturação SOAP)
// A chave OPENAI_API_KEY fica server-side, nunca exposta no bundle do cliente.
const SYSTEM_PROMPT = `Você é um assistente de prontuário pediátrico brasileiro. Analise a transcrição da consulta e retorne APENAS um JSON com exatamente estes campos:

{
  "queixa_principal": "motivo principal da consulta em uma frase",
  "hda": "história da doença atual detalhada — contexto, evolução, sintomas associados",
  "exame_fisico": "achados do exame físico com sinais vitais se mencionados (peso, altura, FC, FR, Temp)",
  "hipoteses": ["hipótese diagnóstica principal", "hipótese secundária se houver"],
  "conduta": "conduta clínica e plano terapêutico detalhado",
  "retorno": "prazo ou data de retorno mencionada, ou 'Conforme necessidade' se não mencionado",
  "peso": "peso mencionado com unidade, ex: '16,4 kg' — deixe vazio se não mencionado",
  "altura": "altura mencionada com unidade, ex: '102,5 cm' — deixe vazio se não mencionado",
  "perimetro_cefalico": "perímetro cefálico mencionado com unidade, ex: '38,5 cm' — deixe vazio se não mencionado",
  "vacinas_mencionadas": ["vacina mencionada 1", "vacina mencionada 2"]
}

REGRAS:
- Responda APENAS com o JSON, sem markdown ou explicações
- Use terminologia médica pediátrica brasileira
- Se um campo não for mencionado, use string vazia ou array vazio
- Conforme CFM 2.454/2026: você é apoio à decisão, o médico revisará e validará`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada no servidor. Adicione OPENAI_API_KEY nas variáveis de ambiente do Vercel.' });
  }

  try {
    const { transcript } = req.body as { transcript: string };
    if (!transcript) return res.status(400).json({ error: 'Campo "transcript" ausente.' });

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Transcrição da consulta:\n\n${transcript}` },
        ],
      }),
    });

    if (!gptRes.ok) {
      const err = await gptRes.json().catch(() => ({}));
      return res.status(gptRes.status).json({ error: err?.error?.message || `GPT-4o retornou ${gptRes.status}` });
    }

    const data = await gptRes.json();
    const raw = JSON.parse(data.choices[0].message.content) as Record<string, unknown>;
    return res.status(200).json(raw);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erro interno ao estruturar prontuário.' });
  }
}
