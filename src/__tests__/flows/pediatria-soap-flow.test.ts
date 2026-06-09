/**
 * Fluxo F1 — Consulta SOAP Pediatria
 *
 * Testa o pipeline completo do prontuário pediátrico:
 *   StructuredSummary (gerada pela IA ou preenchida manualmente)
 *   → saveConsultation → consultations (status=completed)
 *   → fetchConsultations → lista retorna a consulta salva
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const BIRTH_DATE_12M = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().split('T')[0];
})();

// SOAP completo pediátrico
const SOAP_COMPLETO: StructuredSummary = {
  queixa_principal: 'Febre há 2 dias, 38,5°C',
  hda: 'Mãe refere febre de início há 2 dias, máxima de 38,5°C axilar, sem foco aparente. Criança com hiporexia leve, ativa.',
  exame_fisico: 'BEG, corado, hidratado, eupneico. FC 100bpm. T: 37,8°C. Orofaringe com eritema leve. Tímpanos íntegros e brilhantes. AP: sem alterações. AP: MV+ bilateral, sem ruídos adventícios.',
  hipoteses: ['Infecção de vias aéreas superiores viral', 'Faringite'],
  conduta: 'Sintomáticos: dipirona 15mg/kg/dose. Lavagem nasal com SF 0,9%. Retorno em 48h se mantiver febre ou piora.',
  retorno: '48 horas',
  peso: '9,2 kg',
  altura: '74,5 cm',
  perimetro_cefalico: '',
  vacinas_mencionadas: [],
  specialty_data: null,
};

describe('F1 — Fluxo SOAP Completo Pediatria', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('F1.1 — saveConsultation salva status=completed', async () => {
    const saved: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: (data: Record<string, unknown>) => {
            saved.push(data);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'soap-1' }, error: null }),
            };
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('patient-1', SOAP_COMPLETO, 900, BIRTH_DATE_12M, 'retorno');
    expect(saved[0].status).toBe('completed');
    expect(saved[0].type).toBe('retorno');
  });

  it('F1.2 — todos os campos SOAP mapeados corretamente', async () => {
    const saved: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: (data: Record<string, unknown>) => {
            saved.push(data);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'soap-2' }, error: null }),
            };
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('patient-1', SOAP_COMPLETO, 900, BIRTH_DATE_12M);

    const s = saved[0];
    expect(s.chief_complaint).toBe(SOAP_COMPLETO.queixa_principal);
    expect(s.anamnesis).toBe(SOAP_COMPLETO.hda);
    expect(s.physical_exam).toBe(SOAP_COMPLETO.exame_fisico);
    expect(s.diagnosis).toBe('Infecção de vias aéreas superiores viral'); // primeira hipótese
    expect(s.plan).toBe(SOAP_COMPLETO.conduta);
    expect(s.sum_retorno).toBe('48 horas');
    expect(s.sum_peso).toBe('9,2 kg');
    expect(s.sum_altura).toBe('74,5 cm');
  });

  it('F1.3 — growth_records inserido quando peso/altura presentes', async () => {
    const growthInserted: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: () => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'soap-3' }, error: null }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'growth_records') {
        return {
          insert: (data: Record<string, unknown>) => {
            growthInserted.push(data);
            return Promise.resolve({ error: null });
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('patient-1', SOAP_COMPLETO, 900, BIRTH_DATE_12M);

    expect(growthInserted).toHaveLength(1);
    expect(growthInserted[0].weight_kg).toBe(9.2);
    expect(growthInserted[0].height_cm).toBe(74.5);
  });

  it('F1.4 — perimetro_cefalico vazio → head_circumference_cm = null', async () => {
    const growthInserted: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: () => ({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'soap-4' }, error: null }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'growth_records') {
        return {
          insert: (data: Record<string, unknown>) => {
            growthInserted.push(data);
            return Promise.resolve({ error: null });
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.saveConsultation('patient-1', { ...SOAP_COMPLETO, perimetro_cefalico: '' }, 900, BIRTH_DATE_12M);

    expect(growthInserted[0].head_circumference_cm).toBeNull();
  });

  it('F1.5 — saveDraftConsultation salva status=draft', async () => {
    const saved: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          insert: (data: Record<string, unknown>) => {
            saved.push(data);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'draft-1' }, error: null }),
            };
          },
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    const draftId = await db.saveDraftConsultation('patient-1', SOAP_COMPLETO, 300, 'primeira vez');

    expect(saved[0].status).toBe('draft');
    expect(saved[0].type).toBe('primeira vez');
    expect(draftId).toBe('draft-1');
  });
});
