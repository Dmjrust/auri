import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StructuredSummary } from '@/data/mock';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'doctor-123', email: 'dr@test.com' } },
        error: null,
      }),
    },
  },
}));

import * as db from '@/lib/db';
import { supabase } from '@/lib/supabase';

function makeSummary(overrides: Partial<StructuredSummary> = {}): StructuredSummary {
  return {
    queixa_principal: 'Tosse seca há 3 dias',
    hda: 'Início gradual, sem febre',
    exame_fisico: 'BEG, eupneico.',
    hipoteses: ['Rinofaringite viral aguda'],
    conduta: 'Lavagem nasal, hidratação',
    retorno: '7 dias',
    peso: '8,5 kg',
    altura: '72 cm',
    perimetro_cefalico: '46 cm',
    vacinas_mencionadas: [],
    specialty_data: null,
    ...overrides,
  };
}

const BIRTH_DATE_12M = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().split('T')[0];
})();

// ── Helper: mock completo da cadeia insert → select → single ─────────────────
function mockInsertChain(returnId: string) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: returnId }, error: null }),
      }),
    }),
  };
}

describe('parseNum — extração de medidas (testado via saveConsultation)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('extrai número com vírgula: "8,5 kg" → weight_kg = 8.5', async () => {
    const capturedGrowth: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') return mockInsertChain('c1') as unknown as ReturnType<typeof supabase.from>;
      if (table === 'growth_records') {
        return {
          insert: (data: Record<string, unknown>) => {
            capturedGrowth.push(data);
            return Promise.resolve({ error: null });
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return mockInsertChain('x') as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('p1', makeSummary({ peso: '8,5 kg', altura: '72 cm', perimetro_cefalico: '46 cm' }), 300, BIRTH_DATE_12M);

    expect(capturedGrowth).toHaveLength(1);
    expect(capturedGrowth[0].weight_kg).toBe(8.5);
    expect(capturedGrowth[0].height_cm).toBe(72);
    expect(capturedGrowth[0].head_circumference_cm).toBe(46);
  });

  it('extrai número com ponto: "9.2 kg" → weight_kg = 9.2', async () => {
    const capturedGrowth: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') return mockInsertChain('c2') as unknown as ReturnType<typeof supabase.from>;
      if (table === 'growth_records') {
        return {
          insert: (data: Record<string, unknown>) => {
            capturedGrowth.push(data);
            return Promise.resolve({ error: null });
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return mockInsertChain('x') as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('p1', makeSummary({ peso: '9.2 kg' }), 300, BIRTH_DATE_12M);

    expect(capturedGrowth).toHaveLength(1);
    expect(capturedGrowth[0].weight_kg).toBe(9.2);
  });

  it('sem medidas → growth_records NÃO é inserido', async () => {
    const growthCalls: unknown[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') return mockInsertChain('c3') as unknown as ReturnType<typeof supabase.from>;
      if (table === 'growth_records') {
        return {
          insert: (data: unknown) => {
            growthCalls.push(data);
            return Promise.resolve({ error: null });
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return mockInsertChain('x') as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('p1', makeSummary({ peso: '', altura: '', perimetro_cefalico: '' }), 300, BIRTH_DATE_12M);

    expect(growthCalls).toHaveLength(0);
  });
});

describe('detectConsultType', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sem consultas anteriores → "primeira vez"', async () => {
    // detectConsultType usa { count } não { data }
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const type = await db.detectConsultType('patient-new');
    expect(type).toBe('primeira vez');
  });

  it('com 1 consulta completed → "retorno"', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const type = await db.detectConsultType('patient-returning');
    expect(type).toBe('retorno');
  });

  it('count null → trata como "primeira vez"', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: null, error: null }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const type = await db.detectConsultType('patient-null-count');
    expect(type).toBe('primeira vez');
  });
});

describe('confirmDraftConsultation — FIX B3: .eq("status", "draft")', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('UPDATE inclui filtro .eq("status", "draft") para evitar dupla confirmação', async () => {
    const eqCalls: string[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((field: string) => {
              eqCalls.push(field);
              return {
                eq: vi.fn().mockImplementation((field2: string) => {
                  eqCalls.push(field2);
                  return Promise.resolve({ error: null });
                }),
              };
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'growth_records') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
      }
      return mockInsertChain('x') as unknown as ReturnType<typeof supabase.from>;
    });

    await db.confirmDraftConsultation('draft-id', 'patient-1', makeSummary(), 300, BIRTH_DATE_12M);

    expect(eqCalls).toContain('id');
    expect(eqCalls).toContain('status'); // FIX B3 verificado
  });
});

describe('saveConsultation — campos SOAP', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('primeira hipótese vira campo diagnosis', async () => {
    const saved: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: (data: Record<string, unknown>) => {
            saved.push(data);
            return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'c10' }, error: null }) };
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('p1', makeSummary({ hipoteses: ['Bronquiolite', 'Bronquite'] }), 300, BIRTH_DATE_12M);

    expect(saved[0].diagnosis).toBe('Bronquiolite');
    expect(saved[0].sum_hipoteses).toEqual(['Bronquiolite', 'Bronquite']);
  });

  it('retorna id da consulta', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') return mockInsertChain('uuid-abc') as unknown as ReturnType<typeof supabase.from>;
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    const id = await db.saveConsultation('p1', makeSummary(), 300, BIRTH_DATE_12M);
    expect(id).toBe('uuid-abc');
  });
});
