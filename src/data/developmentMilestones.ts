// Fonte: Caderneta de Saúde da Criança — Menino, 7ª edição (Ministério da Saúde)
// Instrumento de Vigilância do Desenvolvimento, págs. 81–87
// M-CHAT-R™: © 2009 Robins, Fein & Barton — tradução Losapio et al. 2020

export type MilestoneDomain = 'motor_grosso' | 'motor_fino' | 'linguagem' | 'social_cognitivo';
export type MilestoneStatus = 'presente' | 'ausente' | 'nao_verificado';

export interface Milestone {
  key: string;
  label: string;
  domain: MilestoneDomain;
  howToCheck: string;
}

export interface MilestoneGroup {
  id: string;
  label: string;
  minMonths: number; // inclusive
  maxMonths: number; // exclusive
  milestones: Milestone[];
}

export const MILESTONE_GROUPS: MilestoneGroup[] = [
  // ── 0–1 mês ──────────────────────────────────────────────────────────────────
  {
    id: 'f_0_1', label: '0 a 1 mês', minMonths: 0, maxMonths: 1,
    milestones: [
      {
        key: 'postura_flexao', domain: 'motor_grosso',
        label: 'Postura: pernas e braços fletidos, cabeça lateralizada',
        howToCheck: 'Deite a criança em superfície plana, de costas, com a barriga para cima; observe se seus braços e pernas ficam flexionados e sua cabeça lateralizada.',
      },
      {
        key: 'observa_rosto', domain: 'social_cognitivo',
        label: 'Observa um rosto',
        howToCheck: 'Posicione seu rosto a aproximadamente 30 cm acima do rosto da criança. Observe se a criança olha para você, de forma evidente.',
      },
      {
        key: 'reage_som', domain: 'linguagem',
        label: 'Reage ao som',
        howToCheck: 'Fique atrás da criança e bata palmas ou balance um chocalho a cerca de 30 cm de cada orelha da criança e observe se ela reage ao estímulo sonoro com movimentos nos olhos ou mudança da expressão facial.',
      },
    ],
  },

  // ── 1–2 meses ────────────────────────────────────────────────────────────────
  {
    id: 'f_1_2', label: '1 a 2 meses', minMonths: 1, maxMonths: 2,
    milestones: [
      {
        key: 'eleva_cabeca', domain: 'motor_grosso',
        label: 'Eleva a cabeça',
        howToCheck: 'Coloque a criança de bruços (barriga para baixo) e observe se ela levanta a cabeça, desencosta o queixo da superfície, sem virar para um dos lados.',
      },
      {
        key: 'sorriso_social', domain: 'social_cognitivo',
        label: 'Sorri quando estimulada',
        howToCheck: 'Sorria e converse com a criança; não lhe faça cócegas ou toque sua face. Observe se ela responde com um sorriso.',
      },
      {
        key: 'abre_maos', domain: 'motor_fino',
        label: 'Abre as mãos',
        howToCheck: 'Observe se em alguns momentos a criança abre as mãos espontaneamente.',
      },
      {
        key: 'emite_sons_1', domain: 'linguagem',
        label: 'Emite sons',
        howToCheck: 'Observe se a criança emite algum som, que não seja choro. Caso não seja observado pergunte ao acompanhante se faz em casa.',
      },
      {
        key: 'movimenta_membros', domain: 'motor_grosso',
        label: 'Movimenta os membros',
        howToCheck: 'Observe se a criança movimenta ativamente os membros superiores e inferiores.',
      },
    ],
  },

  // ── 2–4 meses ────────────────────────────────────────────────────────────────
  {
    id: 'f_2_4', label: '2 a 4 meses', minMonths: 2, maxMonths: 4,
    milestones: [
      {
        key: 'resposta_contato_social', domain: 'social_cognitivo',
        label: 'Responde ativamente ao contato social',
        howToCheck: 'Fique à frente do bebê e converse com ele. Observe se ele responde com sorriso e emissão de sons como se estivesse "conversando" com você. Pode pedir que a mãe o faça.',
      },
      {
        key: 'segura_objetos', domain: 'motor_fino',
        label: 'Segura objetos',
        howToCheck: 'Ofereça um objeto tocando no dorso da mão ou dedos da criança. Esta deverá abrir as mãos e segurar o objeto pelo menos por alguns segundos.',
      },
      {
        key: 'emite_sons_ri_alto', domain: 'linguagem',
        label: 'Emite sons, ri alto',
        howToCheck: 'Fique à frente da criança e converse com ela. Observe se ela emite sons (gugu, eeee etc.) e se ri emitindo sons (gargalhada).',
      },
      {
        key: 'levanta_cabeca_antebraco', domain: 'motor_grosso',
        label: 'Levanta a cabeça e apoia-se nos antebraços, de bruços',
        howToCheck: 'Coloque a criança de bruços, numa superfície firme. Chame sua atenção à frente com objetos ou seu rosto e observe se ela levanta a cabeça apoiando-se nos antebraços.',
      },
    ],
  },

  // ── 4–6 meses ────────────────────────────────────────────────────────────────
  {
    id: 'f_4_6', label: '4 a 6 meses', minMonths: 4, maxMonths: 6,
    milestones: [
      {
        key: 'busca_objetos', domain: 'motor_fino',
        label: 'Busca ativa de objetos',
        howToCheck: 'Coloque um objeto ao alcance da criança (sobre a mesa ou na palma de sua mão) chamando sua atenção para ele. Observe se ela tenta alcançá-lo.',
      },
      {
        key: 'leva_boca', domain: 'motor_fino',
        label: 'Leva objetos a boca',
        howToCheck: 'Ofereça um objeto na mão da criança e observe se ela o leva a boca.',
      },
      {
        key: 'localiza_som', domain: 'linguagem',
        label: 'Localiza o som',
        howToCheck: 'Faça um barulho suave (sino, chocalho etc.) próximo à orelha da criança e observe se ela vira a cabeça em direção ao objeto que produziu o som. Repita no lado oposto.',
      },
      {
        key: 'rola', domain: 'motor_grosso',
        label: 'Muda de posição (rola)',
        howToCheck: 'Coloque a criança em superfície plana de barriga para cima. Incentive-a a virar para a posição de bruços.',
      },
    ],
  },

  // ── 6–9 meses ────────────────────────────────────────────────────────────────
  {
    id: 'f_6_9', label: '6 a 9 meses', minMonths: 6, maxMonths: 9,
    milestones: [
      {
        key: 'esconde_achou', domain: 'social_cognitivo',
        label: 'Brinca de esconde-achou',
        howToCheck: 'Coloque-se à frente da criança e brinque de aparecer e desaparecer, atrás de um pano ou de outra pessoa. Observe se a criança faz movimentos para procurá-lo quando desaparece, como tentar puxar o pano ou olhar atrás da outra pessoa.',
      },
      {
        key: 'transfere_maos', domain: 'motor_fino',
        label: 'Transfere objetos de uma mão para outra',
        howToCheck: 'Ofereça um objeto para que a criança segure. Observe se ela o transfere de uma mão para outra. Se não fizer, ofereça outro objeto e observe se ela transfere o primeiro para outra mão.',
      },
      {
        key: 'duplica_silabas', domain: 'linguagem',
        label: 'Duplica sílabas',
        howToCheck: 'Observe se a criança fala "papá", "dadá", "mamã". Se não o fizer, pergunte à mãe se o faz em casa.',
      },
      {
        key: 'senta_sem_apoio', domain: 'motor_grosso',
        label: 'Senta-se sem apoio',
        howToCheck: 'Coloque a criança numa superfície firme, ofereça-lhe um objeto para que ela segure e observe se ela fica sentada sem o apoio das mãos para equilibrar-se.',
      },
    ],
  },

  // ── 9–12 meses ───────────────────────────────────────────────────────────────
  {
    id: 'f_9_12', label: '9 a 12 meses', minMonths: 9, maxMonths: 12,
    milestones: [
      {
        key: 'imita_gestos', domain: 'social_cognitivo',
        label: 'Imita gestos',
        howToCheck: 'Faça algum gesto conhecido pela criança como bater palmas ou dar tchau e observe se ela o imita. Caso ela não o faça, peça à mãe para estimulá-la.',
      },
      {
        key: 'pinca', domain: 'motor_fino',
        label: 'Faz pinça',
        howToCheck: 'Coloque próximo à criança um objeto pequeno ou uma bolinha de papel. Chame atenção da criança para que ela o pegue. Observe se ao pegá-lo ela usa o movimento de pinça, com qualquer parte do polegar associado ao indicador.',
      },
      {
        key: 'jargao', domain: 'linguagem',
        label: 'Produz "jargão"',
        howToCheck: 'Observe se a criança produz uma conversação incompreensível consigo mesma, com você ou com a mãe (jargão). Caso não seja possível observar, pergunte se ela o faz em casa.',
      },
      {
        key: 'anda_apoio', domain: 'motor_grosso',
        label: 'Anda com apoio',
        howToCheck: 'Observe se a criança consegue dar alguns passos com apoio.',
      },
    ],
  },

  // ── 12–15 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_12_15', label: '12 a 15 meses', minMonths: 12, maxMonths: 15,
    milestones: [
      {
        key: 'mostra_que_quer', domain: 'social_cognitivo',
        label: 'Mostra o que quer',
        howToCheck: 'A criança indica o que quer sem que seja por meio do choro, podendo ser por meio de palavras ou sons, apontando ou estendendo a mão para alcançar. Considerar a informação do acompanhante.',
      },
      {
        key: 'bloco_caneca', domain: 'motor_fino',
        label: 'Coloca blocos na caneca',
        howToCheck: 'Coloque três blocos e a caneca sobre a mesa, em frente à criança. Estimule-a a colocar os blocos dentro da caneca, por meio de demonstração e fala. Observe se a criança consegue colocar pelo menos um bloco dentro da caneca e soltá-lo.',
      },
      {
        key: 'diz_palavra', domain: 'linguagem',
        label: 'Diz uma palavra',
        howToCheck: 'Observe se durante o atendimento a criança diz pelo menos uma palavra que não seja nome de membros da família ou de animais de estimação. Considere a informação do acompanhante.',
      },
      {
        key: 'anda_sem_apoio', domain: 'motor_grosso',
        label: 'Anda sem apoio',
        howToCheck: 'Observe se a criança já anda bem, com bom equilíbrio, sem se apoiar.',
      },
    ],
  },

  // ── 15–18 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_15_18', label: '15 a 18 meses', minMonths: 15, maxMonths: 18,
    milestones: [
      {
        key: 'usa_colher', domain: 'motor_fino',
        label: 'Usa colher ou garfo',
        howToCheck: 'A criança usa colher ou garfo, derramando pouco fora da boca. Considere a informação do acompanhante.',
      },
      {
        key: 'torre_2_cubos', domain: 'motor_fino',
        label: 'Constrói torre de 2 cubos',
        howToCheck: 'Observe se a criança consegue colocar um cubo sobre o outro sem que ele caia ao retirar sua mão.',
      },
      {
        key: 'fala_3_palavras', domain: 'linguagem',
        label: 'Fala 3 palavras',
        howToCheck: 'Observe se durante o atendimento a criança diz três palavras que não sejam nome de membros da família ou de animais de estimação. Considere a informação do acompanhante.',
      },
      {
        key: 'anda_tras', domain: 'motor_grosso',
        label: 'Anda para trás',
        howToCheck: 'Peça à criança para abrir uma porta ou gaveta e observe se ela dá dois passos para trás sem cair.',
      },
    ],
  },

  // ── 18–24 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_18_24', label: '18 a 24 meses', minMonths: 18, maxMonths: 24,
    milestones: [
      {
        key: 'tira_roupa', domain: 'motor_fino',
        label: 'Tira roupa',
        howToCheck: 'Observe se a criança é capaz de remover alguma peça de roupa, tais como: sapatos que exijam esforço para sua remoção, casacos, calças ou camisetas. Considerar informação do acompanhante.',
      },
      {
        key: 'torre_3_cubos', domain: 'motor_fino',
        label: 'Constrói torre de 3 cubos',
        howToCheck: 'Observe se a criança consegue empilhar três cubos sem que eles caiam ao retirar sua mão.',
      },
      {
        key: 'aponta_figuras', domain: 'social_cognitivo',
        label: 'Aponta 2 figuras',
        howToCheck: 'Observe se a criança é capaz de apontar duas de um grupo de cinco figuras.',
      },
      {
        key: 'chuta_bola', domain: 'motor_grosso',
        label: 'Chuta bola',
        howToCheck: 'Observe se a criança chuta a bola sem apoiar-se em objetos.',
      },
    ],
  },

  // ── 24–30 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_24_30', label: '24 a 30 meses', minMonths: 24, maxMonths: 30,
    milestones: [
      {
        key: 'veste_supervisao', domain: 'motor_fino',
        label: 'Veste-se com supervisão',
        howToCheck: 'Pergunte aos cuidadores se a criança é capaz de vestir alguma peça de roupa tais como: calcinha, cueca, meias, sapatos, casaco etc.',
      },
      {
        key: 'torre_6_cubos', domain: 'motor_fino',
        label: 'Constrói torre de 6 cubos',
        howToCheck: 'Observe se a criança consegue empilhar seis cubos sem que eles caiam ao retirar sua mão.',
      },
      {
        key: 'frases_2_palavras', domain: 'linguagem',
        label: 'Frases com 2 palavras',
        howToCheck: 'Observe se a criança combina pelo menos duas palavras formando uma frase com significado que indique uma ação, tais como: "quer água", "quer papar", "chuta bola". Considere a informação do acompanhante.',
      },
      {
        key: 'pula_pes', domain: 'motor_grosso',
        label: 'Pula com ambos os pés',
        howToCheck: 'Observe se pula com os dois pés, atingindo o chão ao mesmo tempo, mas não necessariamente no mesmo lugar.',
      },
    ],
  },

  // ── 30–36 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_30_36', label: '30 a 36 meses', minMonths: 30, maxMonths: 36,
    milestones: [
      {
        key: 'brinca_criancas', domain: 'social_cognitivo',
        label: 'Brinca com outras crianças',
        howToCheck: 'Pergunte ao acompanhante se a criança participa de brincadeiras com outras crianças de sua idade.',
      },
      {
        key: 'imita_linha', domain: 'motor_fino',
        label: 'Imita o desenho de uma linha',
        howToCheck: 'Observe, após demonstração, se a criança faz uma linha ou mais (no papel), de pelo menos 5 cm de comprimento.',
      },
      {
        key: 'reconhece_acoes', domain: 'social_cognitivo',
        label: 'Reconhece 2 ações',
        howToCheck: 'Observe se a criança aponta a figura de acordo com a ação, tais como: "quem mia?", "quem late?", "quem fala?", "quem galopa?".',
      },
      {
        key: 'arremessa_bola', domain: 'motor_grosso',
        label: 'Arremessa bola',
        howToCheck: 'Observe se a criança arremessa a bola acima do braço.',
      },
    ],
  },

  // ── 36–42 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_36_42', label: '36 a 42 meses', minMonths: 36, maxMonths: 42,
    milestones: [
      {
        key: 'veste_camiseta', domain: 'motor_fino',
        label: 'Veste uma camiseta',
        howToCheck: 'Pergunte aos cuidadores se a criança é capaz de vestir sua camiseta e/ou casaco sem botão ou zíper, sem ajuda.',
      },
      {
        key: 'move_polegar', domain: 'motor_fino',
        label: 'Move o polegar com a mão fechada',
        howToCheck: 'Demonstre para a criança e observe se ela é capaz de mover o polegar para cima em sinal de "OK" ou "legal" ou "tudo bem", com uma ou ambas as mãos.',
      },
      {
        key: 'compreende_adjetivos', domain: 'linguagem',
        label: 'Compreende 2 adjetivos',
        howToCheck: 'Verifique se a criança é capaz de compreender dois adjetivos. Pergunte: "O que você faz quando está com fome?", "O que você faz quando está com frio?", "O que você faz quando está cansado?". Verifique se suas respostas são coerentes, tais como: "Eu como", "Eu visto casaco", "Eu vou deitar" etc.',
      },
      {
        key: 'equilibra_pe_1s', domain: 'motor_grosso',
        label: 'Equilibra-se em cada pé 1 segundo',
        howToCheck: 'Após demonstração, verifique se a criança consegue equilibrar-se em um pé só, sem apoiar-se em nenhum objeto, pelo menos um segundo, dando-lhe três tentativas. Repita com o outro pé.',
      },
    ],
  },

  // ── 42–48 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_42_48', label: '42 a 48 meses', minMonths: 42, maxMonths: 48,
    milestones: [
      {
        key: 'emparelha_cores', domain: 'social_cognitivo',
        label: 'Emparelha cores',
        howToCheck: 'Observe se a criança é capaz de emparelhar objetos da mesma cor, por exemplo os cubos.',
      },
      {
        key: 'copia_circulos', domain: 'motor_fino',
        label: 'Copia círculos',
        howToCheck: 'Forneça à criança um lápis e uma folha de papel. Mostre-lhe a figura de um círculo e verifique se ela é capaz de desenhar qualquer forma de aproximação com um círculo, que esteja fechada ou quase fechada.',
      },
      {
        key: 'fala_clara', domain: 'linguagem',
        label: 'Fala clara e compreensível',
        howToCheck: 'Durante a avaliação observe a inteligibilidade da fala da criança (articulação e verbalização de ideias em sequência).',
      },
      {
        key: 'pula_pe_so', domain: 'motor_grosso',
        label: 'Pula em um pé só',
        howToCheck: 'Demonstre e verifique se a criança consegue pular em um pé só, duas ou mais vezes, sem apoiar-se em um objeto.',
      },
    ],
  },

  // ── 48–54 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_48_54', label: '48 a 54 meses', minMonths: 48, maxMonths: 54,
    milestones: [
      {
        key: 'veste_sem_ajuda', domain: 'motor_fino',
        label: 'Veste-se sem ajuda',
        howToCheck: 'Pergunte aos cuidadores se a criança é capaz de se vestir, sem alguma ajuda.',
      },
      {
        key: 'copia_cruz', domain: 'motor_fino',
        label: 'Copia cruz',
        howToCheck: 'Forneça à criança um lápis e uma folha de papel. Mostre-lhe a figura de uma cruz e verifique se ela é capaz de desenhar duas linhas que se cruzem próximo ao seu ponto médio.',
      },
      {
        key: 'compreende_preposicoes', domain: 'linguagem',
        label: 'Compreende 4 preposições',
        howToCheck: 'Dê à criança um bloco e peça: "Coloque o bloco em cima da mesa", "Coloque o bloco embaixo da mesa", "Coloque um bloco na minha frente", "Coloque um bloco atrás de mim". Observe se ela cumpre adequadamente os quatro comandos.',
      },
      {
        key: 'equilibra_pe_3s', domain: 'motor_grosso',
        label: 'Equilibra-se em cada pé 3 segundos',
        howToCheck: 'Procedimento semelhante a "Equilibra-se em cada pé 1 segundo" com o tempo de 3 segundos ou mais.',
      },
      {
        key: 'escova_dentes', domain: 'motor_fino',
        label: 'Escova dentes sem ajuda',
        howToCheck: 'Pergunte aos cuidadores se a criança é capaz de escovar os dentes, sem ajuda ou supervisão (durante algum tempo), inclusive na colocação da pasta de dentes, na escovação dos dentes posteriores e no uso do fio dental. Verifique se a criança recebeu treino para isso.',
      },
    ],
  },

  // ── 54–60 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_54_60', label: '54 a 60 meses', minMonths: 54, maxMonths: 60,
    milestones: [
      {
        key: 'aponta_linha_comprida', domain: 'social_cognitivo',
        label: 'Aponta a linha mais comprida',
        howToCheck: 'Mostre para a criança uma ficha contendo o desenho de duas linhas paralelas em posição vertical. Verifique se ela é capaz de apontar a linha mais comprida, mesmo mudando a posição do papel. Em três tentativas, mudando a posição do papel, ela deve acertar as três, ou cinco em seis tentativas.',
      },
      {
        key: 'define_5_palavras', domain: 'linguagem',
        label: 'Define 5 palavras',
        howToCheck: 'Verifique se a criança é capaz de definir cinco palavras. Faça perguntas do tipo "O que é uma bola?" ou "O que você sabe sobre o rio?". Use palavras do seu contexto de vida. A definição é aceitável quando inclui: 1) uso; 2) forma; 3) material do que é feito; 4) categoria geral.',
      },
      {
        key: 'equilibra_pe_5s', domain: 'motor_grosso',
        label: 'Equilibra-se em um pé 5 segundos',
        howToCheck: 'Procedimento semelhante a "Equilibra-se em cada pé 1 segundo" com o tempo de 5 segundos ou mais.',
      },
    ],
  },

  // ── 60–66 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_60_66', label: '60 a 66 meses', minMonths: 60, maxMonths: 66,
    milestones: [
      {
        key: 'brinca_faz_conta', domain: 'social_cognitivo',
        label: 'Brinca de fazer de conta com outras crianças',
        howToCheck: 'Pergunte aos cuidadores se a criança participa de brincadeiras de fazer de conta (ex.: casinha, escola), tanto no contexto familiar quanto no escolar.',
      },
      {
        key: 'desenha_pessoa_6', domain: 'motor_fino',
        label: 'Desenha pessoa com 6 partes',
        howToCheck: 'Forneça à criança um lápis e uma folha de papel (sem pauta). Peça a ela para que desenhe uma pessoa. Certifique-se de que ela tenha terminado o desenho antes de pontuar. As partes do corpo presentes em pares deverão ser consideradas como uma parte apenas. Considere como certo somente se ambas as partes do par forem desenhadas.',
      },
      {
        key: 'faz_analogia', domain: 'linguagem',
        label: 'Faz analogia',
        howToCheck: 'Pergunte à criança, devagar e distintamente: "Se o cavalo é grande, o rato é…", "Se o fogo é quente, o gelo é…", "Se o Sol brilha durante o dia, a lua brilha durante…". A criança deverá completar corretamente duas das três frases.',
      },
      {
        key: 'marcha_ponta_calcanhar', domain: 'motor_grosso',
        label: 'Marcha ponta-calcanhar',
        howToCheck: 'Demonstre à criança como andar em linha reta, encostando a ponta de um pé no calcanhar do outro. Ande aproximadamente oito passos desta forma e peça para que a criança o imite. Se a criança conseguir dar quatro ou mais passos em linha reta, com o calcanhar a no máximo 2,5 cm da ponta do pé, sem apoiar-se, terá alcançado este marco.',
      },
    ],
  },

  // ── 66–72 meses ──────────────────────────────────────────────────────────────
  {
    id: 'f_66_72', label: '66 a 72 meses', minMonths: 66, maxMonths: 72,
    milestones: [
      {
        key: 'aceita_regras_jogos', domain: 'social_cognitivo',
        label: 'Aceita e segue regras nos jogos de mesa',
        howToCheck: 'Pergunte aos cuidadores se a criança é capaz de aceitar e seguir regras dos jogos de mesa.',
      },
      {
        key: 'copia_quadrado', domain: 'motor_fino',
        label: 'Copia um quadrado',
        howToCheck: 'Forneça à criança um lápis e uma folha de papel (sem pauta). Mostre a ela o desenho de um quadrado. Não nomear a figura nem mover seu dedo ou o lápis para demonstrar como desenhá-la. Peça: "Faça um desenho como este!". Podem ser fornecidas três tentativas.',
      },
      {
        key: 'define_7_palavras', domain: 'linguagem',
        label: 'Define 7 palavras',
        howToCheck: 'Procedimento semelhante ao item "Define 5 palavras". Agora deve definir 7 palavras.',
      },
      {
        key: 'equilibra_pe_7s', domain: 'motor_grosso',
        label: 'Equilibra-se em cada pé por 7 segundos',
        howToCheck: 'Procedimento semelhante a "Equilibra-se em cada pé 1 segundo" com o tempo de 7 segundos ou mais.',
      },
    ],
  },
];

