/**
 * Fluxo: Extração de exame (PDF/imagem) via IA (ai.ts → extractExamData)
 *
 * Cobre as regressões reais já encontradas em produção:
 *  - markers deve incluir TODOS os resultados (normais + alterados), não só os fora da faixa
 *  - finish_reason "length" (resposta truncada) deve lançar erro claro, não silencioso
 *  - JSON malformado deve lançar erro claro, não silencioso
 *  - decimal brasileiro (vírgula) não deve fazer o marcador ser descartado
 *  - erro de API (401/etc.) deve propagar a mensagem real
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { extractExamData } from '@/lib/ai';

vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test-key-mock');

describe('extractExamData — parser do retorno GPT-4o para exames', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  beforeEach(() => { vi.clearAllMocks(); });

  function mockOpenAI(content: Record<string, unknown>, finish_reason = 'stop') {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(content) }, finish_reason }],
      }),
    });
  }

  it('mantém marcadores normais e alterados — não filtra só os fora da faixa', async () => {
    mockOpenAI({
      lab_name: 'Laboratorio São Marcos',
      result_date: '2026-04-29',
      summary: 'Colesterol total levemente elevado; demais marcadores dentro da normalidade.',
      markers: [
        { marker_name: 'Hemoglobina', value: 14.2, unit: 'g/dL', reference_text: '12.0 - 16.0 g/dL', reference_min: 12.0, reference_max: 16.0, status: 'normal' },
        { marker_name: 'Hematócrito', value: 42, unit: '%', reference_text: '36 - 48%', reference_min: 36, reference_max: 48, status: 'normal' },
        { marker_name: 'Eritrócitos', value: 5.51, unit: '10^6/µL', reference_text: '4.5 - 5.5', reference_min: 4.5, reference_max: 5.5, status: 'alto' },
        { marker_name: 'VCM', value: 81, unit: 'fL', reference_text: '82 - 98 fL', reference_min: 82, reference_max: 98, status: 'baixo' },
        { marker_name: 'Leucócitos', value: 6800, unit: '/µL', reference_text: '4000 - 11000', reference_min: 4000, reference_max: 11000, status: 'normal' },
        { marker_name: 'Plaquetas', value: 250000, unit: '/µL', reference_text: '150000 - 450000', reference_min: 150000, reference_max: 450000, status: 'normal' },
        { marker_name: 'Colesterol Total', value: 200, unit: 'mg/dL', reference_text: '< 190 mg/dL', reference_min: null, reference_max: 190, status: 'alto' },
        { marker_name: 'eGFR', value: 70, unit: 'mL/min/1,73m²', reference_text: '> 90', reference_min: 90, reference_max: null, status: 'baixo' },
      ],
    });

    const result = await extractExamData('base64fake', 'application/pdf');

    expect(result.markers).toHaveLength(8);
    expect(result.markers.filter(m => m.status === 'normal')).toHaveLength(4);
    expect(result.markers.map(m => m.marker_name)).toContain('Hemoglobina');
    expect(result.markers.map(m => m.marker_name)).toContain('Colesterol Total');
  });

  it('resposta truncada (finish_reason=length) lança erro claro, não falha silenciosa', async () => {
    mockOpenAI({ markers: [] }, 'length');

    await expect(extractExamData('base64fake', 'application/pdf')).rejects.toThrow('truncada');
  });

  it('JSON malformado lança erro claro em vez de exceção genérica de parse', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{ markers: [ isso não é JSON válido' }, finish_reason: 'stop' }],
      }),
    });

    await expect(extractExamData('base64fake', 'application/pdf')).rejects.toThrow('inválido');
  });

  it('decimal brasileiro (vírgula) no value não descarta o marcador', async () => {
    mockOpenAI({
      markers: [
        { marker_name: 'Glicose', value: '92,5', unit: 'mg/dL', reference_text: '70 - 99 mg/dL', reference_min: '70,0', reference_max: '99,0', status: 'normal' },
      ],
    });

    const result = await extractExamData('base64fake', 'application/pdf');

    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].value).toBe(92.5);
    expect(result.markers[0].reference_min).toBe(70);
    expect(result.markers[0].reference_max).toBe(99);
  });

  it('marcador com valor não numérico (qualitativo) é omitido sem quebrar os demais', async () => {
    mockOpenAI({
      markers: [
        { marker_name: 'VDRL', value: 'não reagente', unit: '', status: 'normal' },
        { marker_name: 'Glicose', value: 95, unit: 'mg/dL', status: 'normal' },
      ],
    });

    const result = await extractExamData('base64fake', 'application/pdf');

    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].marker_name).toBe('Glicose');
  });

  it('erro da API (ex.: 401 sem chave) propaga a mensagem real', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await expect(extractExamData('base64fake', 'application/pdf')).rejects.toThrow('Invalid API key');
  });

  it('markers ausente ou não-array → retorna lista vazia sem lançar erro', async () => {
    mockOpenAI({ summary: 'Sem marcadores numéricos extraídos.' });

    const result = await extractExamData('base64fake', 'application/pdf');

    expect(result.markers).toEqual([]);
    expect(result.summary).toContain('Sem marcadores');
  });
});
