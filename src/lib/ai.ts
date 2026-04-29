import type { StructuredSummary, ScannableSummary } from '../data/mock';

// ─────────────────────────────────────────────────────────────────────────────
// PRODUÇÃO (Vercel): todas as chamadas passam por /api/* (serverless proxy).
//   → OPENAI_API_KEY fica server-side, nunca no bundle do cliente.
//
// DESENVOLVIMENTO LOCAL (vite dev): o Vite não serve /api/*, então o fallback
//   chama a OpenAI diretamente usando VITE_OPENAI_API_KEY do .env.local.
//   Esse arquivo está em .gitignore — nunca vai para o repositório.
// ─────────────────────────────────────────────────────────────────────────────

const IS_DEV = import.meta.env.DEV;
const DEV_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

// Converte ArrayBuffer → base64 em chunks (evita stack overflow em áudios grandes)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32 KB
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunkSize) as unknown as number[]));
  }
  return btoa(binary);
}

// ── Whisper: áudio → transcrição ─────────────────────────────────────────────
export async function transcribeAudio(blob: Blob): Promise<string> {
  // Desenvolvimento local: chama Whisper diretamente
  if (IS_DEV && DEV_KEY) {
    const form = new FormData();
    const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('mp3') ? 'mp3' : 'webm';
    form.append('file', blob, `consulta.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'pt');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEV_KEY}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Whisper ${res.status}`);
    }
    return (await res.json()).text as string;
  }

  // Produção: usa proxy server-side
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64, mimeType: blob.type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Transcrição falhou (${res.status})`);
  }
  return (await res.json()).text as string;
}

// ── Prompts (usados no fallback dev) ─────────────────────────────────────────
const STRUCTURE_SYSTEM_PROMPT = `Você é um assistente de prontuário pediátrico brasileiro. Analise a transcrição da consulta e retorne APENAS um JSON com exatamente estes campos:

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

async function gptJson(systemPrompt: string, userContent: string): Promise<Record<string, any>> {
  const url = IS_DEV && DEV_KEY
    ? 'https://api.openai.com/v1/chat/completions'
    : null; // produção: não usa esse caminho

  if (!url || !DEV_KEY) throw new Error('gptJson só deve ser chamado no modo dev com VITE_OPENAI_API_KEY definido');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DEV_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `GPT-4o ${res.status}`);
  }
  return JSON.parse((await res.json()).choices[0].message.content) as Record<string, any>;
}

// ── GPT-4o: transcrição → prontuário estruturado ─────────────────────────────
export async function structureSummary(transcript: string): Promise<StructuredSummary> {
  let raw: Record<string, unknown>;

  if (IS_DEV && DEV_KEY) {
    raw = await gptJson(STRUCTURE_SYSTEM_PROMPT, `Transcrição da consulta:\n\n${transcript}`);
  } else {
    const res = await fetch('/api/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Estruturação falhou (${res.status})`);
    }
    raw = await res.json();
  }

  return {
    queixa_principal:    String(raw.queixa_principal    ?? ''),
    hda:                 String(raw.hda                 ?? ''),
    exame_fisico:        String(raw.exame_fisico         ?? ''),
    hipoteses:           Array.isArray(raw.hipoteses)          ? raw.hipoteses.map(String)          : [],
    conduta:             String(raw.conduta              ?? ''),
    retorno:             String(raw.retorno              ?? ''),
    peso:                String(raw.peso                 ?? ''),
    altura:              String(raw.altura               ?? ''),
    perimetro_cefalico:  String(raw.perimetro_cefalico   ?? ''),
    vacinas_mencionadas: Array.isArray(raw.vacinas_mencionadas) ? raw.vacinas_mencionadas.map(String) : [],
  };
}

// ── GPT-4o: consulta → prontuário escaneável ─────────────────────────────────
export async function generateScannableSummary(data: {
  queixa_principal: string; anamnesis: string; physical_exam: string;
  hipoteses: string[]; plan: string; peso: string; altura: string;
  perimetro_cefalico: string; vacinas_mencionadas: string[]; retorno: string;
}): Promise<ScannableSummary> {
  const userContent = `
Queixa principal: ${data.queixa_principal || 'Não informada'}
Anamnese: ${data.anamnesis || 'Não informada'}
Exame físico: ${data.physical_exam || 'Não informado'}
Peso: ${data.peso || 'Não informado'}
Altura: ${data.altura || 'Não informada'}
Perímetro cefálico: ${data.perimetro_cefalico || 'Não informado'}
Hipóteses diagnósticas: ${data.hipoteses.join('; ') || 'Não informadas'}
Conduta / plano terapêutico: ${data.plan || 'Não informada'}
Vacinas mencionadas: ${data.vacinas_mencionadas.join(', ') || 'Nenhuma'}
Retorno: ${data.retorno || 'Não informado'}
  `.trim();

  let raw: Record<string, any>;

  if (IS_DEV && DEV_KEY) {
    raw = await gptJson(SCANNABLE_SYSTEM_PROMPT, userContent);
  } else {
    const res = await fetch('/api/scannable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Resumo escaneável falhou (${res.status})`);
    }
    raw = await res.json();
  }

  return {
    quick_summary:       Array.isArray(raw.quick_summary)       ? raw.quick_summary.map(String)       : [],
    subjective_bullets:  Array.isArray(raw.subjective_bullets)  ? raw.subjective_bullets.map(String)  : [],
    objective: {
      anthropometrics: {
        weight:             String(raw.objective?.anthropometrics?.weight           ?? ''),
        height:             String(raw.objective?.anthropometrics?.height           ?? ''),
        head_circumference: String(raw.objective?.anthropometrics?.head_circumference ?? ''),
      },
      exam_bullets: Array.isArray(raw.objective?.exam_bullets) ? raw.objective.exam_bullets.map(String) : [],
    },
    assessment: {
      main_hypothesis:  String(raw.assessment?.main_hypothesis ?? ''),
      other_hypotheses: Array.isArray(raw.assessment?.other_hypotheses) ? raw.assessment.other_hypotheses.map(String) : [],
    },
    plan: {
      conduct_bullets: Array.isArray(raw.plan?.conduct_bullets) ? raw.plan.conduct_bullets.map(String) : [],
      parent_guidance: Array.isArray(raw.plan?.parent_guidance) ? raw.plan.parent_guidance.map(String) : [],
      medications:     Array.isArray(raw.plan?.medications)     ? raw.plan.medications.map(String)     : [],
      vaccines:        Array.isArray(raw.plan?.vaccines)        ? raw.plan.vaccines.map(String)        : [],
      return_plan:     String(raw.plan?.return_plan ?? ''),
    },
    alerts: Array.isArray(raw.alerts) ? raw.alerts.map(String) : ['Nenhum sinal de alerta identificado'],
  };
}
