import type { StructuredSummary, ScannableSummary } from '../data/mock';

// ─────────────────────────────────────────────────────────────────────────────
// Todas as chamadas à OpenAI passam por Vercel Serverless Functions (/api/*).
// A chave OPENAI_API_KEY fica server-side e nunca é incluída no bundle do cliente.
// ─────────────────────────────────────────────────────────────────────────────

// Converte ArrayBuffer em base64 em chunks para não explodir a call stack
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32 KB por chunk
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunkSize) as unknown as number[]));
  }
  return btoa(binary);
}

// ── Whisper: áudio → transcrição ─────────────────────────────────────────────
export async function transcribeAudio(blob: Blob): Promise<string> {
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

  const data = await res.json();
  return data.text as string;
}

// ── GPT-4o: transcrição → prontuário estruturado ─────────────────────────────
export async function structureSummary(transcript: string): Promise<StructuredSummary> {
  const res = await fetch('/api/structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Estruturação falhou (${res.status})`);
  }

  const raw = await res.json() as Record<string, unknown>;

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
  queixa_principal: string;
  anamnesis: string;
  physical_exam: string;
  hipoteses: string[];
  plan: string;
  peso: string;
  altura: string;
  perimetro_cefalico: string;
  vacinas_mencionadas: string[];
  retorno: string;
}): Promise<ScannableSummary> {
  const res = await fetch('/api/scannable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Resumo escaneável falhou (${res.status})`);
  }

  const raw = await res.json() as Record<string, any>;

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
