/**
 * Fluxo: Transcrição + Estruturação do Prontuário (ai.ts)
 *
 * Cobre:
 *  - getStructurePrompt: Pediatria usa prompt pediátrico (nunca tricológico)
 *  - structureSummary: parser mapeia JSON da API → StructuredSummary corretamente
 *  - structureSummary: campos opcionais ausentes retornam '' ou []
 *  - structureSummary: specialty_data=null para Pediatria
 *  - structureSummary: hipoteses e vacinas_mencionadas arrays corretos
 *  - structureSummary: lança erro quando API retorna status 401 (sem API key)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStructurePrompt, structureSummary } from '@/lib/ai';

// Mock de import.meta.env
vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test-key-mock');

describe('getStructurePrompt', () => {
  it('Pediatria → retorna prompt pediátrico (não tricológico)', () => {
    const prompt = getStructurePrompt('Pediatria');
    expect(prompt).toContain('pediátrico');
    expect(prompt).toContain('queixa_principal');
    expect(prompt).not.toContain('scalp_condition');
    expect(prompt).not.toContain('Tricologia');
  });

  it('Tricologia → retorna prompt tricológico (preservado para uso futuro)', () => {
    const prompt = getStructurePrompt('Tricologia');
    expect(prompt).toContain('tricológico');
    expect(prompt).toContain('scalp_condition');
  });

  it('especialidade desconhecida → fallback para Pediatria', () => {
    const prompt = getStructurePrompt('Cardiologia');
    expect(prompt).toContain('pediátrico');
    expect(prompt).not.toContain('scalp_condition');
  });
});


describe('structureSummary — parser do retorno GPT-4o', () => {
  // Salva o fetch real e restaura após cada teste
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  beforeEach(() => { vi.clearAllMocks(); });

  function mockOpenAI(jsonContent: Record<string, unknown>) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(jsonContent) } }],
      }),
    });
  }

  it('mapeia todos os campos SOAP corretamente', async () => {
    mockOpenAI({
      queixa_principal: 'Febre há 2 dias',
      hda: 'Criança com febre de 38,5°C há 2 dias, sem outros sintomas.',
      exame_fisico: 'BEG. Peso: 15 kg. Altura: 96 cm. FC: 98 bpm. T: 38,2°C.',
      hipoteses: ['Síndrome febril viral', 'Amigdalite'],
      conduta: 'Antipirético se T > 38,5°C. Retorno em 48h se não melhorar.',
      retorno: '48 horas',
      peso: '15 kg',
      altura: '96 cm',
      perimetro_cefalico: '',
      vacinas_mencionadas: ['DTP Reforço'],
    });

    const summary = await structureSummary('transcrição simulada');

    expect(summary.queixa_principal).toBe('Febre há 2 dias');
    expect(summary.hda).toContain('38,5°C');
    expect(summary.hipoteses).toEqual(['Síndrome febril viral', 'Amigdalite']);
    expect(summary.conduta).toContain('Antipirético');
    expect(summary.retorno).toBe('48 horas');
    expect(summary.peso).toBe('15 kg');
    expect(summary.altura).toBe('96 cm');
    expect(summary.perimetro_cefalico).toBe('');
    expect(summary.vacinas_mencionadas).toEqual(['DTP Reforço']);
  });

  it('specialty_data = null para Pediatria (campo trichology ausente)', async () => {
    mockOpenAI({
      queixa_principal: 'Consulta de rotina',
      hda: '', exame_fisico: '',
      hipoteses: [], conduta: '', retorno: '',
      peso: '', altura: '', perimetro_cefalico: '',
      vacinas_mencionadas: [],
      // sem campo trichology → specialty_data deve ser null
    });

    const summary = await structureSummary('transcrição', 'Pediatria');
    expect(summary.specialty_data).toBeNull();
  });

  it('campos ausentes na resposta → fallback para "" ou []', async () => {
    mockOpenAI({
      queixa_principal: 'Tosse',
      // Omite hda, hipoteses, vacinas_mencionadas, etc.
    });

    const summary = await structureSummary('transcrição');

    expect(summary.hda).toBe('');
    expect(summary.exame_fisico).toBe('');
    expect(summary.conduta).toBe('');
    expect(summary.hipoteses).toEqual([]);
    expect(summary.vacinas_mencionadas).toEqual([]);
    expect(summary.peso).toBe('');
  });

  it('hipoteses não-array → converte para []', async () => {
    mockOpenAI({
      queixa_principal: 'Tosse',
      hipoteses: 'Rinofaringite', // string em vez de array
      vacinas_mencionadas: null,
    });

    const summary = await structureSummary('transcrição');
    expect(summary.hipoteses).toEqual([]);
    expect(summary.vacinas_mencionadas).toEqual([]);
  });

  it('lança erro quando API retorna status de erro', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await expect(structureSummary('transcrição')).rejects.toThrow('Invalid API key');
  });

  it('Pediatria usa prompt pediátrico no corpo da requisição (não tricológico)', async () => {
    const capturedBodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: unknown, opts: RequestInit) => {
      capturedBodies.push(opts.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            queixa_principal: 'OK', hda: '', exame_fisico: '',
            hipoteses: [], conduta: '', retorno: '',
            peso: '', altura: '', perimetro_cefalico: '',
            vacinas_mencionadas: [],
          }) } }],
        }),
      });
    });

    await structureSummary('transcrição de consulta pediátrica', 'Pediatria');

    const body = JSON.parse(capturedBodies[0]);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system');
    // Prompt pediátrico deve conter referência pediátrica, não tricológica
    expect(systemMsg.content).toContain('pediátrico');
    expect(systemMsg.content).not.toContain('scalp_condition');
  });

  it('Pediatria instrui hda como anamnese completa baseada na transcricao inteira', async () => {
    const capturedBodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: unknown, opts: RequestInit) => {
      capturedBodies.push(opts.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            queixa_principal: 'Consulta de rotina',
            hda: 'Anamnese completa com alimentacao, sono e desenvolvimento.',
            exame_fisico: '',
            hipoteses: [],
            conduta: '',
            retorno: '',
            peso: '',
            altura: '',
            perimetro_cefalico: '',
            vacinas_mencionadas: [],
          }) } }],
        }),
      });
    });

    await structureSummary('Mae relata boa alimentacao, sono preservado, evacuacoes diarias e desenvolvimento adequado.', 'Pediatria');

    const body = JSON.parse(capturedBodies[0]);
    const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMsg.content).toContain('anamnese completa');
    expect(systemMsg.content).toContain('transcri');
    expect(systemMsg.content).toContain('alimenta');
    expect(systemMsg.content).toContain('sono');
    expect(systemMsg.content).toContain('desenvolvimento');
    expect(systemMsg.content).toContain('N');
    expect(systemMsg.content).toContain('descarte informa');
  });
});
