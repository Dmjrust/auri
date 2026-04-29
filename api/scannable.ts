// Vercel Serverless Function — proxy para GPT-4o (formato escaneável)
// A chave OPENAI_API_KEY fica server-side, nunca exposta no bundle do cliente.
const SCANNABLE_SYSTEM_PROMPT = `Você é um assistente de prontuário pediátrico brasileiro. Analise os dados da consulta e retorne APENAS um JSON no formato abaixo, sem markdown e sem texto adicional.

{
  "quick_summary": ["bullet 1", "bullet 2", "bullet 3"],
  "subjective_bullets": ["bullet"],
  "objective": {
    "anthropometrics": { "weight": "", "height": "", "head_circumference": "" },
    "exam_bullets": ["bullet"]
  },
  "assessment": { "main_hypothesis": "", "other_hypotheses": [""] },
  "plan": {
    "conduct_bullets": ["bullet"],
    "parent_guidance": ["bullet"],
    "medications": ["bullet"],
    "vaccines": ["bullet"],
    "return_plan": ""
  },
  "alerts": ["bullet"]
}

REGRAS:
- Não invente informações — use apenas o que foi fornecido
- Use linguagem de prontuário médico pediátrico brasileiro
- quick_summary: máx 3 bullets com os pontos clínicos mais importantes da consulta
- subjective_bullets: transforme a anamnese em bullets curtos (queixa, alimentação, sono, desenvolvimento, comportamento)
- objective.anthropometrics: extraia peso, altura e perímetro cefálico; deixe vazio se não informado
- objective.exam_bullets: transforme o exame físico em bullets; inclua apenas o que foi mencionado
- assessment.main_hypothesis: hipótese principal com linguagem conservadora ("Compatível com...", "Dentro do esperado para...")
- plan.conduct_bullets: ações clínicas diretas
- plan.parent_guidance: separe orientações específicas aos responsáveis
- plan.medications: apenas medicamentos mencionados; array vazio se nenhum
- plan.vaccines: apenas vacinas mencionadas ou orientadas
- alerts: sinais de alerta, pontos de atenção ou seguimento; se nenhum: ["Nenhum sinal de alerta identificado"]
- Conforme CFM 2.454/2026: este resumo é apoio à decisão, o médico revisará e validará`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada no servidor. Adicione OPENAI_API_KEY nas variáveis de ambiente do Vercel.' });
  }

  try {
    const input = req.body as {
      queixa_principal: string; anamnesis: string; physical_exam: string;
      hipoteses: string[]; plan: string; peso: string; altura: string;
      perimetro_cefalico: string; vacinas_mencionadas: string[]; retorno: string;
    };
    if (!input) return res.status(400).json({ error: 'Corpo da requisição ausente.' });

    const userContent = `
Queixa principal: ${input.queixa_principal || 'Não informada'}
Anamnese: ${input.anamnesis || 'Não informada'}
Exame físico: ${input.physical_exam || 'Não informado'}
Peso: ${input.peso || 'Não informado'}
Altura: ${input.altura || 'Não informada'}
Perímetro cefálico: ${input.perimetro_cefalico || 'Não informado'}
Hipóteses diagnósticas: ${(input.hipoteses || []).join('; ') || 'Não informadas'}
Conduta / plano terapêutico: ${input.plan || 'Não informada'}
Vacinas mencionadas: ${(input.vacinas_mencionadas || []).join(', ') || 'Nenhuma'}
Retorno: ${input.retorno || 'Não informado'}
    `.trim();

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          { role: 'system', content: SCANNABLE_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!gptRes.ok) {
      const err = await gptRes.json().catch(() => ({}));
      return res.status(gptRes.status).json({ error: err?.error?.message || `GPT-4o retornou ${gptRes.status}` });
    }

    const data = await gptRes.json();
    const raw = JSON.parse(data.choices[0].message.content) as Record<string, any>;
    return res.status(200).json(raw);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erro interno ao gerar resumo escaneável.' });
  }
}
