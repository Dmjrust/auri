import type { StructuredSummary, ScannableSummary, AnamnesePrimeiraConsultaData } from '../data/mock';

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO CLÍNICA: chama OpenAI diretamente do browser via VITE_OPENAI_API_KEY.
// Simples, sem proxy, sem limite de tamanho — funciona para qualquer duração.
//
// TODO pós-validação: mover para proxy server-side (Vercel Pro + maxDuration 300s)
//   para não expor a chave no bundle de produção.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = () => import.meta.env.VITE_OPENAI_API_KEY as string;

// ── Whisper: áudio → transcrição ─────────────────────────────────────────────
export async function transcribeAudio(blob: Blob): Promise<string> {
  const key = KEY();
  if (!key || key === 'undefined') throw new Error('VITE_OPENAI_API_KEY não configurada. Adicione nas variáveis de ambiente do Vercel e faça redeploy.');
  if (blob.size === 0) throw new Error('O áudio gravado está vazio. Tente gravar novamente.');

  const form = new FormData();
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('mp3') ? 'mp3' : 'webm';
  form.append('file', blob, `consulta.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Whisper ${res.status}`);
  }
  return (await res.json()).text as string;
}

// ── GPT-4o: transcrição → prontuário estruturado ─────────────────────────────
const STRUCTURE_SYSTEM_PROMPT = `Você é um assistente de prontuário pediátrico brasileiro. Analise a transcrição da consulta e retorne APENAS um JSON com exatamente estes campos:

{
  "queixa_principal": "motivo principal da consulta em uma frase",
  "hda": "anamnese narrativa completa da consulta, incluindo todos os dados subjetivos clinicamente relevantes mencionados na transcrição",
  "exame_fisico": "achados do exame físico com sinais vitais se mencionados (peso, altura, FC, FR, Temp)",
  "hipoteses": ["hipótese diagnóstica principal", "hipótese secundária se houver"],
  "conduta": "conduta clínica e plano terapêutico detalhado",
  "retorno": "prazo ou data de retorno mencionada, ou 'Conforme necessidade' se não mencionado",
  "peso": "peso mencionado com unidade, ex: '16,4 kg' — deixe vazio se não mencionado",
  "altura": "altura mencionada com unidade, ex: '102,5 cm' — deixe vazio se não mencionado",
  "perimetro_cefalico": "perímetro cefálico mencionado com unidade, ex: '38,5 cm' — deixe vazio se não mencionado",
  "vacinas_mencionadas": ["vacina mencionada 1", "vacina mencionada 2"]
}

GLOSSÁRIO DE CONVERSÃO (termo leigo → termo técnico) — referência para a regra de normalização de vocabulário abaixo. Lista exemplificativa, não exaustiva:
- "dor de bruços" / "dor na barriga" → "dor abdominal"
- "cocô mole" / "cocô líquido" → "fezes pastosas" / "diarreia"
- "intestino preso" / "preso pra fazer cocô" → "constipação intestinal"
- "gripezinha" / "gripe forte" → "quadro de infecção de vias aéreas superiores (IVAS)"
- "garganta inflamada" / "garganta vermelha" → "orofaringe hiperemiada"
- "olho vermelho" / "olho remelando" → "hiperemia conjuntival" / "secreção conjuntival"
- "tossindo muito" / "tosse que não passa" → "tosse persistente" (especificar produtiva/seca se mencionado)
- "ouvido doendo" / "dor de ouvido" → "otalgia"
- "não quer comer" / "tá comendo pouco" → "hiporexia" / "inapetência"
- "babando muito" → "sialorreia"
- "assadura" → "dermatite de fralda"
- "brotoeja" → "miliária"
- "mancha vermelha na pele" / "pele cheia de bolinha" → "lesão eritematosa" / "exantema"
- "bolinha" / "caroço" (linfonodo) → "linfonodomegalia" / "nódulo palpável"
- "inchaço" → "edema"
- "roncando" / "ronco à noite" → "ressonar" / "respiração ruidosa"
- "cansadinho" / "respiração ruim" / "respirando rápido" → "desconforto respiratório" / "taquipneia" (especificar conforme relatado)
- "febre alta" → "hipertermia" (manter valor numérico se informado)
- "coceira" / "tá se arranhando muito" → "prurido"
- "calombo na cabeça" / "caroço na cabeça" → "tumefação" / "edema local em região cefálica"

REGRAS:
- Responda APENAS com o JSON, sem markdown ou explicações
- Use terminologia médica pediátrica brasileira
- O campo "hda" é o card de Anamnese do prontuário. Ele deve considerar a transcrição inteira e consolidar a anamnese completa, não apenas a história da doença atual.
- Em "hda", inclua quando mencionados: queixa e evolução, sintomas associados, antecedentes pessoais, internações/cirurgias, alergias, medicações em uso, alimentação, sono, eliminações, desenvolvimento, comportamento, escola/creche, adesão a tratamentos, intercorrências desde a última consulta, histórico familiar relevante, contexto social/familiar e dúvidas ou preocupações dos responsáveis.
- Se uma informação subjetiva foi obtida na consulta e é clinicamente relevante, ela deve aparecer em "hda" mesmo que não faça parte da queixa principal. Não descarte informações por falta de um campo específico.
- Ao escrever queixa_principal, hda, exame_fisico e conduta, converta termos coloquiais usados pelos pais/responsáveis, pelo paciente ou pelo médico para a terminologia técnica equivalente, usando o GLOSSÁRIO acima como referência e generalizando o mesmo princípio para termos análogos. Essa conversão é apenas de vocabulário/registro: preserve integralmente sentido, intensidade, localização, duração e gravidade exatamente como relatados. NÃO infira diagnósticos, NÃO adicione achados não mencionados e NÃO altere a gravidade. Em termo ambíguo (mais de uma interpretação técnica plausível), mantenha a expressão original entre aspas ao lado do termo técnico mais provável. Não use termos coloquiais como base para criar hipóteses em "hipoteses" que não tenham sido ditas ou sugeridas pelo médico — hipoteses reflete apenas o raciocínio clínico do médico.
- Para termos coloquiais que NÃO estejam no glossário: só converta se existir um equivalente técnico padrão, único e amplamente consensual em português do Brasil (ex.: "dor de cabeça" → "cefaleia"). Se a conversão exigir qualquer suposição clínica, ou houver mais de um equivalente plausível sem contexto suficiente para desambiguar, mantenha a expressão original do relato sem alteração — nunca crie, aproxime ou "invente" um termo técnico, e nunca substitua por um termo que implique achado/diagnóstico mais específico do que o relatado.
- Se um campo não for mencionado, use string vazia ou array vazio
- Conforme CFM 2.454/2026: você é apoio à decisão, o médico revisará e validará`;

