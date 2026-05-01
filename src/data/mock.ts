// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface Guardian { name: string; relationship: string; phone: string; email: string | null; is_primary: boolean; }

// ─── ANAMNESE PRIMEIRA CONSULTA ───────────────────────────────────────────────
export interface AnamnesePrimeiraConsultaData {
  // 1. História atual
  motivo_consulta: string;
  queixa_principal_duracao: string;
  sintomas_associados: string;
  // 2. História pregressa
  internacoes: boolean | null;
  internacoes_desc: string;
  cirurgias: boolean | null;
  cirurgias_desc: string;
  alergias_medicamentos: string;
  alergias_alimentos: string;
  alergias_outras: string;
  historico_vacinal: string;
  // 3. História gestacional
  gestacoes_gpa: string;
  idade_gestacional_semanas: string;
  intercorrencias_gestacao: boolean | null;
  intercorrencias_gestacao_desc: string;
  tipo_parto: string;
  local_parto: string;
  apgar_1: string;
  apgar_5: string;
  // 4. Triagens neonatais
  teste_pezinho: string;
  teste_orelhinha: string;
  teste_olhinho: string;
  teste_coracaozinho: string;
  // 5. História familiar
  doencas_familia: string;
  alergia_familia: boolean | null;
  alergia_familia_desc: string;
  outras_condicoes_familia: string;
  // 6. História socioeconômica
  profissao_responsaveis: string;
  renda_familiar: string;
  tabagismo_passivo: boolean | null;
  animal_domestico: boolean | null;
  animal_domestico_qual: string;
  agua_saneamento: boolean | null;
}

export function defaultAnamnesePrimeiraConsulta(): AnamnesePrimeiraConsultaData {
  return {
    motivo_consulta: '', queixa_principal_duracao: '', sintomas_associados: '',
    internacoes: null, internacoes_desc: '',
    cirurgias: null, cirurgias_desc: '',
    alergias_medicamentos: '', alergias_alimentos: '', alergias_outras: '', historico_vacinal: '',
    gestacoes_gpa: '', idade_gestacional_semanas: '',
    intercorrencias_gestacao: null, intercorrencias_gestacao_desc: '',
    tipo_parto: '', local_parto: '', apgar_1: '', apgar_5: '',
    teste_pezinho: '', teste_orelhinha: '', teste_olhinho: '', teste_coracaozinho: '',
    doencas_familia: '', alergia_familia: null, alergia_familia_desc: '', outras_condicoes_familia: '',
    profissao_responsaveis: '', renda_familiar: '',
    tabagismo_passivo: null, animal_domestico: null, animal_domestico_qual: '', agua_saneamento: null,
  };
}
export interface Patient {
  id: string; full_name: string; birth_date: string; gender: 'M' | 'F';
  blood_type: string | null; delivery_type: string; gestational_age_weeks: number;
  birth_weight_g: number; notes: string; insurance_plan: string; insurance_card_number: string; is_active: boolean;
  guardians: Guardian[];
  next_return: string | null; consultation_count: number;
}
export interface StructuredSummary {
  queixa_principal: string; hda: string; exame_fisico: string;
  hipoteses: string[]; conduta: string; retorno: string;
  peso: string; altura: string; perimetro_cefalico: string; vacinas_mencionadas: string[];
}
export interface Consultation {
  id: string; patient_id: string; scheduled_at: string; status: string;
  type: 'retorno' | 'primeira vez'; duration_minutes: number;
  chief_complaint: string; diagnosis: string; plan: string;
  prescription: string; anamnesis: string; physical_exam: string;
  summary: StructuredSummary;
}
export interface GrowthPoint { month: number; weight?: number; height?: number; hc?: number; }
export interface OmsPoint { month: number; p3: number; p15: number; p50: number; p85: number; p97: number; }
export interface VaccineRecord {
  id: string; name: string; dose: string; date: string | null;
  status: 'done' | 'pending' | 'overdue'; age_label: string;
}
export interface Appointment {
  id: string; time: string; patient_id: string; patient_name: string;
  age: string; type: 'retorno' | 'primeira vez';
  status: 'completed' | 'in_progress' | 'scheduled'; guardian: string;
}
export interface Insight { type: 'alert' | 'pattern' | 'info'; title: string; body: string; }
export interface ScannableSummary {
  quick_summary: string[];
  subjective_bullets: string[];
  objective: {
    anthropometrics: { weight: string; height: string; head_circumference: string };
    exam_bullets: string[];
  };
  assessment: { main_hypothesis: string; other_hypotheses: string[] };
  plan: {
    conduct_bullets: string[];
    parent_guidance: string[];
    medications: string[];
    vaccines: string[];
    return_plan: string;
  };
  alerts: string[];
}

