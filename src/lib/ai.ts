import type {
  StructuredSummary, ScannableSummary, AnamnesePrimeiraConsultaData, AnamneseAdultaData, LabMarker,
  ConsultaAdultoData, VitaisAdulto, ProblemaAtivo, Medication, Allergy, MedicationChange, RespostaTratamento,
} from '../data/mock';
import { calcImc } from './auri-utils';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Em produção, TODAS as chamadas à OpenAI passam pelo proxy autenticado em
// /api (Vercel Functions) — a chave OPENAI_API_KEY vive só no servidor e nunca
// entra no bundle. Em dev (vite/vitest), chama a OpenAI direto com
// VITE_OPENAI_API_KEY para não exigir `vercel dev` local.
// ─────────────────────────────────────────────────────────────────────────────

const IS_DEV = import.meta.env.DEV;
const DEV_KEY = () => import.meta.env.VITE_OPENAI_API_KEY as string;

// Limite documentado da API Whisper (corpo multipart/form-data, ~25MB).
// A gravação usa Opus a 24kbps (~180KB/min) — cobre até ~2h20 de consulta.
// https://platform.openai.com/docs/guides/speech-to-text
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 26214400 bytes

const AI_TIMEOUT_MS = 5 * 60 * 1000;

async function sessionBearer(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Faça login novamente para usar a transcrição por IA.');
  return `Bearer ${session.access_token}`;
}

// fetch com timeout de 5min e 1 retry para falha de rede / 429 / 5xx.
async function fetchAI(url: string, init: RequestInit, label: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if ((res.status === 429 || res.status >= 500) && attempt === 0) continue;
      return res;
    } catch (e: any) {
      if (attempt === 0) continue; // falha de rede/timeout → 1 retry
      if (e?.name === 'AbortError') throw new Error(`${label}: tempo limite excedido (5 min). Verifique a conexão e tente novamente.`);
      throw new Error(`${label}: falha de rede. Verifique a conexão e tente novamente.`);
    } finally {
      clearTimeout(timer);
    }
  }
}

// Chat completion via proxy (produção) ou direto (dev). Retorna o JSON completo
// da resposta da OpenAI ({ choices: [...] }).
async function chatCompletion(payload: Record<string, unknown>, label = 'GPT-4o'): Promise<any> {
  const url = IS_DEV ? 'https://api.openai.com/v1/chat/completions' : '/api/chat';
  const auth = IS_DEV ? `Bearer ${DEV_KEY()}` : await sessionBearer();
  const res = await fetchAI(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, label);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `${label} ${res.status}`);
  }
  return res.json();
}

// ── Whisper: áudio → transcrição ─────────────────────────────────────────────
export async function transcribeAudio(blob: Blob): Promise<string> {
  if (blob.size === 0) throw new Error('O áudio gravado está vazio. Tente gravar novamente.');
  if (blob.size > MAX_AUDIO_BYTES) {
    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `O áudio gravado (${sizeMb} MB) excede o limite de 25 MB da transcrição automática. ` +
      `Use "Continuar sem IA" para preencher o prontuário manualmente com base na consulta.`
    );
  }

  if (IS_DEV) return transcribeDirect(blob);
  return transcribeViaProxy(blob);
}

// Dev only: Whisper direto do browser com VITE_OPENAI_API_KEY.
async function transcribeDirect(blob: Blob): Promise<string> {
  const key = DEV_KEY();
  if (!key || key === 'undefined') throw new Error('VITE_OPENAI_API_KEY não configurada para desenvolvimento local.');

  const form = new FormData();
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('mp3') ? 'mp3' : 'webm';
  form.append('file', blob, `consulta.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const res = await fetchAI('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  }, 'Whisper');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Whisper ${res.status}`);
  }
  return (await res.json()).text as string;
}