// ── Prompt tricológico ────────────────────────────────────────────────────────
const TRICHOLOGY_STRUCTURE_PROMPT = `
Você é um assistente de prontuário tricológico brasileiro.

Sua tarefa é extrair informações de uma transcrição de consulta médica em tricologia e retornar APENAS JSON válido.

REGRAS:
- Use apenas informações explicitamente mencionadas na transcrição.
- Não invente dados clínicos.
- Não feche diagnóstico definitivo.
- Use linguagem de hipótese: "compatível com", "sugestivo de", "hipótese de".
- Ao escrever queixa_principal, hda, exame_fisico e conduta, converta termos coloquiais usados pelo paciente ou pelo médico para a terminologia tricológica/dermatológica técnica equivalente em português do Brasil (ex.: "queda de cabelo" → "alopecia" / "eflúvio"; "caspa" → "descamação do couro cabeludo" / "dermatite seborreica"), usando o GLOSSÁRIO DE CONVERSÃO abaixo como referência. Preserve integralmente sentido, intensidade, localização e tempo de evolução relatados — NÃO infira diagnósticos, classificações (Ludwig, Norwood, SALT) ou achados não mencionados. Para termos fora do glossário, só converta se houver equivalente técnico único e consensual em português do Brasil; caso contrário, mantenha a expressão original sem alteração.
- Se uma informação não for mencionada, retorne "" ou null.
- Não retorne markdown.
- Não retorne texto fora do JSON.
- Não recomende medicamentos, doses ou condutas não mencionadas pelo médico.

Retorne exatamente este schema:

{
  "queixa_principal": "",
  "hda": "",
  "exame_fisico": "",
  "hipoteses": [],
  "conduta": "",
  "retorno": "",

  "trichology": {
    "scalp_condition": "",
    "miniaturization": "",
    "rarefaction": "",
    "tricoscopy_findings": "",
    "hair_loss_pattern": "",
    "evolution_time": "",

    "classification_scores": {
      "ludwig_scale": null,
      "hamilton_norwood": null,
      "salt_score": null
    },

    "risk_factors": {
      "chemical_procedures": "",
      "hormonal_factors": "",
      "emotional_factors": "",
      "family_history": ""
    },

    "treatments_mentioned": [],
    "exams_mentioned": []
  }
}

GLOSSÁRIO DE CONVERSÃO (termo leigo → termo técnico tricológico) — lista exemplificativa, não exaustiva:
- "queda de cabelo" / "cabelo caindo muito" → "alopecia" / "eflúvio" (especificar agudo/crônico se informado)
- "cabelo ralo" / "fio fino" → "miniaturização capilar" / "rarefação"
- "caspa" → "descamação do couro cabeludo" / "dermatite seborreica"
- "couro cabeludo gorduroso" / "cabelo oleoso" → "seborreia"
- "entradas" → "recessão da linha frontal de implantação"
- "calvície" → "alopecia androgenética"
- "falha" / "falha no cabelo" / "área sem cabelo" → "placa de alopecia" / "área de rarefação"
- "couro cabeludo coçando" → "prurido do couro cabeludo"
- "couro cabeludo vermelho/irritado" → "eritema do couro cabeludo"
- "cabelo quebrando muito" → "fragilidade capilar" / "tricorrexe"

ORIENTAÇÕES DE EXTRAÇÃO:
- queixa_principal: motivo principal da consulta.
- hda: história da doença atual, tempo de evolução, progressão, sintomas associados e contexto.
- exame_fisico: achados clínicos observados ou descritos pelo médico.
- hipoteses: lista de hipóteses clínicas mencionadas ou fortemente sugeridas pela consulta, sem diagnóstico definitivo.
- conduta: plano informado pelo médico, incluindo orientações, exames, tratamentos e acompanhamento.
- retorno: prazo ou orientação de retorno, se mencionado.

CAMPOS TRICOLÓGICOS:
- scalp_condition: oleosidade, descamação, eritema, prurido, dor, inflamação ou lesões.
- miniaturization: presença, ausência ou grau de miniaturização quando mencionado.
- rarefaction: áreas de rarefação ou redução de densidade.
- tricoscopy_findings: achados de tricoscopia, se mencionados.
- hair_loss_pattern: padrão da queda, como difusa, frontal, temporal, vértex, placas, entradas ou rarefação central.
- evolution_time: tempo de evolução da queixa.
- ludwig_scale, hamilton_norwood, salt_score: preencher apenas se citado explicitamente.
- chemical_procedures: coloração, alisamento, progressiva, descoloração, tração ou outros procedimentos.
- hormonal_factors: SOP, puerpério, menopausa, anticoncepcional, tireoide ou outros fatores hormonais citados.
- emotional_factors: estresse, ansiedade, luto, trauma emocional ou eventos recentes citados.
- family_history: histórico familiar de alopecia ou doenças capilares.
- treatments_mentioned: lista de tratamentos mencionados, como minoxidil, finasterida, dutasterida, MMP, PRP, laser, LED, shampoos ou suplementos.
- exams_mentioned: lista de exames citados ou solicitados, como ferritina, vitamina D, TSH, zinco, B12, testosterona, DHEA ou hemograma.

TRANSCRIÇÃO:
`;