// ─── PATIENTS ─────────────────────────────────────────────────────────────────
export const PATIENTS: Patient[] = [
  {
    id: 'p1', full_name: 'Miguel Santos Ferreira', birth_date: '2022-03-15',
    gender: 'M', blood_type: 'A+', delivery_type: 'Vaginal', gestational_age_weeks: 39,
    birth_weight_g: 3280, notes: 'Histórico familiar de asma paterna. Sem alergias conhecidas.',
    is_active: true, next_return: '2026-06-10', consultation_count: 8,
    guardians: [
      { name: 'Ana Paula Ferreira', relationship: 'Mãe', phone: '(11) 98765-4321', email: 'ana.ferreira@email.com', is_primary: true },
      { name: 'Carlos Ferreira', relationship: 'Pai', phone: '(11) 91234-5678', email: null, is_primary: false },
    ],
  },
  {
    id: 'p2', full_name: 'Sofia Lima Rodrigues', birth_date: '2023-08-22',
    gender: 'F', blood_type: 'O+', delivery_type: 'Cesariana', gestational_age_weeks: 38,
    birth_weight_g: 3050, notes: 'Alergia a dipirona. Dermatite atópica leve.',
    is_active: true, next_return: '2026-07-01', consultation_count: 5,
    guardians: [
      { name: 'Carla Rodrigues', relationship: 'Mãe', phone: '(11) 97654-3210', email: 'carla.rodrigues@email.com', is_primary: true },
    ],
  },
  {
    id: 'p3', full_name: 'Pedro Alves Costa', birth_date: '2024-01-10',
    gender: 'M', blood_type: 'B+', delivery_type: 'Cesariana', gestational_age_weeks: 40,
    birth_weight_g: 3500, notes: 'Amamentação exclusiva até 6 meses. Introdução alimentar sem intercorrências.',
    is_active: true, next_return: '2026-07-15', consultation_count: 4,
    guardians: [
      { name: 'Fernanda Costa', relationship: 'Mãe', phone: '(11) 96543-2109', email: 'fernanda.costa@email.com', is_primary: true },
    ],
  },
  {
    id: 'p4', full_name: 'Laura Mendes Souza', birth_date: '2025-10-21',
    gender: 'F', blood_type: null, delivery_type: 'Vaginal', gestational_age_weeks: 39,
    birth_weight_g: 3200, notes: '',
    is_active: true, next_return: null, consultation_count: 0,
    guardians: [
      { name: 'Juliana Mendes', relationship: 'Mãe', phone: '(11) 95432-1098', email: null, is_primary: true },
    ],
  },
];

