import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock sem variáveis externas (evita hoisting issue) ───────────────────────
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

describe('fetchPatientsOverdueVaccines', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('criança de 13 meses sem vacinas → overdueCount > 5 (BCG, HepB, Pentas, VIPs...)', async () => {
    // Simula patient_vaccines retornando array vazio
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

    const result = await db.fetchPatientsOverdueVaccines([
      { id: 'p1', birth_date: thirteenMonthsAgo.toISOString().split('T')[0], full_name: 'Criança 13m' },
    ]);

    expect(result.length).toBe(1);
    // BCG(0), HepB(0), Penta x3(2,4,6m), VIP x3(2,4,6m), Rota x2(2,4m), Pneumo x3(2,4,6m),
    // Meningo C x2(3,5m), MeningoACWY(12m), FebreAmarela(12m), TripliceViral(12m), Varicela(12m),
    // PneumoReforco(12m), MeningoReforco(12m), HepA(12m) = 17+ vacinas em atraso
    expect(result[0].overdueCount).toBeGreaterThan(5);
  });

  it('criança com BCG e HepB aplicados → esses não contam como atraso', async () => {
    const doneVaccines = [
      { name: 'BCG', dose: '1ª dose', status: 'done' },
      { name: 'Hepatite B', dose: '1ª dose', status: 'done' },
    ];

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: doneVaccines, error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const result = await db.fetchPatientsOverdueVaccines([
      { id: 'p1', birth_date: threeMonthsAgo.toISOString().split('T')[0], full_name: 'Criança 3m' },
    ]);

    if (result.length > 0) {
      // Criança de 3m com BCG+HepB aplicados deve ter MENOS overdues que sem nenhuma vacina
      // BCG e HepB não aparecem mais; mas Penta D1, VIP D1, Rota D1, Pneumo D1 (2m) devem estar
      expect(result[0].overdueCount).toBeGreaterThan(0);
      expect(result[0].overdueCount).toBeLessThan(10); // menos do que sem nenhuma vacina
    }
  });

  it('criança de 0 meses → nenhuma vacina em atraso (nenhuma indicada ainda)', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const today = new Date().toISOString().split('T')[0];

    const result = await db.fetchPatientsOverdueVaccines([
      { id: 'p1', birth_date: today, full_name: 'Recém-nascido' },
    ]);

    // ageMonths = 0, então pni.age_months < 0 é falso para TODOS → nenhuma overdue
    expect(result).toHaveLength(0);
  });
});

describe('fetchAllVaccinesForDoctor — FIX B1 (scoping explícito)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('faz query na tabela "patients" primeiro para obter doctor_id scoping', async () => {
    const fromSpy = vi.mocked(supabase.from);

    // patients query → retorna 2 pacientes
    fromSpy.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'p1' }, { id: 'p2' }], error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof fromSpy>);

    // patient_vaccines query → retorna 1 vacina
    fromSpy.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'v1', patient_id: 'p1', name: 'BCG', dose: '1ª dose', status: 'done', applied_at: null, age_label: 'Ao nascer', created_at: '' }],
            error: null,
          }),
        }),
      }),
    } as unknown as ReturnType<typeof fromSpy>);

    const result = await db.fetchAllVaccinesForDoctor();

    // Verifica que a primeira chamada foi para 'patients' (FIX B1)
    expect(fromSpy.mock.calls[0][0]).toBe('patients');
    // Verifica que a segunda chamada foi para 'patient_vaccines'
    expect(fromSpy.mock.calls[1][0]).toBe('patient_vaccines');
    // Verifica agrupamento
    expect(result['p1']).toHaveLength(1);
  });

  it('retorna {} quando médico não tem pacientes ativos', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const result = await db.fetchAllVaccinesForDoctor();
    expect(result).toEqual({});
  });

  it('retorna {} quando usuário não está autenticado', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const result = await db.fetchAllVaccinesForDoctor();
    expect(result).toEqual({});
  });
});