export function getStructurePrompt(specialty: string): string {
  return specialty === 'Tricologia' ? TRICHOLOGY_STRUCTURE_PROMPT : STRUCTURE_SYSTEM_PROMPT;
}

export async function structureSummary(transcript: string, specialty = 'Pediatria'): Promise<StructuredSummary> {
  const systemPrompt = specialty === 'Tricologia'
    ? TRICHOLOGY_STRUCTURE_PROMPT + transcript
    : STRUCTURE_SYSTEM_PROMPT;
  const userContent = specialty === 'Tricologia'
    ? '' // transcript já incluída no system prompt para Tricologia
    : `Transcrição da consulta:\n\n${transcript}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(userContent ? [{ role: 'user' as const, content: userContent }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `GPT-4o ${res.status}`);
  }
  const raw = JSON.parse((await res.json()).choices[0].message.content) as Record<string, unknown>;

  return {
    queixa_principal:    String(raw.queixa_principal    ?? ''),
    hda:                 String(raw.hda                 ?? ''),
    exame_fisico:        String(raw.exame_fisico         ?? ''),
    hipoteses:           Array.isArray(raw.hipoteses)          ? raw.hipoteses.map(String)          : [],
    conduta:             String(raw.conduta              ?? ''),
    retorno:             String(raw.retorno              ?? ''),
    // Pediatria only — empty for Tricologia
    peso:                String(raw.peso                 ?? ''),
    altura:              String(raw.altura               ?? ''),
    perimetro_cefalico:  String(raw.perimetro_cefalico   ?? ''),
    vacinas_mencionadas: Array.isArray(raw.vacinas_mencionadas) ? raw.vacinas_mencionadas.map(String) : [],
    // Tricologia only — object with hair/scalp assessment fields
    specialty_data:      raw.trichology ?? null,
  } as StructuredSummary & { specialty_data?: unknown };
}

// ── GPT-4o: consulta → prontuário escaneável ─────────────────────────────────
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

export async function generateScannableSummary(data: {
  queixa_principal: string; anamnesis: string; physical_exam: string;
  hipoteses: string[]; plan: string; peso: string; altura: string;
  perimetro_cefalico: string; vacinas_mencionadas: string[]; retorno: string;
}): Promise<ScannableSummary> {
  const input = `
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

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: SCANNABLE_SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `GPT-4o ${res.status}`);
  }
  const raw = JSON.parse((await res.json()).choices[0].message.content) as Record<string, any>;

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