// ─── CONSULTATIONS ─────────────────────────────────────────────────────────────
export const CONSULTATIONS: Record<string, Consultation[]> = {
  p1: [
    {
      id: 'c1', patient_id: 'p1', scheduled_at: '2026-03-10T09:00:00', status: 'completed',
      type: 'retorno', duration_minutes: 25,
      chief_complaint: 'Tosse há 5 dias, coriza e febre baixa',
      diagnosis: 'Rinofaringite viral aguda',
      plan: 'Hidratação, lavagem nasal com SF 0,9%, antitérmico se febre > 38°C. Retorno em 72h se piora ou em 30 dias.',
      prescription: 'Dipirona gotas: 1 gota/kg a cada 6h se febre. SF 0,9% nasal: 2 jatos/narina 3×/dia.',
      anamnesis: 'Mãe refere início de tosse seca há 5 dias, evoluindo com coriza hialina e febre 37,8°C. Sem dispneia. Aceitando alimentação. Sono prejudicado pela obstrução nasal. Frequenta creche.',
      physical_exam: 'BEG, corado, hidratado, eupneico. FR 24 irpm. FC 104 bpm. T 37,2°C. Orofaringe hiperemiada sem exsudato. AP: MV+ s/ RA.',
      summary: {
        queixa_principal: 'Tosse, coriza e febre baixa há 5 dias',
        hda: 'Paciente com 4 anos, sexo masculino. Quadro de IVAS há 5 dias. Tosse seca inicial evoluindo com coriza hialina e febre máx 37,8°C. Sem dispneia ou sinais de complicação. Frequenta creche.',
        exame_fisico: 'Sinais vitais estáveis. Orofaringe hiperemiada sem exsudato. AP limpo bilateralmente. Sem desconforto respiratório.',
        hipoteses: ['Rinofaringite viral aguda'],
        conduta: 'Tratamento sintomático com antitérmico e lavagem nasal. Orientações de hidratação e retorno condicional.',
        retorno: '72h se piora, ou 30 dias de rotina',
        peso: '16,2 kg', altura: '102 cm', vacinas_mencionadas: [],
      },
    },
    {
      id: 'c2', patient_id: 'p1', scheduled_at: '2025-12-05T10:30:00', status: 'completed',
      type: 'retorno', duration_minutes: 30,
      chief_complaint: 'Consulta de rotina — 3 anos e 9 meses',
      diagnosis: 'Criança saudável — supervisão de saúde',
      plan: 'Acompanhamento semestral. Alimentação diversificada. Solicitar hemograma + parasitológico.',
      prescription: 'Vitamina D 600 UI/dia. Flúor: manter escovação com creme dental fluoretado.',
      anamnesis: 'Mãe refere desenvolvimento adequado. Come bem e diversificado. Dorme 11h à noite. Frequenta escola regular. Sem queixas.',
      physical_exam: 'ADNP. BEG, eupneico. Peso 15,8 kg (P50-P85). Altura 100,5 cm (P50). IMC 15,6. DNPM adequado para a idade.',
      summary: {
        queixa_principal: 'Supervisão de saúde — sem queixas',
        hda: 'Consulta de rotina semestral. Desenvolvimento típico. Alimentação diversificada. Sem intercorrências.',
        exame_fisico: 'ADNP. Peso P50-P85, altura P50. DNPM adequado para 3 anos e 9 meses.',
        hipoteses: ['Criança saudável'],
        conduta: 'Supervisão de saúde. Exames solicitados. Suplementação vitamínica.',
        retorno: '6 meses ou conforme necessidade',
        peso: '15,8 kg', altura: '100,5 cm',
        vacinas_mencionadas: ['DTP 2º reforço aplicada hoje', 'VOP 2º reforço aplicada hoje', 'Varicela reforço aplicada hoje'],
      },
    },
    {
      id: 'c3', patient_id: 'p1', scheduled_at: '2025-06-20T08:30:00', status: 'completed',
      type: 'retorno', duration_minutes: 20,
      chief_complaint: 'Vômitos e diarreia há 2 dias',
      diagnosis: 'Gastroenterite aguda viral',
      plan: 'Hidratação oral com SRO. Dieta BRAT. Retorno imediato se sinais de desidratação.',
      prescription: 'SRO: 50-100 ml após cada evacuação líquida. Zinco 10 mg/dia por 14 dias.',
      anamnesis: '4 episódios de vômito e 5 evacuações líquidas em 24h. Febre 38,1°C na véspera, hoje afebril. Aceitando líquidos em pequenas quantidades.',
      physical_exam: 'Leve diminuição do turgor cutâneo. Mucosas úmidas. Abdome: RHs aumentados, levemente distendido, indolor à palpação.',
      summary: {
        queixa_principal: 'Vômitos e diarreia há 2 dias',
        hda: 'Gastroenterite aguda de provável etiologia viral. 4 vômitos e 5 evacuações líquidas. Febre ontem, afebril hoje.',
        exame_fisico: 'Desidratação leve. Abdome com ruídos aumentados.',
        hipoteses: ['Gastroenterite aguda viral'],
        conduta: 'Hidratação oral com SRO. Zinco. Orientações dietéticas.',
        retorno: 'Imediato se sinais de desidratação moderada/grave',
        peso: '15,1 kg', altura: '98 cm', vacinas_mencionadas: [],
      },
    },
  ],
  p2: [
    {
      id: 'c4', patient_id: 'p2', scheduled_at: '2026-04-01T09:00:00', status: 'completed',
      type: 'retorno', duration_minutes: 25,
      chief_complaint: 'Consulta de rotina — 2 anos e 7 meses',
      diagnosis: 'Criança saudável — dermatite atópica em bom controle',
      plan: 'Manter hidratante diário. Emoliente tópico em áreas afetadas. Evitar banhos quentes e sabonetes perfumados.',
      prescription: 'Loção hidratante: aplicar após banho diariamente. Hidrocortisona 1% creme nas lesões ativas por até 7 dias.',
      anamnesis: 'Mãe relata pele seca nas dobras com melhora do uso regular de hidratante. Sem crises intensas nos últimos 3 meses. Alimentação adequada.',
      physical_exam: 'Xerose cutânea nas dobras antecubitais. Sem lesões agudas no momento. Peso 12,4 kg (P25-P50). Altura 90,2 cm (P50).',
      summary: {
        queixa_principal: 'Consulta de rotina — dermatite atópica estável',
        hda: 'DA em bom controle com hidratação regular. Sem crises intensas recentes.',
        exame_fisico: 'Xerose em dobras. Crescimento adequado (P50).',
        hipoteses: ['Dermatite atópica em bom controle', 'Criança saudável'],
        conduta: 'Manutenção do esquema de hidratação. Corticoide tópico em exacerbações.',
        retorno: '6 meses',
        peso: '12,4 kg', altura: '90,2 cm', vacinas_mencionadas: [],
      },
    },
  ],
  p3: [
    {
      id: 'c5', patient_id: 'p3', scheduled_at: '2026-04-15T11:00:00', status: 'completed',
      type: 'retorno', duration_minutes: 20,
      chief_complaint: 'Consulta de rotina — 1 ano e 3 meses',
      diagnosis: 'Lactente em bom desenvolvimento',
      plan: 'Introdução alimentar em andamento. Manter suplementação de vitamina D. Retorno em 3 meses.',
      prescription: 'Vitamina D 600 UI/dia.',
      anamnesis: 'Mãe refere boa aceitação da alimentação complementar. Sem intercorrências. Deambulação livre desde os 12 meses. Balbucio frequente.',
      physical_exam: 'ADNP. BEG. Peso 10,8 kg (P50). Altura 77 cm (P25-P50). DNPM: marcha livre, 5-10 palavras.',
      summary: {
        queixa_principal: 'Supervisão de saúde',
        hda: 'Desenvolvimento dentro do esperado para 15 meses. DNPM adequado.',
        exame_fisico: 'Crescimento P25-P50. Marcha livre. Linguagem em desenvolvimento.',
        hipoteses: ['Lactente saudável'],
        conduta: 'Acompanhamento de rotina trimestral. Manter vitamina D.',
        retorno: '3 meses',
        peso: '10,8 kg', altura: '77 cm',
        vacinas_mencionadas: ['Varicela 1ª dose aplicada hoje'],
      },
    },
  ],
  p4: [],
};