// Produção: sobe o áudio ao bucket privado consult-audio, gera signed URL curta
// e envia ao proxy /api/transcribe. O arquivo é deletado ao final (LGPD) —
// sucesso ou falha.
async function transcribeViaProxy(blob: Blob): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Faça login novamente para usar a transcrição por IA.');

  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('mp3') ? 'mp3' : 'webm';
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from('consult-audio');

  const { error: uploadError } = await bucket.upload(path, blob, { contentType: blob.type || 'audio/webm' });
  if (uploadError) throw new Error(`Falha ao enviar o áudio para transcrição: ${uploadError.message}`);

  try {
    const { data: signed, error: signError } = await bucket.createSignedUrl(path, 60 * 60 * 2);
    if (signError || !signed) throw new Error('Falha ao preparar o áudio para transcrição.');

    const res = await fetchAI('/api/transcribe', {
      method: 'POST',
      headers: { Authorization: await sessionBearer(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: signed.signedUrl, mimeType: blob.type || 'audio/webm' }),
    }, 'Transcrição');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Transcrição falhou (${res.status})`);
    }
    return (await res.json()).text as string;
  } finally {
    bucket.remove([path]).catch(() => { /* melhor esforço — bucket é privado por médico */ });
  }
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
  "vacinas_mencionadas": ["vacina mencionada 1", "vacina mencionada 2"],
  "exames_solicitados": ["exame que o médico disse que vai pedir/solicitar 1", "exame 2"]
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
- Em "exames_solicitados", liste apenas exames que o médico afirmou explicitamente que vai pedir/solicitar nesta consulta (ex.: "vou pedir um hemograma", "vamos solicitar TSH"). Não inclua exames já trazidos pelo paciente, mencionados apenas hipoteticamente, ou citados pelo paciente/responsável. Array vazio se nenhum exame foi solicitado.
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

// ── Prompt clínica geral (adulto) ─────────────────────────────────────────────
//
// Compartilhado entre primeira consulta e retorno: bloco flat (StructuredSummary)
// + bloco aninhado "clinica_geral" (mapeado para ConsultaAdultoData/specialty_data).
// "clinica_geral.resumo_clinico" é o Resumo Clínico Inteligente pedido para os
// dois templates. Campos exclusivos de retorno (motivo_retorno, evolucao_clinica,
// resposta_tratamento, medication_changes, novos_problemas) só aparecem no prompt
// de retorno — o de primeira consulta nem os menciona, para não induzir o modelo
// a inventar "evolução" numa consulta que não tem visita anterior.
const ADULT_CLINICA_GERAL_SCHEMA_BLOCK = `{
  "queixa_principal": "motivo principal da consulta em uma frase",
  "hda": "anamnese narrativa completa da consulta, incluindo todos os dados subjetivos clinicamente relevantes mencionados na transcrição",
  "exame_fisico": "achados do exame físico (estado geral, cardiovascular, respiratório, abdominal, neurológico básico, extremidades, outros achados) — NÃO repita aqui os sinais vitais, eles vão em clinica_geral.vitals",
  "hipoteses": ["hipótese diagnóstica principal (sempre o primeiro item)", "hipóteses diferenciais, se houver, nos itens seguintes"],
  "conduta": "conduta clínica organizada em blocos: medicações iniciadas/ajustadas/mantidas, exames solicitados, orientações, encaminhamentos, medidas de estilo de vida",
  "retorno": "texto único combinando: prazo do retorno, objetivo do retorno, exames que o paciente deve trazer, e sinais de alerta para procurar atendimento antes do prazo — ou 'Conforme necessidade' se nada foi mencionado",
  "peso": "peso mencionado com unidade, ex: '82 kg' — deixe vazio se não mencionado",
  "altura": "altura mencionada com unidade, ex: '1,72 m' — deixe vazio se não mencionado",
  "perimetro_cefalico": "",
  "vacinas_mencionadas": [],
  "exames_solicitados": ["exame que o médico disse que vai pedir/solicitar 1", "exame 2"],
  "clinica_geral": {
    "vitals": {
      "pressao_arterial": "ex: '130/85 mmHg', vazio se não mencionado",
      "frequencia_cardiaca": "ex: '78 bpm', vazio se não mencionado",
      "frequencia_respiratoria": "ex: '18 irpm', vazio se não mencionado",
      "saturacao": "ex: '97%', vazio se não mencionado",
      "temperatura": "ex: '36.8°C', vazio se não mencionado",
      "peso": "ex: '82 kg', vazio se não mencionado",
      "altura": "ex: '172 cm', vazio se não mencionado",
      "circunferencia_abdominal": "ex: '98 cm', vazio se não mencionado"
    },
    "current_medications": [
      { "name": "nome do medicamento", "dosage": "dose, ex: '50mg'", "frequency": "ex: '1x ao dia'", "indication": "para que serve, se mencionado", "status": "active" }
    ],
    "allergies": [
      { "allergen": "substância", "reaction": "reação descrita, se mencionada", "severity": "leve | moderada | grave, se mencionada" }
    ],
    "active_problems": [
      { "name": "nome do problema/condição sugerido pela consulta, ex: 'Hipertensão arterial'", "status": "ativo" }
    ],
    "resumo_clinico": "resumo final curto (3-5 frases), profissional e escaneável, no estilo: 'Paciente de X anos, [primeira consulta/retorno] em Clínica Geral, com [condições]. [queixa/evolução]. [achado de exame relevante]. [conduta principal]. Retorno em [prazo].'"
  }
}`;

const ADULT_PRIMEIRA_STRUCTURE_PROMPT = `Você é um assistente de prontuário médico brasileiro (clínica geral / adulto), atuando na PRIMEIRA CONSULTA de um paciente. Analise a transcrição e retorne APENAS um JSON com exatamente estes campos:

${ADULT_CLINICA_GERAL_SCHEMA_BLOCK}

REGRAS:
- Responda APENAS com o JSON, sem markdown ou explicações
- Use terminologia médica brasileira para adultos
- O campo "hda" deve considerar a transcrição inteira e consolidar a anamnese completa (queixa e evolução, sintomas associados, antecedentes pessoais, cirurgias/internações, alergias, medicações em uso e adesão, hábitos de vida, histórico familiar, contexto social, dúvidas do paciente) — não descarte informação relevante por falta de campo específico
- "clinica_geral.active_problems" deve conter problemas ativos SUGERIDOS a partir do que foi dito na consulta (ex.: hipertensão não controlada, diabetes tipo 2, obesidade, ansiedade, dor lombar crônica) — apenas condições explicitamente mencionadas ou claramente evidenciadas pelo exame, nunca invente
- "perimetro_cefalico" e "vacinas_mencionadas" só se aplicam a contextos pediátricos — deixe vazio/array vazio
- Campos não mencionados: string vazia ou array vazio, nunca invente
- Não feche diagnóstico definitivo sem base explícita
- Conforme CFM 2.454/2026: você é apoio à decisão, o médico revisará e validará`;

const ADULT_RETORNO_STRUCTURE_PROMPT = `Você é um assistente de prontuário médico brasileiro (clínica geral / adulto), atuando em uma consulta de RETORNO. Você recebe também o estado clínico do paciente ANTES desta consulta (problemas ativos e medicações em uso na última visita) — use-o para descrever evolução e mudanças, nunca para preencher esta consulta com dados que não foram ditos agora.

Retorne APENAS um JSON com exatamente estes campos:

${ADULT_CLINICA_GERAL_SCHEMA_BLOCK.replace(
  '"resumo_clinico": "resumo final curto (3-5 frases), profissional e escaneável, no estilo: \'Paciente de X anos, [primeira consulta/retorno] em Clínica Geral, com [condições]. [queixa/evolução]. [achado de exame relevante]. [conduta principal]. Retorno em [prazo].\'"',
  `"resumo_clinico": "resumo final curto (3-5 frases) da evolução deste retorno, no estilo: 'Retorno para acompanhamento de [condições]. [evolução desde a última consulta]. [mudança de conduta/medicação]. Retorno em [prazo].'",
    "motivo_retorno": "acompanhamento | reavaliação de sintomas | revisão de exames | ajuste de tratamento | nova queixa — ou breve texto livre se nenhuma dessas categorias descrever bem",
    "evolucao_clinica": "resumo da evolução desde a última consulta com base no que foi dito: melhora, piora, estabilidade, baixa adesão, persistência da queixa, novo sintoma etc.",
    "resposta_tratamento": "boa | parcial | sem_resposta | piora | baixa_adesao | efeitos_adversos — a classificação que melhor descreve a resposta ao tratamento anterior, com base no que foi relatado; vazio se não houver base para classificar",
    "medication_changes": [
      { "name": "nome do medicamento", "action": "iniciada | aumentada | reduzida | suspensa | mantida", "reason": "motivo da mudança, se mencionado" }
    ],
    "novos_problemas": [
      { "name": "nome de um problema/condição NOVO identificado nesta consulta (não presente no estado anterior informado)", "status": "ativo" }
    ]`
)}

REGRAS:
- Responda APENAS com o JSON, sem markdown ou explicações
- Use terminologia médica brasileira para adultos
- "clinica_geral.active_problems" deve refletir a lista de problemas ativos ATUALIZADA (estado anterior + mudanças mencionadas nesta consulta, ex.: problema resolvido deve sair ou virar status "resolvido"); "clinica_geral.novos_problemas" é só o subconjunto de condições que NÃO estavam no estado anterior informado — pode se sobrepor com "active_problems", não precisa ser mutuamente exclusivo
- "clinica_geral.current_medications" deve refletir a lista de medicações ATUAL após os ajustes desta consulta
- "medication_changes" registra apenas mudanças explicitamente ditas nesta consulta (não repita medicações mantidas sem menção de continuidade)
- Campos não mencionados: string vazia ou array vazio, nunca invente
- Não feche diagnóstico definitivo sem base explícita
- Conforme CFM 2.454/2026: você é apoio à decisão, o médico revisará e validará`;

export function getStructurePrompt(specialty: string, consultType: 'retorno' | 'primeira vez' = 'retorno'): string {
  if (specialty === 'Tricologia') return TRICHOLOGY_STRUCTURE_PROMPT;
  if (specialty === 'Pediatria') return STRUCTURE_SYSTEM_PROMPT;
  // Clínica Geral e demais especialidades adultas
  return consultType === 'primeira vez' ? ADULT_PRIMEIRA_STRUCTURE_PROMPT : ADULT_RETORNO_STRUCTURE_PROMPT;
}

export interface AdultPreviousState {
  active_problems?: ProblemaAtivo[];
  current_medications?: Medication[];
}

export async function structureSummary(
  transcript: string,
  specialty = 'Pediatria',
  consultType: 'retorno' | 'primeira vez' = 'retorno',
  previousState?: AdultPreviousState,
): Promise<StructuredSummary> {
  const systemPrompt = specialty === 'Tricologia'
    ? TRICHOLOGY_STRUCTURE_PROMPT + transcript
    : getStructurePrompt(specialty, consultType);
  const isAdultRetorno = specialty !== 'Tricologia' && specialty !== 'Pediatria' && consultType === 'retorno';
  const userContent = specialty === 'Tricologia'
    ? '' // transcript já incluída no system prompt para Tricologia
    : isAdultRetorno
      ? `Estado clínico do paciente antes desta consulta:\n${JSON.stringify({
          active_problems: previousState?.active_problems ?? [],
          current_medications: previousState?.current_medications ?? [],
        })}\n\nTranscrição da consulta:\n\n${transcript}`
      : `Transcrição da consulta:\n\n${transcript}`;

  const data = await chatCompletion({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(userContent ? [{ role: 'user' as const, content: userContent }] : []),
    ],
  }, 'GPT-4o');
  const raw = JSON.parse(data.choices[0].message.content) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('A IA retornou um formato inesperado. Use "Continuar sem IA" para preencher manualmente.');
  }

  const isAdult = specialty !== 'Tricologia' && specialty !== 'Pediatria';
  const cg = isAdult ? (raw.clinica_geral as Record<string, unknown> | undefined) ?? {} : null;

  const str = (v: any) => (v !== null && v !== undefined) ? String(v) : '';
  const strArr = (v: any): string[] => Array.isArray(v) ? v.map(String) : [];

  const vitalsRaw = (cg?.vitals ?? {}) as Record<string, unknown>;
  const vitalsPeso = str(vitalsRaw.peso);
  const vitalsAltura = str(vitalsRaw.altura);
  const vitals: VitaisAdulto | undefined = cg ? {
    pressao_arterial: str(vitalsRaw.pressao_arterial) || undefined,
    frequencia_cardiaca: str(vitalsRaw.frequencia_cardiaca) || undefined,
    frequencia_respiratoria: str(vitalsRaw.frequencia_respiratoria) || undefined,
    saturacao: str(vitalsRaw.saturacao) || undefined,
    temperatura: str(vitalsRaw.temperatura) || undefined,
    peso: vitalsPeso || undefined,
    altura: vitalsAltura || undefined,
    imc: calcImc(vitalsPeso, vitalsAltura) || undefined,
    circunferencia_abdominal: str(vitalsRaw.circunferencia_abdominal) || undefined,
  } : undefined;

  const current_medications: Medication[] | undefined = cg && Array.isArray(cg.current_medications)
    ? cg.current_medications.map((m: any) => ({
        name: str(m?.name), dosage: str(m?.dosage) || undefined, frequency: str(m?.frequency) || undefined,
        indication: str(m?.indication) || undefined, status: 'active' as const,
      })).filter((m: Medication) => m.name)
    : undefined;

  const allergies: Allergy[] | undefined = cg && Array.isArray(cg.allergies)
    ? cg.allergies.map((a: any) => ({
        allergen: str(a?.allergen), reaction: str(a?.reaction) || undefined,
        severity: (['leve', 'moderada', 'grave'].includes(a?.severity) ? a.severity : undefined),
      })).filter((a: Allergy) => a.allergen)
    : undefined;

  const active_problems: ProblemaAtivo[] | undefined = cg && Array.isArray(cg.active_problems)
    ? cg.active_problems.map((p: any) => ({
        name: str(p?.name),
        status: (['ativo', 'controlado', 'resolvido'].includes(p?.status) ? p.status : 'ativo') as ProblemaAtivo['status'],
        updated_at: new Date().toISOString(),
      })).filter((p: ProblemaAtivo) => p.name)
    : undefined;

  let specialtyData: ConsultaAdultoData | Record<string, unknown> | null = null;
  if (specialty === 'Tricologia') {
    specialtyData = (raw.trichology as Record<string, unknown>) ?? null;
  } else if (isAdult && cg) {
    const adultData: ConsultaAdultoData = {
      vitals, current_medications, allergies, active_problems,
      resumo_clinico: str(cg.resumo_clinico) || undefined,
    };
    if (isAdultRetorno) {
      adultData.motivo_retorno = str(cg.motivo_retorno) || undefined;
      adultData.evolucao_clinica = str(cg.evolucao_clinica) || undefined;
      const resposta = str(cg.resposta_tratamento);
      adultData.resposta_tratamento = (
        ['boa', 'parcial', 'sem_resposta', 'piora', 'baixa_adesao', 'efeitos_adversos'].includes(resposta)
          ? resposta as RespostaTratamento
          : null
      );
      adultData.medication_changes = Array.isArray(cg.medication_changes)
        ? (cg.medication_changes as any[]).map(m => ({
            name: str(m?.name),
            action: (['iniciada', 'aumentada', 'reduzida', 'suspensa', 'mantida'].includes(m?.action) ? m.action : 'mantida') as MedicationChange['action'],
            reason: str(m?.reason) || undefined,
          })).filter(m => m.name)
        : [];
      adultData.novos_problemas = Array.isArray(cg.novos_problemas)
        ? (cg.novos_problemas as any[]).map(p => ({
            name: str(p?.name),
            status: (['ativo', 'controlado', 'resolvido'].includes(p?.status) ? p.status : 'ativo') as ProblemaAtivo['status'],
            updated_at: new Date().toISOString(),
          })).filter(p => p.name)
        : [];
    }
    specialtyData = adultData;
  }

  return {
    queixa_principal:    str(raw.queixa_principal),
    hda:                 str(raw.hda),
    exame_fisico:        str(raw.exame_fisico),
    hipoteses:           strArr(raw.hipoteses),
    conduta:             str(raw.conduta),
    retorno:             str(raw.retorno),
    // Pediatria only — empty for adultos/Tricologia
    peso:                str(raw.peso),
    altura:              str(raw.altura),
    perimetro_cefalico:  str(raw.perimetro_cefalico),
    vacinas_mencionadas: strArr(raw.vacinas_mencionadas),
    requested_exams:     strArr(raw.exames_solicitados),
    // Tricologia: objeto capilar. Clínica Geral: ConsultaAdultoData (vitals/medicações/problemas/resumo).
    specialty_data:      specialtyData,
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

  const resp = await chatCompletion({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    messages: [
      { role: 'system', content: SCANNABLE_SYSTEM_PROMPT },
      { role: 'user', content: input },
    ],
  }, 'GPT-4o resumo');
  const raw = JSON.parse(resp.choices[0].message.content) as Record<string, any>;

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
  const data = await chatCompletion({
    model: 'gpt-4o',
    response_format: { type: 'json_schema', json_schema: ANAMNESE_PRIMEIRA_VEZ_SCHEMA },
    temperature: 0.1,
    messages: [
      { role: 'system', content: ANAMNESE_PRIMEIRA_VEZ_SYSTEM_PROMPT },
      { role: 'user', content: `Transcrição da primeira consulta:\n\n${transcript}` },
    ],
  }, 'GPT-4o anamnese');
  const root = JSON.parse(data.choices[0].message.content) as Record<string, any>;

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

// ── GPT-4o: transcrição primeira consulta (adulto) → ficha de anamnese ─────────
//
// Prompt específico para tipo_consulta === 'primeira_vez' quando a especialidade
// do médico não é Pediatria (Clínica Geral). Retorna JSON diretamente no formato
// AnamneseAdultaData (sem seções aninhadas, ao contrário da versão pediátrica).
//
const ANAMNESE_ADULTA_SYSTEM_PROMPT = `Você é um assistente médico especializado em clínica geral (adulto). Analise a transcrição da consulta e extraia as informações da anamnese, retornando um JSON com exatamente estes campos:

{
  "motivo_consulta": null,
  "queixa_duracao": null,
  "hipertensao": null,
  "diabetes": null,
  "dislipidemia": null,
  "cardiopatia": null,
  "asma_dpoc": null,
  "doenca_renal": null,
  "doenca_cardiovascular": null,
  "avc": null,
  "cancer": null,
  "doencas_psiquiatricas": null,
  "outras_comorbidades": null,
  "cirurgias_previas": null,
  "cirurgias_desc": null,
  "internacoes_previas": null,
  "internacoes_desc": null,
  "tabagismo": null,
  "tabagismo_pack_years": null,
  "etilismo": null,
  "atividade_fisica": null,
  "atividade_fisica_desc": null,
  "sono": null,
  "uso_drogas": null,
  "ocupacao": null,
  "nivel_estresse": null,
  "medicamentos_em_uso": null,
  "alergias_medicamentos": null,
  "alergias_alimentares": null,
  "alergias_outras": null,
  "historico_familiar": null,
  "ultima_mamografia": null,
  "ultimo_papanicolau": null,
  "ultima_colonoscopia": null,
  "psa": null,
  "vacinacao_adulto": null
}

Tipos obrigatórios por campo:
- hipertensao / diabetes / dislipidemia / cardiopatia / asma_dpoc / doenca_renal / doenca_cardiovascular / avc / cancer / doencas_psiquiatricas / cirurgias_previas / internacoes_previas / atividade_fisica: true | false | null
- tabagismo: "nunca" | "ex-fumante" | "fumante" | null
- etilismo: "nunca" | "ocasional" | "regular" | null
- Demais campos: string | null

Campos não mencionados na consulta retornar como null.
Nunca invente dados não mencionados pelo médico ou paciente.
Antes de retornar null em qualquer campo, releia a transcrição inteira procurando menções diretas OU indiretas a esse tópico — mesmo comentários breves do paciente contam.
- "vacinacao_adulto" captura apenas o que foi dito na conversa sobre vacinas (ex.: "tomei a da gripe mês passado") — não é o registro formal do calendário vacinal, que fica em outra tela.
- Conforme CFM 2.454/2026: extração de apoio à decisão, médico revisará`;

const ANAMNESE_ADULTA_SCHEMA = {
  name: 'anamnese_adulta',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'motivo_consulta', 'queixa_duracao',
      'hipertensao', 'diabetes', 'dislipidemia', 'cardiopatia',
      'asma_dpoc', 'doenca_renal', 'doenca_cardiovascular', 'avc', 'cancer', 'doencas_psiquiatricas',
      'outras_comorbidades',
      'cirurgias_previas', 'cirurgias_desc', 'internacoes_previas', 'internacoes_desc',
      'tabagismo', 'tabagismo_pack_years', 'etilismo', 'atividade_fisica', 'atividade_fisica_desc',
      'sono', 'uso_drogas', 'ocupacao', 'nivel_estresse',
      'medicamentos_em_uso', 'alergias_medicamentos', 'alergias_alimentares', 'alergias_outras',
      'historico_familiar',
      'ultima_mamografia', 'ultimo_papanicolau', 'ultima_colonoscopia', 'psa', 'vacinacao_adulto',
    ],
    properties: {
      motivo_consulta: { type: ['string', 'null'] },
      queixa_duracao: { type: ['string', 'null'] },
      hipertensao: { type: ['boolean', 'null'] },
      diabetes: { type: ['boolean', 'null'] },
      dislipidemia: { type: ['boolean', 'null'] },
      cardiopatia: { type: ['boolean', 'null'] },
      asma_dpoc: { type: ['boolean', 'null'] },
      doenca_renal: { type: ['boolean', 'null'] },
      doenca_cardiovascular: { type: ['boolean', 'null'] },
      avc: { type: ['boolean', 'null'] },
      cancer: { type: ['boolean', 'null'] },
      doencas_psiquiatricas: { type: ['boolean', 'null'] },
      outras_comorbidades: { type: ['string', 'null'] },
      cirurgias_previas: { type: ['boolean', 'null'] },
      cirurgias_desc: { type: ['string', 'null'] },
      internacoes_previas: { type: ['boolean', 'null'] },
      internacoes_desc: { type: ['string', 'null'] },
      tabagismo: { type: ['string', 'null'], enum: ['nunca', 'ex-fumante', 'fumante', null] },
      tabagismo_pack_years: { type: ['string', 'null'] },
      etilismo: { type: ['string', 'null'], enum: ['nunca', 'ocasional', 'regular', null] },
      atividade_fisica: { type: ['boolean', 'null'] },
      atividade_fisica_desc: { type: ['string', 'null'] },
      sono: { type: ['string', 'null'] },
      uso_drogas: { type: ['string', 'null'] },
      ocupacao: { type: ['string', 'null'] },
      nivel_estresse: { type: ['string', 'null'] },
      medicamentos_em_uso: { type: ['string', 'null'] },
      alergias_medicamentos: { type: ['string', 'null'] },
      alergias_alimentares: { type: ['string', 'null'] },
      alergias_outras: { type: ['string', 'null'] },
      historico_familiar: { type: ['string', 'null'] },
      ultima_mamografia: { type: ['string', 'null'] },
      ultimo_papanicolau: { type: ['string', 'null'] },
      ultima_colonoscopia: { type: ['string', 'null'] },
      psa: { type: ['string', 'null'] },
      vacinacao_adulto: { type: ['string', 'null'] },
    },
  },
} as const;

export async function extractAnamneseAdulta(transcript: string): Promise<AnamneseAdultaData> {
  const data = await chatCompletion({
    model: 'gpt-4o',
    response_format: { type: 'json_schema', json_schema: ANAMNESE_ADULTA_SCHEMA },
    temperature: 0.1,
    messages: [
      { role: 'system', content: ANAMNESE_ADULTA_SYSTEM_PROMPT },
      { role: 'user', content: `Transcrição da primeira consulta:\n\n${transcript}` },
    ],
  }, 'GPT-4o anamnese adulta');
  const raw = JSON.parse(data.choices[0].message.content) as Record<string, any>;

  const str = (v: any) => (v !== null && v !== undefined) ? String(v) : '';
  const bl  = (v: any): boolean | null => v === true ? true : v === false ? false : null;

  return {
    motivo_consulta: str(raw.motivo_consulta),
    queixa_duracao: str(raw.queixa_duracao),
    hipertensao: bl(raw.hipertensao),
    diabetes: bl(raw.diabetes),
    dislipidemia: bl(raw.dislipidemia),
    cardiopatia: bl(raw.cardiopatia),
    asma_dpoc: bl(raw.asma_dpoc),
    doenca_renal: bl(raw.doenca_renal),
    doenca_cardiovascular: bl(raw.doenca_cardiovascular),
    avc: bl(raw.avc),
    cancer: bl(raw.cancer),
    doencas_psiquiatricas: bl(raw.doencas_psiquiatricas),
    outras_comorbidades: str(raw.outras_comorbidades),
    cirurgias_previas: bl(raw.cirurgias_previas),
    cirurgias_desc: str(raw.cirurgias_desc),
    internacoes_previas: bl(raw.internacoes_previas),
    internacoes_desc: str(raw.internacoes_desc),
    tabagismo: (['nunca', 'ex-fumante', 'fumante'].includes(raw.tabagismo) ? raw.tabagismo : null),
    tabagismo_pack_years: str(raw.tabagismo_pack_years),
    etilismo: (['nunca', 'ocasional', 'regular'].includes(raw.etilismo) ? raw.etilismo : null),
    atividade_fisica: bl(raw.atividade_fisica),
    atividade_fisica_desc: str(raw.atividade_fisica_desc),
    sono: str(raw.sono),
    uso_drogas: str(raw.uso_drogas),
    ocupacao: str(raw.ocupacao),
    nivel_estresse: str(raw.nivel_estresse),
    medicamentos_em_uso: str(raw.medicamentos_em_uso),
    alergias_medicamentos: str(raw.alergias_medicamentos),
    alergias_alimentares: str(raw.alergias_alimentares),
    alergias_outras: str(raw.alergias_outras),
    historico_familiar: str(raw.historico_familiar),
    ultima_mamografia: str(raw.ultima_mamografia),
    ultimo_papanicolau: str(raw.ultimo_papanicolau),
    ultima_colonoscopia: str(raw.ultima_colonoscopia),
    psa: str(raw.psa),
    vacinacao_adulto: str(raw.vacinacao_adulto),
  };
}

// ── GPT-4o: documento de exame (PDF/imagem) → marcadores estruturados ──────────
export interface ExtractedExamData {
  lab_name: string | null;
  result_date: string | null; // YYYY-MM-DD
  summary: string;
  markers: Array<Omit<LabMarker, 'id' | 'clinical_document_id' | 'patient_id' | 'created_at'>>;
}

const EXAM_EXTRACTION_SYSTEM_PROMPT = `Você é um assistente de apoio à leitura de exames laboratoriais brasileiros. Analise o documento (PDF ou imagem de resultado de exame) e retorne APENAS um JSON com exatamente este formato:

{
  "lab_name": "nome do laboratório, ou null se não identificado",
  "result_date": "data de coleta/resultado no formato YYYY-MM-DD, ou null se não identificada",
  "summary": "breve análise clínica em 2-4 frases, em português, destacando valores fora da referência e terminando com uma sugestão de conduta/seguimento",
  "markers": [
    {
      "marker_name": "nome do marcador (ex: Hemoglobina, Glicose, TSH)",
      "value": 0,
      "unit": "unidade (ex: g/dL, mg/dL)",
      "reference_text": "faixa de referência como aparece no exame, ex: '12.0 - 16.0 g/dL'",
      "reference_min": 0,
      "reference_max": 0,
      "status": "normal | alto | baixo | critico"
    }
  ]
}

REGRAS DE EXAUSTIVIDADE (MUITO IMPORTANTE):
- O array "markers" deve conter TODOS os resultados numéricos presentes no documento, sejam normais ou alterados. NÃO filtre, NÃO resuma, NÃO inclua apenas os valores fora da referência. O campo "summary" é o ÚNICO lugar onde você deve destacar o que está alterado — "markers" é uma transcrição completa e literal de cada linha de resultado, normal ou não.
- Documentos podem ser check-ups completos com 50-70+ marcadores em dezenas de páginas (hemograma, ferro/ferritina, vitaminas, função renal, eletrólitos, glicemia/HbA1c, lipidograma, função hepática, hormônios tireoidianos, hormônios sexuais, PSA, oligoelementos, etc.). Processe TODAS as seções/páginas do início ao fim — não pare na primeira tabela nem resuma por amostragem.
- Antes de responder, releia o documento inteiro e confirme que nenhuma linha de resultado numérico de nenhuma seção/página foi omitida do array "markers".
- Use apenas valores explicitamente presentes no documento — nunca invente marcadores ou resultados que não estejam impressos.
- "value" deve ser numérico, com PONTO decimal (ex.: exame impresso como "12,5" deve virar 12.5, nunca a string "12,5"). Se o valor não puder ser convertido para número, omita apenas esse marcador (resultados qualitativos como "negativo"/"reagente" não entram em "markers", mas podem ser citados em "summary").
- "reference_min"/"reference_max": extraia da faixa de referência impressa no exame; use null se não houver faixa numérica clara.
- "reference_text": SEJA CONCISO — apenas a faixa aplicável a este paciente (ex.: "70 a 99 mg/dL"), nunca a tabela de referência completa estratificada por idade/sexo/condição que aparece no laudo (ex.: para hormônios como FSH/LH/Testosterona/Estradiol, escreva só a faixa da idade/sexo do paciente, não as 4-5 faixas de outras idades).
- "status": compare o valor com a faixa de referência. Use "critico" apenas se o próprio exame marcar o valor como crítico/pânico, ou se estiver muito fora da faixa (>30% acima/abaixo). Caso contrário "alto"/"baixo"/"normal".
- "summary": linguagem de apoio à decisão, conservadora, sem fechar diagnóstico, máximo 4 frases — conforme CFM 2.454/2026 o médico revisará e validará. A ÚLTIMA frase deve ser uma sugestão breve e genérica de conduta/seguimento (ex.: "Sugere-se repetir o exame em 3 meses.", "Sugere-se investigação complementar do achado.", "Sugere-se correlacionar com o quadro clínico.", ou "Sem sugestão de conduta adicional, resultados dentro da normalidade." quando tudo estiver normal). Nunca prescreva medicamento, dose ou diagnóstico — apenas direção de seguimento (repetir, investigar, encaminhar, manter acompanhamento).
- Se não houver nenhum marcador alterado, "summary" deve ser curto (ex.: "Resultados dentro da normalidade. Sem sugestão de conduta adicional.").
- Se nenhum marcador puder ser extraído com confiança, retorne "markers": [].
- Responda APENAS com o JSON, sem markdown ou explicações.`;

export async function extractExamData(base64: string, mimeType: string): Promise<ExtractedExamData> {
  const isImage = mimeType.startsWith('image/');
  const fileContent = isImage
    ? { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
    : { type: 'file', file: { filename: 'exame.pdf', file_data: `data:${mimeType};base64,${base64}` } };

  const json = await chatCompletion({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 16000, // documento exaustivo pode ter 30-40+ marcadores — não limitar artificialmente
    messages: [
      { role: 'system', content: EXAM_EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [fileContent, { type: 'text', text: 'Extraia os dados deste exame conforme as instruções. Lembre-se: o array "markers" deve incluir TODOS os resultados numéricos do documento, não apenas os alterados.' }],
      },
    ],
  }, 'GPT-4o exame');
  const choice = json.choices[0];
  if (choice.finish_reason === 'length') {
    console.error('[extractExamData] resposta truncada por limite de tokens (finish_reason=length)');
    throw new Error('Resposta da IA truncada — documento muito extenso para uma única extração.');
  }
  let raw: Record<string, any>;
  try {
    raw = JSON.parse(choice.message.content);
  } catch (e) {
    console.error('[extractExamData] falha ao parsear JSON da IA:', e, '\nConteúdo recebido:', choice.message.content);
    throw new Error('Resposta da IA em formato inválido.');
  }

  // Tolerante a decimal brasileiro (vírgula) mesmo que o modelo não converta como instruído.
  const toNumber = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v.trim().replace(',', '.'));
    return NaN;
  };

  const markers = Array.isArray(raw.markers)
    ? raw.markers
        .filter((m: any) => m && typeof m.marker_name === 'string' && !isNaN(toNumber(m.value)))
        .map((m: any) => ({
          result_date: String(raw.result_date ?? new Date().toISOString().slice(0, 10)),
          marker_name: String(m.marker_name),
          value: toNumber(m.value),
          unit: String(m.unit ?? ''),
          reference_text: m.reference_text != null ? String(m.reference_text) : null,
          reference_min: m.reference_min != null && !isNaN(toNumber(m.reference_min)) ? toNumber(m.reference_min) : null,
          reference_max: m.reference_max != null && !isNaN(toNumber(m.reference_max)) ? toNumber(m.reference_max) : null,
          status: (['normal', 'alto', 'baixo', 'critico'].includes(m.status) ? m.status : 'normal') as LabMarker['status'],
        }))
    : [];

  return {
    lab_name: raw.lab_name != null ? String(raw.lab_name) : null,
    result_date: raw.result_date != null ? String(raw.result_date) : null,
    summary: String(raw.summary ?? ''),
    markers,
  };
}