// ── GPT-4o: transcrição primeira consulta → ficha de anamnese por seções ───────
//
// Prompt específico para tipo_consulta === 'primeira_vez'.
// Retorna JSON aninhado por seção (historia_atual, historia_pregressa, …)
// que é mapeado para o tipo plano AnamnesePrimeiraConsultaData pelo parser abaixo.
//
const ANAMNESE_PRIMEIRA_VEZ_SYSTEM_PROMPT = `Você é um assistente médico especializado em puericultura. Analise a transcrição da consulta e extraia as informações, classificando cada dado na seção correta:

1. HISTÓRIA ATUAL: motivo da consulta, queixa principal, sintomas e duração.
2. HISTÓRIA PREGRESSA: internações, cirurgias, alergias, histórico vacinal.
3. HISTÓRIA GESTACIONAL: número de gestações (G_P_A), semanas ao nascimento, intercorrências, tipo de parto, local, Apgar.
4. TRIAGENS NEONATAIS: teste do pezinho, orelhinha, olhinho, coraçãozinho.
5. HISTÓRIA FAMILIAR: doenças crônicas, alergias, condições relevantes por grau de parentesco.
6. HISTÓRIA SOCIOECONÔMICA: profissão dos responsáveis, tabagismo passivo, animais em casa, saneamento.

Retorne um JSON com as chaves: historia_atual, historia_pregressa, historia_gestacional, triagens_neonatais, historia_familiar, historia_socioeconomica. Cada chave contém os subcampos identificados.
Campos não mencionados na consulta retornar como null.
Nunca invente dados não mencionados pelo médico ou responsável.
Antes de retornar null em qualquer campo, releia a transcrição inteira procurando menções diretas OU indiretas a esse tópico especificamente — mesmo comentários breves dos responsáveis contam.

Use exatamente esta estrutura de subcampos:
{
  "historia_atual": {
    "motivo_consulta": null,
    "queixa_principal_duracao": null,
    "sintomas_associados": null
  },
  "historia_pregressa": {
    "internacoes": null,
    "internacoes_desc": null,
    "cirurgias": null,
    "cirurgias_desc": null,
    "alergias_medicamentos": null,
    "alergias_alimentos": null,
    "alergias_outras": null,
    "historico_vacinal": null
  },
  "historia_gestacional": {
    "gestacoes_gpa": null,
    "idade_gestacional_semanas": null,
    "intercorrencias": null,
    "intercorrencias_desc": null,
    "tipo_parto": null,
    "local_parto": null,
    "apgar_1": null,
    "apgar_5": null
  },
  "triagens_neonatais": {
    "pezinho": null,
    "orelhinha": null,
    "olhinho": null,
    "coracaozinho": null
  },
  "historia_familiar": {
    "doencas_cronicas": null,
    "alergias_familia": null,
    "alergias_familia_desc": null,
    "outras_condicoes": null
  },
  "historia_socioeconomica": {
    "profissao_responsaveis": null,
    "renda_familiar": null,
    "tabagismo_passivo": null,
    "animais": null,
    "animais_qual": null,
    "saneamento": null
  }
}

Tipos obrigatórios por campo:
- internacoes / cirurgias / intercorrencias / tabagismo_passivo / animais / alergias_familia: true | false | null
- tipo_parto: "vaginal" | "cesárea" | null
- pezinho: "realizado" | "não realizado" | "aguardando resultado" | null
- orelhinha / olhinho / coracaozinho: "passou" | "falhou" | "não realizado" | null
- Demais campos de texto: string | null
- gestacoes_gpa: formato "G2P1A0" se informado, senão null
- Conforme CFM 2.454/2026: extração de apoio à decisão, médico revisará`;