// ─── GROWTH DATA ──────────────────────────────────────────────────────────────
export const GROWTH_DATA: Record<string, GrowthPoint[]> = {
  p1: [
    { month: 0,  weight: 3.28, height: 50.2, hc: 34.5 },
    { month: 2,  weight: 5.30, height: 58.5, hc: 38.2 },
    { month: 4,  weight: 6.80, height: 63.4, hc: 40.1 },
    { month: 6,  weight: 7.90, height: 67.8, hc: 42.0 },
    { month: 9,  weight: 9.10, height: 72.5, hc: 44.1 },
    { month: 12, weight: 9.80, height: 76.2, hc: 45.8 },
    { month: 15, weight: 10.4, height: 79.5 },
    { month: 18, weight: 11.2, height: 82.8 },
    { month: 24, weight: 12.5, height: 89.1 },
    { month: 30, weight: 13.8, height: 94.5 },
    { month: 36, weight: 15.1, height: 98.0 },
    { month: 39, weight: 15.8, height: 100.5 },
    { month: 48, weight: 16.2, height: 102.0 },
  ],
  p2: [
    { month: 0,  weight: 3.05, height: 49.1 },
    { month: 2,  weight: 5.10, height: 57.2 },
    { month: 6,  weight: 7.20, height: 65.8 },
    { month: 9,  weight: 8.30, height: 70.1 },
    { month: 12, weight: 9.10, height: 73.8 },
    { month: 18, weight: 10.8, height: 81.5 },
    { month: 24, weight: 11.9, height: 87.8 },
    { month: 31, weight: 12.4, height: 90.2 },
  ],
  p3: [
    { month: 0,  weight: 3.50, height: 51.0 },
    { month: 2,  weight: 5.60, height: 59.5 },
    { month: 4,  weight: 7.00, height: 64.8 },
    { month: 6,  weight: 8.00, height: 68.5 },
    { month: 9,  weight: 9.20, height: 73.0 },
    { month: 12, weight: 10.0, height: 76.5 },
    { month: 15, weight: 10.8, height: 77.0 },
  ],
  p4: [],
};

// OMS Boys 0-48 months
export const OMS_WEIGHT_BOY: OmsPoint[] = [
  { month: 0,  p3: 2.5, p15: 2.9, p50: 3.3, p85: 3.9, p97: 4.4 },
  { month: 2,  p3: 4.3, p15: 4.9, p50: 5.6, p85: 6.3, p97: 7.1 },
  { month: 4,  p3: 5.6, p15: 6.2, p50: 7.0, p85: 7.9, p97: 8.7 },
  { month: 6,  p3: 6.4, p15: 7.1, p50: 7.9, p85: 8.8, p97: 9.8 },
  { month: 9,  p3: 7.1, p15: 7.9, p50: 8.9, p85: 9.9, p97: 11.0 },
  { month: 12, p3: 7.7, p15: 8.6, p50: 9.6, p85: 10.8, p97: 12.0 },
  { month: 18, p3: 8.8, p15: 9.8, p50: 10.9, p85: 12.2, p97: 13.7 },
  { month: 24, p3: 9.7, p15: 10.8, p50: 12.2, p85: 13.7, p97: 15.3 },
  { month: 36, p3: 11.3, p15: 12.7, p50: 14.3, p85: 16.2, p97: 18.3 },
  { month: 48, p3: 12.7, p15: 14.3, p50: 16.3, p85: 18.6, p97: 21.2 },
];
export const OMS_HEIGHT_BOY: OmsPoint[] = [
  { month: 0,  p3: 46.3, p15: 47.9, p50: 49.9, p85: 51.8, p97: 53.4 },
  { month: 2,  p3: 54.4, p15: 56.4, p50: 58.4, p85: 60.6, p97: 62.4 },
  { month: 4,  p3: 59.7, p15: 61.8, p50: 63.9, p85: 66.0, p97: 67.8 },
  { month: 6,  p3: 63.3, p15: 65.5, p50: 67.6, p85: 69.8, p97: 72.0 },
  { month: 9,  p3: 68.0, p15: 70.1, p50: 72.3, p85: 74.5, p97: 76.5 },
  { month: 12, p3: 71.7, p15: 73.9, p50: 75.7, p85: 77.6, p97: 79.7 },
  { month: 18, p3: 77.5, p15: 79.6, p50: 82.3, p85: 85.0, p97: 87.1 },
  { month: 24, p3: 82.5, p15: 84.8, p50: 87.8, p85: 90.9, p97: 93.2 },
  { month: 36, p3: 88.7, p15: 91.2, p50: 95.1, p85: 99.0, p97: 102.0 },
  { month: 48, p3: 94.1, p15: 96.7, p50: 100.7, p85: 104.7, p97: 107.6 },
];
export const OMS_WEIGHT_GIRL: OmsPoint[] = [
  { month: 0,  p3: 2.4, p15: 2.8, p50: 3.2, p85: 3.7, p97: 4.2 },
  { month: 2,  p3: 3.9, p15: 4.5, p50: 5.1, p85: 5.8, p97: 6.6 },
  { month: 4,  p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.3, p97: 8.2 },
  { month: 6,  p3: 5.7, p15: 6.5, p50: 7.3, p85: 8.2, p97: 9.3 },
  { month: 9,  p3: 6.5, p15: 7.3, p50: 8.2, p85: 9.3, p97: 10.5 },
  { month: 12, p3: 7.0, p15: 7.9, p50: 8.9, p85: 10.1, p97: 11.5 },
  { month: 18, p3: 8.1, p15: 9.1, p50: 10.2, p85: 11.6, p97: 13.2 },
  { month: 24, p3: 9.0, p15: 10.2, p50: 11.5, p85: 13.1, p97: 14.9 },
  { month: 36, p3: 10.8, p15: 12.1, p50: 13.9, p85: 15.9, p97: 18.3 },
  { month: 48, p3: 12.3, p15: 13.9, p50: 16.1, p85: 18.7, p97: 21.7 },
];
export const OMS_HEIGHT_GIRL: OmsPoint[] = [
  { month: 0,  p3: 45.6, p15: 47.2, p50: 49.1, p85: 51.0, p97: 52.7 },
  { month: 2,  p3: 52.7, p15: 54.6, p50: 56.6, p85: 58.9, p97: 60.9 },
  { month: 4,  p3: 57.8, p15: 59.9, p50: 62.1, p85: 64.3, p97: 66.2 },
  { month: 6,  p3: 61.2, p15: 63.3, p50: 65.7, p85: 68.1, p97: 70.3 },
  { month: 9,  p3: 65.6, p15: 67.7, p50: 70.1, p85: 72.6, p97: 74.8 },
  { month: 12, p3: 69.2, p15: 71.3, p50: 74.0, p85: 76.6, p97: 79.2 },
  { month: 18, p3: 75.0, p15: 77.2, p50: 80.2, p85: 83.1, p97: 86.2 },
  { month: 24, p3: 80.0, p15: 82.5, p50: 85.7, p85: 89.1, p97: 92.2 },
  { month: 36, p3: 86.3, p15: 89.1, p50: 93.1, p85: 97.2, p97: 100.7 },
  { month: 48, p3: 92.1, p15: 95.0, p50: 99.4, p85: 103.8, p97: 107.8 },
];