// ── M-CHAT-R™ ─────────────────────────────────────────────────────────────────
// Rastreio de risco para TEA — aplicar para crianças de 16 a 30 meses
// Itens 2, 5 e 12: SIM = risco (invertidos). Demais: NÃO = risco.

export interface MchatQuestion {
  key: string;  // 'mchat_q01' ... 'mchat_q20'
  number: number;
  text: string;
  riskAnswer: 'sim' | 'nao'; // qual resposta indica risco
}

export const MCHAT_QUESTIONS: MchatQuestion[] = [
  { key: 'mchat_q01', number: 1,  riskAnswer: 'nao',
    text: 'Se você apontar para algum objeto no quarto, o seu filho olha para este objeto?' },
  { key: 'mchat_q02', number: 2,  riskAnswer: 'sim',
    text: 'Alguma vez você se perguntou se o seu filho pode ser surdo?' },
  { key: 'mchat_q03', number: 3,  riskAnswer: 'nao',
    text: 'O seu filho brinca de faz de contas? (Ex.: faz de conta que bebe em um copo vazio, que fala ao telefone, que dá comida a uma boneca)' },
  { key: 'mchat_q04', number: 4,  riskAnswer: 'nao',
    text: 'O seu filho gosta de subir nas coisas? (Ex.: móveis, brinquedos em parques ou escadas)' },
  { key: 'mchat_q05', number: 5,  riskAnswer: 'sim',
    text: 'O seu filho faz movimentos estranhos com os dedos perto dos olhos? (Ex.: mexe os dedos em frente aos olhos e fica olhando para os mesmos)' },
  { key: 'mchat_q06', number: 6,  riskAnswer: 'nao',
    text: 'O seu filho aponta com o dedo para pedir algo ou para conseguir ajuda?' },
  { key: 'mchat_q07', number: 7,  riskAnswer: 'nao',
    text: 'O seu filho aponta com o dedo para mostrar algo interessante para você? (Ex.: aponta para um avião no céu ou um caminhão grande na rua)' },
  { key: 'mchat_q08', number: 8,  riskAnswer: 'nao',
    text: 'O seu filho se interessa por outras crianças? (Ex.: olha para outras crianças, sorri para elas ou se aproxima delas)' },
  { key: 'mchat_q09', number: 9,  riskAnswer: 'nao',
    text: 'O seu filho traz coisas para mostrar para você ou as segura para que você as veja — não para conseguir ajuda, mas apenas para compartilhar?' },
  { key: 'mchat_q10', number: 10, riskAnswer: 'nao',
    text: 'O seu filho responde quando você o chama pelo nome?' },
  { key: 'mchat_q11', number: 11, riskAnswer: 'nao',
    text: 'Quando você sorri para o seu filho, ele sorri de volta para você?' },
  { key: 'mchat_q12', number: 12, riskAnswer: 'sim',
    text: 'O seu filho fica muito incomodado com barulhos do dia a dia? (Ex.: grita ou chora ao ouvir barulhos como os de liquidificador ou de música alta)' },
  { key: 'mchat_q13', number: 13, riskAnswer: 'nao',
    text: 'O seu filho anda?' },
  { key: 'mchat_q14', number: 14, riskAnswer: 'nao',
    text: 'O seu filho olha nos seus olhos quando você está falando ou brincando com ele, ou vestindo a roupa dele?' },
  { key: 'mchat_q15', number: 15, riskAnswer: 'nao',
    text: 'O seu filho tenta imitar o que você faz? (Ex.: quando você dá tchau, ou bate palmas, ou joga um beijo, ele repete o que você faz)' },
  { key: 'mchat_q16', number: 16, riskAnswer: 'nao',
    text: 'Quando você vira a cabeça para olhar para alguma coisa, o seu filho olha ao redor para ver o que você está olhando?' },
  { key: 'mchat_q17', number: 17, riskAnswer: 'nao',
    text: 'O seu filho tenta fazer você olhar para ele? (Ex.: olha para você para ser elogiado/aplaudido, ou diz: "olha mãe!" ou "óh mãe!")' },
  { key: 'mchat_q18', number: 18, riskAnswer: 'nao',
    text: 'O seu filho compreende quando você pede para ele fazer alguma coisa? (Ex.: sem apontar, o seu filho entende quando você pede: "coloca o copo na mesa" ou "liga a televisão")' },
  { key: 'mchat_q19', number: 19, riskAnswer: 'nao',
    text: 'Quando acontece algo novo, o seu filho olha para o seu rosto para ver como você se sente sobre o que aconteceu?' },
  { key: 'mchat_q20', number: 20, riskAnswer: 'nao',
    text: 'O seu filho gosta de atividades de movimento? (Ex.: ser balançado ou pular em seus joelhos)' },
];

export function scoreMchat(responses: Record<string, 'presente' | 'ausente' | 'nao_verificado'>): number {
  return MCHAT_QUESTIONS.reduce((score, q) => {
    const resp = responses[q.key];
    if (!resp || resp === 'nao_verificado') return score;
    const answered = resp === 'presente' ? 'sim' : 'nao';
    return score + (answered === q.riskAnswer ? 1 : 0);
  }, 0);
}

export function mchatRiskLevel(score: number): { level: 'baixo' | 'medio' | 'elevado'; label: string; conduct: string } {
  if (score <= 2) return {
    level: 'baixo',
    label: 'Baixo risco',
    conduct: 'Se a criança tem menos de 24 meses, reaplicar após o aniversário de 2 anos.',
  };
  if (score <= 7) return {
    level: 'medio',
    label: 'Risco médio',
    conduct: 'Aplicar Entrevista de Seguimento (M-CHAT-R/F) para informações adicionais.',
  };
  return {
    level: 'elevado',
    label: 'Risco elevado',
    conduct: 'Encaminhar imediatamente para avaliação diagnóstica e intervenção precoce.',
  };
}
