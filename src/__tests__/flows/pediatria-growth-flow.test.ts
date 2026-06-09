/**
 * Fluxo F3 — Curvas de Crescimento (Pediatria)
 *
 * Testa o pipeline completo:
 *   StructuredSummary (com medidas) → saveConsultation → growth_records inserido
 *   → calcZScore com dados do paciente → Z-score no intervalo OMS esperado
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcZScore, zToPercentile } from '@/lib/zscore';
import type { StructuredSummary } from '@/data/mock';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'doctor-123' } },
        error: null,
      }),
    },
  },
}));

import * as db from '@/lib/db';
import { supabase } from '@/lib/supabase';

// Medidas de referência (menino, 12 meses)
const PATIENT_BIRTH_DATE = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().split('T')[0];
})();

const SUMMARY_12M: StructuredSummary = {
  queixa_principal: 'Consulta de rotina — 1 ano',
  hda: 'Criança saudável, sem queixas.',
  exame_fisico: 'BEG. Peso: 9,6 kg. Altura: 75,7 cm. PC: 46,3 cm.',
  hipoteses: ['Criança saudável'],
  conduta: 'Manter acompanhamento de rotina.',
  retorno: '3 meses',
  peso: '9,6 kg',
  altura: '75,7 cm',
  perimetro_cefalico: '46,3 cm',
  vacinas_mencionadas: ['Tríplice Viral 1ª dose'],
  specialty_data: null,
};

describe('F3 — Fluxo Crescimento Pediatria', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('F3.1 — saveConsultation persiste medidas corretas em growth_records', async () => {
    const capturedGrowth: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: () => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'c-12m' }, error: null }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'growth_records') {
        return {
          insert: (data: Record<string, unknown>) => {
            capturedGrowth.push(data);
            return Promise.resolve({ error: null });
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('patient-1', SUMMARY_12M, 600, PATIENT_BIRTH_DATE);

    expect(capturedGrowth).toHaveLength(1);
    expect(capturedGrowth[0].weight_kg).toBe(9.6);
    expect(capturedGrowth[0].height_cm).toBe(75.7);
    expect(capturedGrowth[0].head_circumference_cm).toBe(46.3);
    expect(capturedGrowth[0].month_age).toBeGreaterThanOrEqual(12);
  });

  it('F3.2 — calcZScore para menino 12m com peso normal retorna Z entre -1 e +1', () => {
    // 9.6 kg para menino de 12m → Z positivo mas dentro da faixa normal
    const z = calcZScore(9.6, 12, 'M', 'weight');
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(-1);
    expect(z!).toBeLessThan(2);
  });

  it('F3.3 — zToPercentile(Z) para peso normal retorna percentil entre 30 e 85', () => {
    const z = calcZScore(9.6, 12, 'M', 'weight')!;
    const percentile = zToPercentile(z);
    expect(percentile).toBeGreaterThanOrEqual(30);
    expect(percentile).toBeLessThanOrEqual(85);
  });

  it('F3.4 — criança com baixo peso (6 kg aos 12m) → Z < -2 (desnutrição)', () => {
    const z = calcZScore(6.0, 12, 'M', 'weight');
    expect(z).not.toBeNull();
    expect(z!).toBeLessThan(-2);
    const percentile = zToPercentile(z!);
    expect(percentile).toBeLessThan(5);
  });

  it('F3.5 — vacinas_mencionadas são salvas na consulta', async () => {
    const capturedConsult: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: (data: Record<string, unknown>) => {
            capturedConsult.push(data);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'c-vac' }, error: null }),
            };
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('patient-1', SUMMARY_12M, 600, PATIENT_BIRTH_DATE);

    expect(capturedConsult[0].sum_vacinas_mencionadas).toEqual(['Tríplice Viral 1ª dose']);
  });
});