// ─── VACCINES ─────────────────────────────────────────────────────────────────
export const VACCINES: Record<string, VaccineRecord[]> = {
  p1: [
    { id:'v1',  name:'BCG',                   dose:'Dose única',    date:'2022-03-16', status:'done',    age_label:'Ao nascer' },
    { id:'v2',  name:'Hepatite B',             dose:'1ª dose',       date:'2022-03-16', status:'done',    age_label:'Ao nascer' },
    { id:'v3',  name:'Hepatite B',             dose:'2ª dose',       date:'2022-04-15', status:'done',    age_label:'1 mês' },
    { id:'v4',  name:'Pentavalente',           dose:'1ª dose',       date:'2022-05-16', status:'done',    age_label:'2 meses' },
    { id:'v5',  name:'VIP',                    dose:'1ª dose',       date:'2022-05-16', status:'done',    age_label:'2 meses' },
    { id:'v6',  name:'Pneumocócica 10V',       dose:'1ª dose',       date:'2022-05-16', status:'done',    age_label:'2 meses' },
    { id:'v7',  name:'Rotavírus',              dose:'1ª dose',       date:'2022-05-16', status:'done',    age_label:'2 meses' },
    { id:'v8',  name:'Meningocócica C',        dose:'1ª dose',       date:'2022-05-16', status:'done',    age_label:'2 meses' },
    { id:'v9',  name:'Pneumocócica 10V',       dose:'2ª dose',       date:'2022-06-14', status:'done',    age_label:'3 meses' },
    { id:'v10', name:'Meningocócica C',        dose:'2ª dose',       date:'2022-06-14', status:'done',    age_label:'3 meses' },
    { id:'v11', name:'Pentavalente',           dose:'2ª dose',       date:'2022-07-14', status:'done',    age_label:'4 meses' },
    { id:'v12', name:'VIP',                    dose:'2ª dose',       date:'2022-07-14', status:'done',    age_label:'4 meses' },
    { id:'v13', name:'Rotavírus',              dose:'2ª dose',       date:'2022-07-14', status:'done',    age_label:'4 meses' },
    { id:'v14', name:'Pentavalente',           dose:'3ª dose',       date:'2022-09-12', status:'done',    age_label:'6 meses' },
    { id:'v15', name:'VIP',                    dose:'3ª dose',       date:'2022-09-12', status:'done',    age_label:'6 meses' },
    { id:'v16', name:'Influenza',              dose:'1ª dose',       date:'2022-09-12', status:'done',    age_label:'6 meses' },
    { id:'v17', name:'Febre Amarela',          dose:'1ª dose',       date:'2022-12-10', status:'done',    age_label:'9 meses' },
    { id:'v18', name:'Tríplice Viral (SCR)',   dose:'1ª dose',       date:'2023-03-15', status:'done',    age_label:'12 meses' },
    { id:'v19', name:'Pneumocócica 10V',       dose:'Reforço',       date:'2023-03-15', status:'done',    age_label:'12 meses' },
    { id:'v20', name:'Meningocócica C',        dose:'Reforço',       date:'2023-03-15', status:'done',    age_label:'12 meses' },
    { id:'v21', name:'DTP',                    dose:'1º reforço',    date:'2023-06-12', status:'done',    age_label:'15 meses' },
    { id:'v22', name:'VOP',                    dose:'1º reforço',    date:'2023-06-12', status:'done',    age_label:'15 meses' },
    { id:'v23', name:'Tríplice Viral (SCR)',   dose:'2ª dose',       date:'2023-06-12', status:'done',    age_label:'15 meses' },
    { id:'v24', name:'Hepatite A',             dose:'Dose única',    date:'2023-06-12', status:'done',    age_label:'15 meses' },
    { id:'v25', name:'Varicela',               dose:'1ª dose',       date:'2023-06-12', status:'done',    age_label:'15 meses' },
    { id:'v26', name:'DTP',                    dose:'2º reforço',    date:'2025-12-05', status:'done',    age_label:'4 anos' },
    { id:'v27', name:'VOP',                    dose:'2º reforço',    date:'2025-12-05', status:'done',    age_label:'4 anos' },
    { id:'v28', name:'Varicela',               dose:'Reforço',       date:'2025-12-05', status:'done',    age_label:'4 anos' },
    { id:'v29', name:'Influenza',              dose:'Dose anual 2026', date: null,      status:'overdue', age_label:'Anual' },
  ],
  p2: [
    { id:'v1',  name:'BCG',              dose:'Dose única', date:'2023-08-23', status:'done', age_label:'Ao nascer' },
    { id:'v2',  name:'Hepatite B',       dose:'1ª dose',    date:'2023-08-23', status:'done', age_label:'Ao nascer' },
    { id:'v3',  name:'Pentavalente',     dose:'1ª dose',    date:'2023-10-22', status:'done', age_label:'2 meses' },
    { id:'v4',  name:'VIP',              dose:'1ª dose',    date:'2023-10-22', status:'done', age_label:'2 meses' },
    { id:'v5',  name:'Pneumocócica 10V', dose:'1ª dose',    date:'2023-10-22', status:'done', age_label:'2 meses' },
    { id:'v6',  name:'Rotavírus',        dose:'1ª dose',    date:'2023-10-22', status:'done', age_label:'2 meses' },
    { id:'v7',  name:'Meningocócica C',  dose:'1ª dose',    date:'2023-10-22', status:'done', age_label:'2 meses' },
    { id:'v8',  name:'Pentavalente',     dose:'2ª dose',    date:'2023-12-20', status:'done', age_label:'4 meses' },
    { id:'v9',  name:'VIP',              dose:'2ª dose',    date:'2023-12-20', status:'done', age_label:'4 meses' },
    { id:'v10', name:'Rotavírus',        dose:'2ª dose',    date:'2023-12-20', status:'done', age_label:'4 meses' },
    { id:'v11', name:'Pentavalente',     dose:'3ª dose',    date:'2024-02-20', status:'done', age_label:'6 meses' },
    { id:'v12', name:'VIP',              dose:'3ª dose',    date:'2024-02-20', status:'done', age_label:'6 meses' },
    { id:'v13', name:'Febre Amarela',    dose:'1ª dose',    date:'2024-05-20', status:'done', age_label:'9 meses' },
    { id:'v14', name:'Tríplice Viral',   dose:'1ª dose',    date:'2024-08-22', status:'done', age_label:'12 meses' },
    { id:'v15', name:'Pneumocócica 10V', dose:'Reforço',    date:'2024-08-22', status:'done', age_label:'12 meses' },
    { id:'v16', name:'Meningocócica C',  dose:'Reforço',    date:'2024-08-22', status:'done', age_label:'12 meses' },
    { id:'v17', name:'DTP',              dose:'1º reforço', date:'2024-11-22', status:'done', age_label:'15 meses' },
    { id:'v18', name:'VOP',              dose:'1º reforço', date:'2024-11-22', status:'done', age_label:'15 meses' },
    { id:'v19', name:'Tríplice Viral',   dose:'2ª dose',    date:'2024-11-22', status:'done', age_label:'15 meses' },
    { id:'v20', name:'Hepatite A',       dose:'Dose única', date:'2024-11-22', status:'done', age_label:'15 meses' },
    { id:'v21', name:'Varicela',         dose:'1ª dose',    date:'2024-11-22', status:'done', age_label:'15 meses' },
    { id:'v22', name:'Influenza',        dose:'Dose anual 2026', date: null,   status:'pending', age_label:'Anual' },
  ],
  p3: [
    { id:'v1', name:'BCG',              dose:'Dose única', date:'2024-01-11', status:'done', age_label:'Ao nascer' },
    { id:'v2', name:'Hepatite B',       dose:'1ª dose',    date:'2024-01-11', status:'done', age_label:'Ao nascer' },
    { id:'v3', name:'Pentavalente',     dose:'1ª dose',    date:'2024-03-10', status:'done', age_label:'2 meses' },
    { id:'v4', name:'VIP',              dose:'1ª dose',    date:'2024-03-10', status:'done', age_label:'2 meses' },
    { id:'v5', name:'Pneumocócica 10V', dose:'1ª dose',    date:'2024-03-10', status:'done', age_label:'2 meses' },
    { id:'v6', name:'Rotavírus',        dose:'1ª dose',    date:'2024-03-10', status:'done', age_label:'2 meses' },
    { id:'v7', name:'Pentavalente',     dose:'2ª dose',    date:'2024-05-10', status:'done', age_label:'4 meses' },
    { id:'v8', name:'VIP',              dose:'2ª dose',    date:'2024-05-10', status:'done', age_label:'4 meses' },
    { id:'v9', name:'Rotavírus',        dose:'2ª dose',    date:'2024-05-10', status:'done', age_label:'4 meses' },
    { id:'v10',name:'Pentavalente',     dose:'3ª dose',    date:'2024-07-10', status:'done', age_label:'6 meses' },
    { id:'v11',name:'VIP',              dose:'3ª dose',    date:'2024-07-10', status:'done', age_label:'6 meses' },
    { id:'v12',name:'Febre Amarela',    dose:'1ª dose',    date:'2024-10-10', status:'done', age_label:'9 meses' },
    { id:'v13',name:'Tríplice Viral',   dose:'1ª dose',    date:'2025-01-10', status:'done', age_label:'12 meses' },
    { id:'v14',name:'Pneumocócica 10V', dose:'Reforço',    date:'2025-01-10', status:'done', age_label:'12 meses' },
    { id:'v15',name:'DTP',              dose:'1º reforço', date:'2025-04-10', status:'done', age_label:'15 meses' },
    { id:'v16',name:'Varicela',         dose:'1ª dose',    date:'2026-04-15', status:'done', age_label:'15 meses' },
    { id:'v17',name:'Hepatite A',       dose:'Dose única', date: null,        status:'pending', age_label:'15 meses' },
    { id:'v18',name:'VOP',              dose:'1º reforço', date: null,        status:'pending', age_label:'15 meses' },
    { id:'v19',name:'Tríplice Viral',   dose:'2ª dose',    date: null,        status:'pending', age_label:'15 meses' },
  ],
  p4: [
    { id:'v1', name:'BCG',         dose:'Dose única', date:'2025-10-22', status:'done',    age_label:'Ao nascer' },
    { id:'v2', name:'Hepatite B',  dose:'1ª dose',    date:'2025-10-22', status:'done',    age_label:'Ao nascer' },
    { id:'v3', name:'Hepatite B',  dose:'2ª dose',    date:'2025-11-21', status:'done',    age_label:'1 mês' },
    { id:'v4', name:'Pentavalente',dose:'1ª dose',    date:'2025-12-21', status:'done',    age_label:'2 meses' },
    { id:'v5', name:'VIP',         dose:'1ª dose',    date:'2025-12-21', status:'done',    age_label:'2 meses' },
    { id:'v6', name:'Rotavírus',   dose:'1ª dose',    date:'2025-12-21', status:'done',    age_label:'2 meses' },
    { id:'v7', name:'Pentavalente',dose:'2ª dose',    date: null,        status:'pending', age_label:'4 meses' },
    { id:'v8', name:'VIP',         dose:'2ª dose',    date: null,        status:'pending', age_label:'4 meses' },
    { id:'v9', name:'Rotavírus',   dose:'2ª dose',    date: null,        status:'pending', age_label:'4 meses' },
  ],
};