// Structured Outputs (json_schema + strict: true): garante que a resposta da
// API sempre contenha as 6 seções e os 28 subcampos abaixo (com valor ou
// null) — nunca uma seção/campo ausente, o que evita que o parser (root.<secao>
// ?? {}) descarte silenciosamente dados de seções que o modelo omitiu.
const ANAMNESE_PRIMEIRA_VEZ_SCHEMA = {
  name: 'anamnese_primeira_consulta',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['historia_atual', 'historia_pregressa', 'historia_gestacional', 'triagens_neonatais', 'historia_familiar', 'historia_socioeconomica'],
    properties: {
      historia_atual: {
        type: 'object', additionalProperties: false,
        required: ['motivo_consulta', 'queixa_principal_duracao', 'sintomas_associados'],
        properties: {
          motivo_consulta: { type: ['string', 'null'] },
          queixa_principal_duracao: { type: ['string', 'null'] },
          sintomas_associados: { type: ['string', 'null'] },
        },
      },
      historia_pregressa: {
        type: 'object', additionalProperties: false,
        required: ['internacoes', 'internacoes_desc', 'cirurgias', 'cirurgias_desc', 'alergias_medicamentos', 'alergias_alimentos', 'alergias_outras', 'historico_vacinal'],
        properties: {
          internacoes: { type: ['boolean', 'null'] },
          internacoes_desc: { type: ['string', 'null'] },
          cirurgias: { type: ['boolean', 'null'] },
          cirurgias_desc: { type: ['string', 'null'] },
          alergias_medicamentos: { type: ['string', 'null'] },
          alergias_alimentos: { type: ['string', 'null'] },
          alergias_outras: { type: ['string', 'null'] },
          historico_vacinal: { type: ['string', 'null'] },
        },
      },
      historia_gestacional: {
        type: 'object', additionalProperties: false,
        required: ['gestacoes_gpa', 'idade_gestacional_semanas', 'intercorrencias', 'intercorrencias_desc', 'tipo_parto', 'local_parto', 'apgar_1', 'apgar_5'],
        properties: {
          gestacoes_gpa: { type: ['string', 'null'] },
          idade_gestacional_semanas: { type: ['string', 'null'] },
          intercorrencias: { type: ['boolean', 'null'] },
          intercorrencias_desc: { type: ['string', 'null'] },
          tipo_parto: { type: ['string', 'null'], enum: ['vaginal', 'cesárea', null] },
          local_parto: { type: ['string', 'null'] },
          apgar_1: { type: ['string', 'null'] },
          apgar_5: { type: ['string', 'null'] },
        },
      },
      triagens_neonatais: {
        type: 'object', additionalProperties: false,
        required: ['pezinho', 'orelhinha', 'olhinho', 'coracaozinho'],
        properties: {
          pezinho: { type: ['string', 'null'], enum: ['realizado', 'não realizado', 'aguardando resultado', null] },
          orelhinha: { type: ['string', 'null'], enum: ['passou', 'falhou', 'não realizado', null] },
          olhinho: { type: ['string', 'null'], enum: ['passou', 'falhou', 'não realizado', null] },
          coracaozinho: { type: ['string', 'null'], enum: ['passou', 'falhou', 'não realizado', null] },
        },
      },
      historia_familiar: {
        type: 'object', additionalProperties: false,
        required: ['doencas_cronicas', 'alergias_familia', 'alergias_familia_desc', 'outras_condicoes'],
        properties: {
          doencas_cronicas: { type: ['string', 'null'] },
          alergias_familia: { type: ['boolean', 'null'] },
          alergias_familia_desc: { type: ['string', 'null'] },
          outras_condicoes: { type: ['string', 'null'] },
        },
      },
      historia_socioeconomica: {
        type: 'object', additionalProperties: false,
        required: ['profissao_responsaveis', 'renda_familiar', 'tabagismo_passivo', 'animais', 'animais_qual', 'saneamento'],
        properties: {
          profissao_responsaveis: { type: ['string', 'null'] },
          renda_familiar: { type: ['string', 'null'] },
          tabagismo_passivo: { type: ['boolean', 'null'] },
          animais: { type: ['boolean', 'null'] },
          animais_qual: { type: ['string', 'null'] },
          saneamento: { type: ['boolean', 'null'] },
        },
      },
    },
  },
} as const;