// ─── TODAY'S APPOINTMENTS ─────────────────────────────────────────────────────
export const TODAY_APPOINTMENTS: Appointment[] = [
  { id:'a1', time:'08:30', patient_id:'p1', patient_name:'Miguel Santos Ferreira', age:'4 anos',       type:'retorno',       status:'completed',  guardian:'Ana Paula Ferreira' },
  { id:'a2', time:'09:00', patient_id:'p2', patient_name:'Sofia Lima Rodrigues',   age:'2a 8m',         type:'retorno',       status:'in_progress',guardian:'Carla Rodrigues'     },
  { id:'a3', time:'09:30', patient_id:'p3', patient_name:'Pedro Alves Costa',      age:'1a 3m',         type:'retorno',       status:'scheduled',  guardian:'Fernanda Costa'      },
  { id:'a4', time:'10:00', patient_id:'p4', patient_name:'Laura Mendes Souza',     age:'6 meses',       type:'primeira vez',  status:'scheduled',  guardian:'Juliana Mendes'      },
  { id:'a5', time:'11:00', patient_id:'p2', patient_name:'Sofia Lima Rodrigues',   age:'2a 8m',         type:'retorno',       status:'scheduled',  guardian:'Carla Rodrigues'     },
];

// ─── WEEK APPOINTMENTS ────────────────────────────────────────────────────────
export const WEEK_APPOINTMENTS: Record<string, Appointment[]> = {
  '2026-04-20': [
    { id:'b1', time:'08:30', patient_id:'p1', patient_name:'Miguel Santos Ferreira', age:'4 anos', type:'retorno',      status:'completed', guardian:'Ana Paula Ferreira' },
    { id:'b2', time:'09:00', patient_id:'p3', patient_name:'Pedro Alves Costa',      age:'1a 3m',  type:'retorno',      status:'completed', guardian:'Fernanda Costa'     },
    { id:'b3', time:'10:00', patient_id:'p4', patient_name:'Laura Mendes Souza',     age:'6 meses',type:'primeira vez', status:'completed', guardian:'Juliana Mendes'     },
    { id:'b4', time:'11:00', patient_id:'p2', patient_name:'Sofia Lima Rodrigues',   age:'2a 8m',  type:'retorno',      status:'completed', guardian:'Carla Rodrigues'    },
  ],
  '2026-04-21': TODAY_APPOINTMENTS,
  '2026-04-22': [
    { id:'c1', time:'08:30', patient_id:'p2', patient_name:'Sofia Lima Rodrigues',   age:'2a 8m',  type:'retorno',      status:'scheduled', guardian:'Carla Rodrigues'    },
    { id:'c2', time:'09:30', patient_id:'p1', patient_name:'Miguel Santos Ferreira', age:'4 anos', type:'retorno',      status:'scheduled', guardian:'Ana Paula Ferreira' },
    { id:'c3', time:'10:30', patient_id:'p4', patient_name:'Laura Mendes Souza',     age:'6 meses',type:'primeira vez', status:'scheduled', guardian:'Juliana Mendes'     },
    { id:'c4', time:'11:30', patient_id:'p3', patient_name:'Pedro Alves Costa',      age:'1a 3m',  type:'retorno',      status:'scheduled', guardian:'Fernanda Costa'     },
  ],
  '2026-04-23': [
    { id:'d1', time:'09:00', patient_id:'p3', patient_name:'Pedro Alves Costa',      age:'1a 3m',  type:'retorno',      status:'scheduled', guardian:'Fernanda Costa'     },
    { id:'d2', time:'10:00', patient_id:'p1', patient_name:'Miguel Santos Ferreira', age:'4 anos', type:'retorno',      status:'scheduled', guardian:'Ana Paula Ferreira' },
    { id:'d3', time:'11:00', patient_id:'p4', patient_name:'Laura Mendes Souza',     age:'6 meses',type:'primeira vez', status:'scheduled', guardian:'Juliana Mendes'     },
  ],
  '2026-04-24': [
    { id:'e1', time:'08:30', patient_id:'p2', patient_name:'Sofia Lima Rodrigues',   age:'2a 8m',  type:'retorno',      status:'scheduled', guardian:'Carla Rodrigues'    },
    { id:'e2', time:'10:00', patient_id:'p1', patient_name:'Miguel Santos Ferreira', age:'4 anos', type:'retorno',      status:'scheduled', guardian:'Ana Paula Ferreira' },
  ],
  '2026-04-25': [],
  '2026-04-26': [],
};

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────
export const INSIGHTS: Record<string, Insight[]> = {
  p1: [
    { type: 'alert',   title: 'Vacina pendente', body: 'Influenza 2026 não registrada. Recomendada anualmente a partir de 6 meses.' },
    { type: 'pattern', title: 'Padrão respiratório', body: '3 episódios de IVAS nos últimos 12 meses. Histórico familiar de asma paterna. Monitorar sibilância e avaliar hiperreatividade brônquica.' },
    { type: 'info',    title: 'Crescimento adequado', body: 'Peso e altura em P50–P85 nas últimas 4 medições. Curva ascendente consistente.' },
    { type: 'info',    title: 'Retorno previsto', body: 'Próxima consulta de rotina: 10/06/2026 (50 dias).' },
  ],
  p2: [
    { type: 'alert',   title: 'Condição de acompanhamento ativo', body: 'Dermatite atópica com histórico de exacerbações. Confirmar adesão à hidratação diária.' },
    { type: 'alert',   title: 'Alergia registrada', body: 'Dipirona — contraindicada. Usar paracetamol como antitérmico de escolha.' },
    { type: 'info',    title: 'Crescimento adequado', body: 'Peso e altura em torno do P50 nas últimas medições.' },
  ],
  p3: [
    { type: 'alert',   title: 'Vacinas pendentes', body: '3 doses do PNI de 15 meses ainda não registradas: Hepatite A, VOP e Tríplice Viral 2ª dose.' },
    { type: 'info',    title: 'Desenvolvimento motor', body: 'Deambulação livre aos 12 meses — dentro do esperado.' },
  ],
  p4: [
    { type: 'alert',   title: 'Primeira consulta', body: 'Nenhuma consulta registrada anteriormente. Aplicar protocolo de triagem neonatal/lactente.' },
    { type: 'alert',   title: 'Vacinas pendentes', body: 'Pentavalente 2ª dose, VIP 2ª dose e Rotavírus 2ª dose (4 meses) ainda não registradas.' },
  ],
};

// ─── SIMULATED TRANSCRIPT ──────────────────────────────────────────────────────
export const SIMULATED_TRANSCRIPT = `
Médico: Boa tarde, Ana Paula. Boa tarde, Miguel. Como você está hoje?

Mãe: Boa tarde, doutor. Estamos bem, obrigada. Vim para a consulta de rotina dos 4 anos mesmo.

Médico: Ótimo. Miguel, você está bem? Deixa eu te examinar. Ana Paula, tem alguma queixa específica hoje?

Mãe: Não, doutor. Ele está bem. Dormindo bem, comendo bem. A única coisa que quero comentar é que ele vive com coriza desde que entrou na escola nova, mas é passageiro.

Médico: Entendido. Vou pesar e medir ele. [pausa] Peso 16,4 quilos e altura 102,5 centímetros. Muito bem, Miguel. Está crescendo certinho.

Médico: Vou examinar agora. Garganta boa, sem vermelhidão. Pulmão está limpinho, sem chiado. Barriga ok. Coração batendo bonito. Desenvolvimento motor e linguagem adequados para 4 anos.

Médico: Quanto às vacinas — ele tomou DTP reforço, VOP e varicela na última consulta em dezembro. A que falta agora é a influenza 2026. Vou pedir para vocês tomarem ainda este mês.

Mãe: Ah sim, eu lembrava que tinha alguma vacina pendente. Posso tomar aqui mesmo?

Médico: Pode, mas hoje não tenho o lote disponível. Vou deixar anotado e na recepção eles agendam só para a vacina. Qualquer UBS também tem.

Médico: Retorno daqui 6 meses, no final de setembro ou outubro. Qualquer intercorrência pode me chamar pelo WhatsApp ou vir antes.
`.trim();

export const SIMULATED_SUMMARY = {
  queixa_principal: 'Consulta de supervisão de saúde — 4 anos',
  hda: 'Paciente 4 anos, sexo masculino, em bom estado geral. Mãe refere coriza recorrente desde início na nova escola, sem outras queixas. Desenvolvimento adequado. Sono e apetite preservados.',
  exame_fisico: 'BEG, eupneico. Peso 16,4 kg (P50–P85). Altura 102,5 cm (P50). Orofaringe sem alterações. AP: MV+ bilateral sem RA. ACV: RCR 2T BNF. DNPM adequado para 4 anos.',
  hipoteses: ['Criança saudável — supervisão de saúde', 'Rinossinusite recorrente a esclarecer'],
  conduta: 'Supervisão de saúde dos 4 anos. Orientações gerais. Vacina Influenza 2026 pendente — orientar aplicação em UBS ou retornar para aplicar.',
  retorno: '6 meses (outubro 2026) ou antes se necessário',
  peso: '16,4 kg',
  altura: '102,5 cm',
  vacinas_mencionadas: ['Influenza 2026 — pendente, orientada aplicação'],
};