export async function extractAnamnesePrimeiraConsulta(transcript: string): Promise<AnamnesePrimeiraConsultaData> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_schema', json_schema: ANAMNESE_PRIMEIRA_VEZ_SCHEMA },
      temperature: 0.1,
      messages: [
        { role: 'system', content: ANAMNESE_PRIMEIRA_VEZ_SYSTEM_PROMPT },
        { role: 'user', content: `Transcrição da primeira consulta:\n\n${transcript}` },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `GPT-4o anamnese ${res.status}`);
  }
  const root = JSON.parse((await res.json()).choices[0].message.content) as Record<string, any>;

  // Destructure the six section objects (default to empty obj if section absent)
  const ha = root.historia_atual          ?? {};
  const hp = root.historia_pregressa      ?? {};
  const hg = root.historia_gestacional    ?? {};
  const tn = root.triagens_neonatais      ?? {};
  const hf = root.historia_familiar       ?? {};
  const hs = root.historia_socioeconomica ?? {};

  // Helpers: coerce null → '' for text, keep null for booleans
  const str = (v: any) => (v !== null && v !== undefined) ? String(v) : '';
  const bl  = (v: any): boolean | null => v === true ? true : v === false ? false : null;

  return {
    // ── História atual ──────────────────────────────────────────────────────
    motivo_consulta:              str(ha.motivo_consulta),
    queixa_principal_duracao:     str(ha.queixa_principal_duracao),
    sintomas_associados:          str(ha.sintomas_associados),
    // ── História pregressa ──────────────────────────────────────────────────
    internacoes:                  bl(hp.internacoes),
    internacoes_desc:             str(hp.internacoes_desc),
    cirurgias:                    bl(hp.cirurgias),
    cirurgias_desc:               str(hp.cirurgias_desc),
    alergias_medicamentos:        str(hp.alergias_medicamentos),
    alergias_alimentos:           str(hp.alergias_alimentos),
    alergias_outras:              str(hp.alergias_outras),
    historico_vacinal:            str(hp.historico_vacinal),
    // ── História gestacional ────────────────────────────────────────────────
    gestacoes_gpa:                str(hg.gestacoes_gpa),
    idade_gestacional_semanas:    str(hg.idade_gestacional_semanas),
    intercorrencias_gestacao:     bl(hg.intercorrencias),
    intercorrencias_gestacao_desc: str(hg.intercorrencias_desc),
    tipo_parto:                   str(hg.tipo_parto),
    local_parto:                  str(hg.local_parto),
    apgar_1:                      str(hg.apgar_1),
    apgar_5:                      str(hg.apgar_5),
    // ── Triagens neonatais ──────────────────────────────────────────────────
    teste_pezinho:                str(tn.pezinho),
    teste_orelhinha:              str(tn.orelhinha),
    teste_olhinho:                str(tn.olhinho),
    teste_coracaozinho:           str(tn.coracaozinho),
    // ── História familiar ───────────────────────────────────────────────────
    doencas_familia:              str(hf.doencas_cronicas),
    alergia_familia:              bl(hf.alergias_familia),
    alergia_familia_desc:         str(hf.alergias_familia_desc),
    outras_condicoes_familia:     str(hf.outras_condicoes),
    // ── História socioeconômica ─────────────────────────────────────────────
    profissao_responsaveis:       str(hs.profissao_responsaveis),
    renda_familiar:               str(hs.renda_familiar),
    tabagismo_passivo:            bl(hs.tabagismo_passivo),
    animal_domestico:             bl(hs.animais),
    animal_domestico_qual:        str(hs.animais_qual),
    agua_saneamento:              bl(hs.saneamento),
  };
}
